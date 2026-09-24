CREATE TABLE public.qc_releases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID,
  sales_order_id UUID NOT NULL REFERENCES public.sales_orders(id) ON DELETE CASCADE,
  invoice_id UUID,
  quotation_id UUID,
  office_id UUID,
  notes TEXT,
  released_by UUID REFERENCES public.profiles(id),
  released_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.qc_release_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  release_id UUID NOT NULL REFERENCES public.qc_releases(id) ON DELETE CASCADE,
  sales_order_id UUID NOT NULL REFERENCES public.sales_orders(id) ON DELETE CASCADE,
  product_id UUID,
  source_type TEXT,
  source_item_id UUID,
  description TEXT,
  quantity NUMERIC NOT NULL DEFAULT 0,
  office_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_qc_releases_order ON public.qc_releases(sales_order_id);
CREATE INDEX idx_qc_release_items_order ON public.qc_release_items(sales_order_id);
CREATE INDEX idx_qc_release_items_release ON public.qc_release_items(release_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.qc_releases TO authenticated;
GRANT ALL ON public.qc_releases TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.qc_release_items TO authenticated;
GRANT ALL ON public.qc_release_items TO service_role;

ALTER TABLE public.qc_releases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qc_release_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Releases viewable by same tenant"
ON public.qc_releases FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.sales_orders so WHERE so.id = qc_releases.sales_order_id AND so.tenant_id = public.get_user_tenant_id(auth.uid())));

CREATE POLICY "QC and leadership can create releases"
ON public.qc_releases FOR INSERT TO authenticated
WITH CHECK (
  (public.has_role(auth.uid(), 'qc'::app_role) OR public.is_manager_or_above(auth.uid()))
  AND EXISTS (SELECT 1 FROM public.sales_orders so WHERE so.id = qc_releases.sales_order_id AND so.tenant_id = public.get_user_tenant_id(auth.uid()))
);

CREATE POLICY "QC and leadership can update releases"
ON public.qc_releases FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'qc'::app_role) OR public.is_manager_or_above(auth.uid()));

CREATE POLICY "QC and leadership can delete releases"
ON public.qc_releases FOR DELETE TO authenticated
USING (public.is_manager_or_above(auth.uid()));

CREATE POLICY "Release items viewable by same tenant"
ON public.qc_release_items FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.sales_orders so WHERE so.id = qc_release_items.sales_order_id AND so.tenant_id = public.get_user_tenant_id(auth.uid())));

CREATE POLICY "QC and leadership can create release items"
ON public.qc_release_items FOR INSERT TO authenticated
WITH CHECK (
  (public.has_role(auth.uid(), 'qc'::app_role) OR public.is_manager_or_above(auth.uid()))
  AND EXISTS (SELECT 1 FROM public.sales_orders so WHERE so.id = qc_release_items.sales_order_id AND so.tenant_id = public.get_user_tenant_id(auth.uid()))
);

CREATE POLICY "QC and leadership can update release items"
ON public.qc_release_items FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'qc'::app_role) OR public.is_manager_or_above(auth.uid()));

CREATE POLICY "QC and leadership can delete release items"
ON public.qc_release_items FOR DELETE TO authenticated
USING (public.is_manager_or_above(auth.uid()));