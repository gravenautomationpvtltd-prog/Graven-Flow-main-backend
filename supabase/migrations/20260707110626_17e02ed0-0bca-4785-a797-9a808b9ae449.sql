
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS preferred_currency text;
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS default_landed_cost_config jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE TABLE IF NOT EXISTS public.price_submission_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  supplier_id uuid REFERENCES public.suppliers(id) ON DELETE SET NULL,
  supplier_name text,
  submitted_by uuid NOT NULL,
  reviewed_by uuid,
  status text NOT NULL DEFAULT 'pending_review',
  source_currency text NOT NULL DEFAULT 'CNY',
  raw_paste text,
  notes text,
  attachments jsonb NOT NULL DEFAULT '[]'::jsonb,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.price_submission_batches TO authenticated;
GRANT ALL ON public.price_submission_batches TO service_role;
ALTER TABLE public.price_submission_batches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members read batches" ON public.price_submission_batches FOR SELECT TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid()));
CREATE POLICY "Submitter inserts own batch" ON public.price_submission_batches FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()) AND submitted_by = auth.uid());
CREATE POLICY "Tenant members update batches" ON public.price_submission_batches FOR UPDATE TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid()))
  WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()));
CREATE POLICY "Submitter deletes own pending batch" ON public.price_submission_batches FOR DELETE TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid()) AND submitted_by = auth.uid() AND status IN ('draft','pending_review'));

CREATE INDEX IF NOT EXISTS idx_psb_tenant ON public.price_submission_batches(tenant_id);
CREATE INDEX IF NOT EXISTS idx_psb_status ON public.price_submission_batches(status);
CREATE INDEX IF NOT EXISTS idx_psb_submitter ON public.price_submission_batches(submitted_by);

CREATE TABLE IF NOT EXISTS public.price_submission_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL REFERENCES public.price_submission_batches(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL,
  line_no int NOT NULL DEFAULT 1,
  raw_text text,
  item_name text NOT NULL,
  matched_product_id uuid,
  hsn_code text,
  qty numeric(18,4) NOT NULL DEFAULT 1,
  unit_weight_kg numeric(18,4),
  cny_unit_price numeric(18,4) NOT NULL DEFAULT 0,
  source_currency text NOT NULL DEFAULT 'CNY',
  fx_rate numeric(18,6),
  freight_mode text NOT NULL DEFAULT 'per_kg',
  freight_per_kg numeric(18,4),
  freight_flat numeric(18,4),
  duty_pct numeric(9,4) NOT NULL DEFAULT 0,
  expense_pct numeric(9,4) NOT NULL DEFAULT 0,
  margin_pct numeric(9,4) NOT NULL DEFAULT 0,
  negotiation_pct numeric(9,4) NOT NULL DEFAULT 0,
  inr_base numeric(18,2),
  freight_total numeric(18,2),
  duty_amount numeric(18,2),
  expense_amount numeric(18,2),
  landed_inr numeric(18,2),
  final_inr_total numeric(18,2),
  final_inr_unit numeric(18,2),
  approved boolean NOT NULL DEFAULT false,
  rejection_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.price_submission_items TO authenticated;
GRANT ALL ON public.price_submission_items TO service_role;
ALTER TABLE public.price_submission_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members read items" ON public.price_submission_items FOR SELECT TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid()));
CREATE POLICY "Tenant members insert items" ON public.price_submission_items FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()));
CREATE POLICY "Tenant members update items" ON public.price_submission_items FOR UPDATE TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid()))
  WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()));
CREATE POLICY "Tenant members delete items" ON public.price_submission_items FOR DELETE TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid()));

CREATE INDEX IF NOT EXISTS idx_psi_batch ON public.price_submission_items(batch_id);
CREATE INDEX IF NOT EXISTS idx_psi_tenant ON public.price_submission_items(tenant_id);

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS trg_psb_updated ON public.price_submission_batches;
CREATE TRIGGER trg_psb_updated BEFORE UPDATE ON public.price_submission_batches
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
DROP TRIGGER IF EXISTS trg_psi_updated ON public.price_submission_items;
CREATE TRIGGER trg_psi_updated BEFORE UPDATE ON public.price_submission_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.fx_rates (from_currency, to_currency, rate, rate_date, source)
SELECT 'CNY','INR',11.80,CURRENT_DATE,'seed'
WHERE NOT EXISTS (
  SELECT 1 FROM public.fx_rates WHERE from_currency='CNY' AND to_currency='INR' AND rate_date=CURRENT_DATE
);
