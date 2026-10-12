-- Migration: Prevent duplicate Purchase Order (PO) creation with idempotency and concurrency guards

-- 1. Add idempotency_key column to public.purchase_orders
ALTER TABLE public.purchase_orders ADD COLUMN IF NOT EXISTS idempotency_key text;

-- 2. Create unique index for idempotency lookup
CREATE UNIQUE INDEX IF NOT EXISTS idx_purchase_orders_idempotency_key
ON public.purchase_orders (idempotency_key)
WHERE idempotency_key IS NOT NULL;

-- 3. Create index for recent duplicate detection
CREATE INDEX IF NOT EXISTS idx_purchase_orders_recent_dup_check
ON public.purchase_orders (created_by, supplier_id, created_at DESC);

-- 4. Create atomic secure purchase order creation procedure
CREATE OR REPLACE FUNCTION public.create_purchase_order_secure(payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_payload jsonb := COALESCE(payload, '{}'::jsonb);
  v_idempotency_key text;
  v_supplier_id uuid;
  v_sales_order_id uuid;
  v_lead_id uuid;
  v_quotation_id uuid;
  v_supplier_quotation_id uuid;
  v_order_date date;
  v_expected_delivery date;
  v_notes text;
  v_terms text;
  v_currency text;
  v_exchange_rate numeric;
  v_vertical_id uuid;
  v_items jsonb;
  v_item jsonb;
  v_subtotal numeric := 0;
  v_total_tax numeric := 0;
  v_grand_total numeric := 0;
  v_item_amount numeric;
  v_item_tax numeric;
  v_item_qty numeric;
  v_item_rate numeric;
  v_item_tax_pct numeric;
  v_existing_po public.purchase_orders%ROWTYPE;
  v_lock_key bigint;
  v_idx int := 0;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED';
  END IF;

  v_idempotency_key := NULLIF(trim(v_payload->>'idempotency_key'), '');
  v_supplier_id := NULLIF(v_payload->>'supplier_id', '')::uuid;
  v_sales_order_id := NULLIF(v_payload->>'sales_order_id', '')::uuid;
  v_lead_id := NULLIF(v_payload->>'lead_id', '')::uuid;
  v_quotation_id := NULLIF(v_payload->>'quotation_id', '')::uuid;
  v_supplier_quotation_id := NULLIF(v_payload->>'supplier_quotation_id', '')::uuid;
  v_order_date := COALESCE(NULLIF(v_payload->>'order_date', '')::date, CURRENT_DATE);
  v_expected_delivery := NULLIF(v_payload->>'expected_delivery', '')::date;
  v_notes := NULLIF(trim(v_payload->>'notes'), '');
  v_terms := NULLIF(trim(v_payload->>'terms_conditions'), '');
  v_currency := COALESCE(NULLIF(trim(v_payload->>'currency'), ''), 'INR');
  v_exchange_rate := COALESCE(NULLIF(v_payload->>'exchange_rate', '')::numeric, 1);
  v_vertical_id := NULLIF(v_payload->>'vertical_id', '')::uuid;
  v_items := COALESCE(v_payload->'items', '[]'::jsonb);

  -- -------------------------------------------------------------
  -- CONCURRENCY CONTROL: Transaction-level Advisory Lock
  -- Serializes rapid duplicate clicks from the same user
  -- -------------------------------------------------------------
  IF v_idempotency_key IS NOT NULL THEN
    v_lock_key := hashtext('po:' || v_user_id::text || ':' || v_idempotency_key);
  ELSE
    v_lock_key := hashtext('po:' || v_user_id::text || ':' || COALESCE(v_supplier_id::text, 'nosup') || ':' || COALESCE(v_sales_order_id::text, 'noso'));
  END IF;
  PERFORM pg_advisory_xact_lock(v_lock_key);

  -- -------------------------------------------------------------
  -- CHECK 1: Idempotency Key Match
  -- If client sent an idempotency key and PO already exists, return it
  -- -------------------------------------------------------------
  IF v_idempotency_key IS NOT NULL THEN
    SELECT * INTO v_existing_po
    FROM public.purchase_orders
    WHERE idempotency_key = v_idempotency_key
    LIMIT 1;

    IF v_existing_po.id IS NOT NULL THEN
      RETURN to_jsonb(v_existing_po);
    END IF;
  END IF;

  -- -------------------------------------------------------------
  -- CHECK 2: Rapid Duplicate Submission Guard (within last 15 seconds)
  -- Same user, same supplier, same sales_order_id created very recently
  -- -------------------------------------------------------------
  SELECT * INTO v_existing_po
  FROM public.purchase_orders
  WHERE created_by = v_user_id
    AND supplier_id IS NOT DISTINCT FROM v_supplier_id
    AND sales_order_id IS NOT DISTINCT FROM v_sales_order_id
    AND created_at >= (now() - interval '15 seconds')
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_existing_po.id IS NOT NULL THEN
    RETURN to_jsonb(v_existing_po);
  END IF;

  -- Calculate item totals
  FOR v_item IN SELECT * FROM jsonb_array_elements(v_items)
  LOOP
    v_item_qty := COALESCE((v_item->>'quantity')::numeric, 0);
    v_item_rate := COALESCE((v_item->>'rate')::numeric, 0);
    v_item_tax_pct := COALESCE((v_item->>'tax_percent')::numeric, 18);
    v_item_amount := v_item_qty * v_item_rate;
    v_item_tax := (v_item_amount * v_item_tax_pct) / 100.0;
    v_subtotal := v_subtotal + v_item_amount;
    v_total_tax := v_total_tax + v_item_tax;
  END LOOP;
  v_grand_total := v_subtotal + v_total_tax;

  -- If vertical_id is not specified, inherit from sales_order if linked
  IF v_vertical_id IS NULL AND v_sales_order_id IS NOT NULL THEN
    SELECT vertical_id INTO v_vertical_id FROM public.sales_orders WHERE id = v_sales_order_id;
  END IF;

  -- Insert purchase order (po_number will be set by zzz_generate_po_number_trigger)
  INSERT INTO public.purchase_orders (
    po_number,
    supplier_id,
    sales_order_id,
    lead_id,
    quotation_id,
    supplier_quotation_id,
    order_date,
    expected_delivery,
    notes,
    terms_conditions,
    currency,
    exchange_rate,
    vertical_id,
    created_by,
    subtotal,
    total_tax,
    grand_total,
    status,
    idempotency_key
  ) VALUES (
    '',
    v_supplier_id,
    v_sales_order_id,
    v_lead_id,
    v_quotation_id,
    v_supplier_quotation_id,
    v_order_date,
    v_expected_delivery,
    v_notes,
    v_terms,
    v_currency,
    v_exchange_rate,
    v_vertical_id,
    v_user_id,
    v_subtotal,
    v_total_tax,
    v_grand_total,
    'draft',
    v_idempotency_key
  )
  RETURNING * INTO v_existing_po;

  -- Insert purchase order items
  v_idx := 0;
  FOR v_item IN SELECT * FROM jsonb_array_elements(v_items)
  LOOP
    v_item_qty := COALESCE((v_item->>'quantity')::numeric, 0);
    v_item_rate := COALESCE((v_item->>'rate')::numeric, 0);
    v_item_tax_pct := COALESCE((v_item->>'tax_percent')::numeric, 18);
    v_item_amount := v_item_qty * v_item_rate;
    v_item_tax := (v_item_amount * v_item_tax_pct) / 100.0;

    INSERT INTO public.purchase_order_items (
      po_id,
      product_id,
      description,
      hsn_code,
      quantity,
      rate,
      tax_percent,
      tax_amount,
      amount,
      received_quantity,
      sort_order
    ) VALUES (
      v_existing_po.id,
      NULLIF(v_item->>'product_id', '')::uuid,
      COALESCE(NULLIF(trim(v_item->>'description'), ''), 'Item'),
      NULLIF(trim(v_item->>'hsn_code'), ''),
      v_item_qty,
      v_item_rate,
      v_item_tax_pct,
      v_item_tax,
      v_item_amount + v_item_tax,
      0,
      v_idx
    );
    v_idx := v_idx + 1;
  END LOOP;

  -- Auto-update sales order status to 'in_procurement' if linked
  IF v_sales_order_id IS NOT NULL THEN
    UPDATE public.sales_orders
    SET status = 'in_procurement'
    WHERE id = v_sales_order_id
      AND status IN ('ready_for_procurement', 'pending_documents');
  END IF;

  RETURN to_jsonb(v_existing_po);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.create_purchase_order_secure(jsonb) TO authenticated;
