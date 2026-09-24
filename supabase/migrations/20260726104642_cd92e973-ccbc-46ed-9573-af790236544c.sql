
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS model_number text,
  ADD COLUMN IF NOT EXISTS list_price numeric,
  ADD COLUMN IF NOT EXISTS list_price_source text,
  ADD COLUMN IF NOT EXISTS list_price_updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS min_margin_pct numeric NOT NULL DEFAULT 0;

CREATE UNIQUE INDEX IF NOT EXISTS products_tenant_model_unique
  ON public.products (tenant_id, upper(model_number))
  WHERE model_number IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_products_model_number
  ON public.products (upper(model_number))
  WHERE model_number IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.list_price_uploads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  brand text NOT NULL,
  source_label text NOT NULL,
  filename text,
  storage_path text,
  default_discount_pct numeric NOT NULL DEFAULT 60,
  rows_parsed integer NOT NULL DEFAULT 0,
  rows_inserted integer NOT NULL DEFAULT 0,
  rows_updated integer NOT NULL DEFAULT 0,
  rows_skipped integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'completed',
  notes text,
  uploaded_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.list_price_uploads TO authenticated;
GRANT ALL ON public.list_price_uploads TO service_role;

ALTER TABLE public.list_price_uploads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lp_uploads_tenant_read"
  ON public.list_price_uploads FOR SELECT
  TO authenticated
  USING (
    tenant_id = public.get_user_tenant_id(auth.uid())
    AND (
      public.has_role(auth.uid(), 'super_admin')
      OR public.has_role(auth.uid(), 'coo')
      OR public.has_role(auth.uid(), 'manager')
      OR public.has_role(auth.uid(), 'procurement')
      OR public.has_role(auth.uid(), 'procurement_manager')
      OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_procurement_approver = true)
    )
  );

CREATE POLICY "lp_uploads_tenant_write"
  ON public.list_price_uploads FOR INSERT
  TO authenticated
  WITH CHECK (
    tenant_id = public.get_user_tenant_id(auth.uid())
    AND (
      public.has_role(auth.uid(), 'super_admin')
      OR public.has_role(auth.uid(), 'coo')
      OR public.has_role(auth.uid(), 'manager')
      OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_procurement_approver = true)
    )
  );
