
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_procurement_approver boolean NOT NULL DEFAULT false;
UPDATE public.profiles SET is_procurement_approver = true WHERE lower(email) = 'anujmaurya@gravenautomation.com';

CREATE OR REPLACE FUNCTION public.is_bulk_price_approver(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT is_procurement_approver FROM public.profiles WHERE id = _user_id),
    false
  ) OR EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = _user_id AND ur.role IN ('super_admin'::app_role, 'coo'::app_role)
  );
$$;

ALTER TABLE public.price_submission_items
  ADD COLUMN IF NOT EXISTS model_number text,
  ADD COLUMN IF NOT EXISTS rmb_price numeric(18,4),
  ADD COLUMN IF NOT EXISTS rmb_usd_rate numeric(18,6) DEFAULT 6.79,
  ADD COLUMN IF NOT EXISTS usd_inr_rate numeric(18,6) DEFAULT 96,
  ADD COLUMN IF NOT EXISTS weight_kg numeric(18,4),
  ADD COLUMN IF NOT EXISTS freight_usd_per_kg numeric(18,4) DEFAULT 6,
  ADD COLUMN IF NOT EXISTS insurance_pct numeric(9,4) DEFAULT 2,
  ADD COLUMN IF NOT EXISTS cc_pct numeric(9,4) DEFAULT 3,
  ADD COLUMN IF NOT EXISTS computed_usd_landed numeric(18,4),
  ADD COLUMN IF NOT EXISTS computed_inr_per_unit numeric(18,2),
  ADD COLUMN IF NOT EXISTS computed_inr_total numeric(18,2),
  ADD COLUMN IF NOT EXISTS approved_by uuid,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS product_id uuid;

UPDATE public.price_submission_items
SET rmb_usd_rate = COALESCE(rmb_usd_rate, 6.79),
    usd_inr_rate = COALESCE(usd_inr_rate, 96),
    freight_usd_per_kg = COALESCE(freight_usd_per_kg, 6),
    insurance_pct = COALESCE(insurance_pct, 2),
    cc_pct = COALESCE(cc_pct, 3),
    duty_pct = COALESCE(NULLIF(duty_pct,0), 7.5),
    expense_pct = COALESCE(NULLIF(expense_pct,0), 12),
    margin_pct = COALESCE(NULLIF(margin_pct,0), 10),
    negotiation_pct = COALESCE(NULLIF(negotiation_pct,0), 1),
    rmb_price = COALESCE(rmb_price, cny_unit_price),
    model_number = COALESCE(model_number, hsn_code, item_name);

DROP POLICY IF EXISTS "Tenant members read batches" ON public.price_submission_batches;
DROP POLICY IF EXISTS "Tenant members update batches" ON public.price_submission_batches;
DROP POLICY IF EXISTS "Tenant members read items" ON public.price_submission_items;
DROP POLICY IF EXISTS "Tenant members update items" ON public.price_submission_items;
DROP POLICY IF EXISTS "Tenant members insert items" ON public.price_submission_items;
DROP POLICY IF EXISTS "Tenant members delete items" ON public.price_submission_items;

CREATE POLICY "Read own or approver" ON public.price_submission_batches FOR SELECT TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid())
         AND (submitted_by = auth.uid() OR public.is_bulk_price_approver(auth.uid())));

CREATE POLICY "Approver updates batches" ON public.price_submission_batches FOR UPDATE TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid()) AND public.is_bulk_price_approver(auth.uid()))
  WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()));

CREATE POLICY "Read items own or approver" ON public.price_submission_items FOR SELECT TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid())
         AND (public.is_bulk_price_approver(auth.uid())
              OR EXISTS (SELECT 1 FROM public.price_submission_batches b
                         WHERE b.id = batch_id AND b.submitted_by = auth.uid())));

CREATE POLICY "Insert items own batch" ON public.price_submission_items FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid())
              AND EXISTS (SELECT 1 FROM public.price_submission_batches b
                          WHERE b.id = batch_id AND b.submitted_by = auth.uid()));

CREATE POLICY "Approver updates items" ON public.price_submission_items FOR UPDATE TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid()) AND public.is_bulk_price_approver(auth.uid()))
  WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()));

CREATE POLICY "Delete items own pending" ON public.price_submission_items FOR DELETE TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid())
         AND EXISTS (SELECT 1 FROM public.price_submission_batches b
                     WHERE b.id = batch_id AND b.submitted_by = auth.uid() AND b.status IN ('draft','pending_review')));

CREATE OR REPLACE FUNCTION public.approve_price_item(_item_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_item public.price_submission_items%ROWTYPE;
  v_batch public.price_submission_batches%ROWTYPE;
  v_tenant uuid;
  v_product_id uuid;
  v_old_rate numeric;
  v_landed numeric;
  v_model text;
  v_name text;
BEGIN
  IF NOT public.is_bulk_price_approver(auth.uid()) THEN
    RAISE EXCEPTION 'Not authorised to approve price items';
  END IF;

  SELECT * INTO v_item FROM public.price_submission_items WHERE id = _item_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Item % not found', _item_id; END IF;
  SELECT * INTO v_batch FROM public.price_submission_batches WHERE id = v_item.batch_id;

  v_tenant := v_item.tenant_id;
  v_landed := COALESCE(v_item.computed_inr_per_unit, 0);
  v_model := COALESCE(NULLIF(TRIM(v_item.model_number), ''), NULLIF(TRIM(v_item.hsn_code), ''), NULLIF(TRIM(v_item.item_name), ''));
  v_name  := COALESCE(NULLIF(TRIM(v_item.item_name), ''), v_model);

  IF v_model IS NULL THEN RAISE EXCEPTION 'Item missing model number'; END IF;
  IF v_landed <= 0 THEN RAISE EXCEPTION 'Item has no computed INR price - fill the calculator first'; END IF;

  SELECT id, purchase_price INTO v_product_id, v_old_rate
  FROM public.products
  WHERE tenant_id = v_tenant AND hsn_code = v_model
  LIMIT 1;

  IF v_product_id IS NULL THEN
    INSERT INTO public.products (tenant_id, name, hsn_code, unit, default_rate, purchase_price, preferred_supplier_id, is_active, price_updated_at, price_updated_by)
    VALUES (v_tenant, v_name, v_model, 'PCS', v_landed, v_landed, v_batch.supplier_id, true, now(), auth.uid())
    RETURNING id INTO v_product_id;
  ELSE
    UPDATE public.products
      SET purchase_price = v_landed,
          default_rate = GREATEST(COALESCE(default_rate,0), v_landed),
          preferred_supplier_id = COALESCE(v_batch.supplier_id, preferred_supplier_id),
          price_updated_at = now(),
          price_updated_by = auth.uid(),
          updated_at = now()
      WHERE id = v_product_id;
  END IF;

  INSERT INTO public.product_price_history (product_id, old_rate, new_rate, supplier_id, changed_by, change_reason, source, reference_id)
  VALUES (v_product_id, COALESCE(v_old_rate, 0), v_landed, v_batch.supplier_id, auth.uid(), 'Bulk price approval', 'bulk_price_batch', v_item.batch_id);

  UPDATE public.price_submission_items
    SET approved = true, approved_by = auth.uid(), approved_at = now(), product_id = v_product_id
    WHERE id = _item_id;

  RETURN v_product_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.approve_price_item(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_bulk_price_approver(uuid) TO authenticated;
