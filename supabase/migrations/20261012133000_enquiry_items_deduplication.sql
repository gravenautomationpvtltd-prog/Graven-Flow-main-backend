-- Migration: 20261012133000_enquiry_items_deduplication.sql
-- Fix duplicate enquiry items and provide safe upsert / merge mechanisms

-- 1. Update RLS policy on enquiry_items so that authorized users (admins, sales, CRO/LQT, managers, lead owners) can delete/replace items
DROP POLICY IF EXISTS "Admins can delete enquiry items" ON public.enquiry_items;
DROP POLICY IF EXISTS "Users can delete enquiry items" ON public.enquiry_items;

CREATE POLICY "Users can delete enquiry items"
ON public.enquiry_items FOR DELETE
USING (
  is_admin_or_above(auth.uid()) OR
  has_role(auth.uid(), 'cro'::app_role) OR
  has_role(auth.uid(), 'sales'::app_role) OR
  has_role(auth.uid(), 'manager'::app_role) OR
  (EXISTS (
    SELECT 1 FROM leads l
    WHERE l.id = enquiry_items.lead_id
      AND (l.assigned_to = auth.uid() OR is_same_tenant(l.assigned_to))
  ))
);

-- 2. Canonical function: add_or_update_enquiry_item
-- If the same product already exists on the lead, increments its quantity instead of creating a duplicate row.
CREATE OR REPLACE FUNCTION public.add_or_update_enquiry_item(
  p_lead_id uuid,
  p_product_query_text text,
  p_quantity numeric DEFAULT 1,
  p_matched_product_id uuid DEFAULT NULL,
  p_brand text DEFAULT NULL,
  p_notes text DEFAULT NULL,
  p_target_rate numeric DEFAULT NULL,
  p_price_available boolean DEFAULT false,
  p_allow_separate_line boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_clean_text text;
  v_existing_id uuid;
  v_existing_qty numeric;
  v_next_sort int;
  v_item enquiry_items%ROWTYPE;
BEGIN
  v_clean_text := trim(p_product_query_text);
  IF v_clean_text IS NULL OR v_clean_text = '' THEN
    RAISE EXCEPTION 'Product query text cannot be empty';
  END IF;

  -- Check for existing duplicate item if not explicitly requested as separate line
  IF NOT p_allow_separate_line THEN
    SELECT id, quantity INTO v_existing_id, v_existing_qty
    FROM public.enquiry_items
    WHERE lead_id = p_lead_id
      AND (
        (p_matched_product_id IS NOT NULL AND matched_product_id = p_matched_product_id)
        OR
        (
          (p_matched_product_id IS NULL OR matched_product_id IS NULL)
          AND lower(trim(product_query_text)) = lower(v_clean_text)
        )
      )
    ORDER BY created_at ASC
    LIMIT 1;

    IF v_existing_id IS NOT NULL THEN
      -- Update existing item quantity
      UPDATE public.enquiry_items
      SET 
        quantity = COALESCE(quantity, 0) + COALESCE(p_quantity, 1),
        brand = COALESCE(p_brand, brand),
        notes = CASE 
          WHEN p_notes IS NOT NULL AND p_notes != '' THEN 
            COALESCE(notes || E'\n' || p_notes, p_notes)
          ELSE notes 
        END,
        target_rate = COALESCE(p_target_rate, target_rate),
        price_available = CASE WHEN p_price_available THEN true ELSE price_available END,
        updated_at = now()
      WHERE id = v_existing_id
      RETURNING * INTO v_item;

      RETURN jsonb_build_object(
        'action', 'updated',
        'id', v_item.id,
        'lead_id', v_item.lead_id,
        'product_query_text', v_item.product_query_text,
        'quantity', v_item.quantity,
        'brand', v_item.brand,
        'notes', v_item.notes
      );
    END IF;
  END IF;

  -- Otherwise, insert a new enquiry item
  SELECT COALESCE(MAX(sort_order), 0) + 1 INTO v_next_sort
  FROM public.enquiry_items
  WHERE lead_id = p_lead_id;

  INSERT INTO public.enquiry_items (
    lead_id,
    product_query_text,
    quantity,
    matched_product_id,
    brand,
    notes,
    target_rate,
    price_available,
    sort_order
  )
  VALUES (
    p_lead_id,
    v_clean_text,
    COALESCE(p_quantity, 1),
    p_matched_product_id,
    p_brand,
    p_notes,
    p_target_rate,
    COALESCE(p_price_available, false),
    v_next_sort
  )
  RETURNING * INTO v_item;

  -- Update lead status
  UPDATE public.leads
  SET 
    has_enquiry = true,
    enquiry_status = (CASE WHEN v_item.price_available THEN 'ready_to_quote' ELSE 'pending_prices' END)::public.enquiry_status
  WHERE id = p_lead_id;

  RETURN jsonb_build_object(
    'action', 'created',
    'id', v_item.id,
    'lead_id', v_item.lead_id,
    'product_query_text', v_item.product_query_text,
    'quantity', v_item.quantity,
    'brand', v_item.brand,
    'notes', v_item.notes
  );
END;
$$;

-- 3. Atomic qualification replacement & deduplication
CREATE OR REPLACE FUNCTION public.qualify_lead_enquiry_items(
  p_lead_id uuid,
  p_items jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item_elem jsonb;
  v_clean_text text;
  v_prod_id uuid;
  v_qty numeric;
  v_brand text;
  v_notes text;
  v_sort int := 1;
  v_inserted_ids jsonb := '[]'::jsonb;
  v_current_item record;
BEGIN
  IF p_lead_id IS NULL THEN
    RAISE EXCEPTION 'lead_id is required';
  END IF;

  -- Delete prior enquiry items for this lead safely
  DELETE FROM public.enquiry_items WHERE lead_id = p_lead_id;

  -- Ingest and deduplicate items
  FOR v_item_elem IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_clean_text := trim(COALESCE(v_item_elem->>'product_query_text', ''));
    IF v_clean_text = '' THEN
      CONTINUE;
    END IF;

    v_prod_id := NULL;
    IF (v_item_elem->>'product_id') IS NOT NULL AND (v_item_elem->>'product_id') != '' THEN
      v_prod_id := (v_item_elem->>'product_id')::uuid;
    END IF;

    v_qty := COALESCE((v_item_elem->>'quantity')::numeric, 1);
    v_brand := NULLIF(trim(COALESCE(v_item_elem->>'brand', '')), '');
    v_notes := NULLIF(trim(COALESCE(v_item_elem->>'notes', '')), '');

    -- Check if this exact product was already inserted in this qualification batch
    SELECT id, quantity INTO v_current_item
    FROM public.enquiry_items
    WHERE lead_id = p_lead_id
      AND (
        (v_prod_id IS NOT NULL AND matched_product_id = v_prod_id)
        OR
        (
          (v_prod_id IS NULL OR matched_product_id IS NULL)
          AND lower(trim(product_query_text)) = lower(v_clean_text)
        )
      )
    LIMIT 1;

    IF v_current_item.id IS NOT NULL THEN
      -- Merging duplicate within the same qualification!
      UPDATE public.enquiry_items
      SET 
        quantity = quantity + v_qty,
        brand = COALESCE(v_brand, brand),
        notes = CASE 
          WHEN v_notes IS NOT NULL THEN COALESCE(notes || E'\n' || v_notes, v_notes) 
          ELSE notes 
        END
      WHERE id = v_current_item.id;
    ELSE
      -- Insert new item
      INSERT INTO public.enquiry_items (
        lead_id,
        product_query_text,
        quantity,
        matched_product_id,
        brand,
        notes,
        sort_order
      )
      VALUES (
        p_lead_id,
        v_clean_text,
        v_qty,
        v_prod_id,
        v_brand,
        v_notes,
        v_sort
      )
      RETURNING id INTO v_current_item;

      v_sort := v_sort + 1;
    END IF;
  END LOOP;

  -- Mark lead as having an enquiry
  UPDATE public.leads
  SET 
    has_enquiry = true,
    enquiry_status = 'pending_prices'::public.enquiry_status
  WHERE id = p_lead_id;

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object('id', id, 'sort_order', sort_order, 'product_query_text', product_query_text, 'quantity', quantity)
    ORDER BY sort_order
  ), '[]'::jsonb)
  INTO v_inserted_ids
  FROM public.enquiry_items
  WHERE lead_id = p_lead_id;

  RETURN v_inserted_ids;
END;
$$;

GRANT EXECUTE ON FUNCTION public.add_or_update_enquiry_item TO authenticated, service_role, anon;
GRANT EXECUTE ON FUNCTION public.qualify_lead_enquiry_items TO authenticated, service_role, anon;
