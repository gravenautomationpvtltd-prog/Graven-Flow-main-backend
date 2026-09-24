CREATE TABLE public.shipping_labels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  dispatch_id UUID NOT NULL UNIQUE REFERENCES public.dispatches(id) ON DELETE CASCADE,
  box_count INTEGER NOT NULL DEFAULT 1,
  label_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  file_name TEXT,
  file_url TEXT,
  generated_by UUID,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.shipping_labels TO authenticated;
GRANT ALL ON public.shipping_labels TO service_role;

ALTER TABLE public.shipping_labels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant users can view shipping labels"
ON public.shipping_labels FOR SELECT TO authenticated
USING (tenant_id = public.get_user_tenant_id(auth.uid()));

CREATE POLICY "Tenant users can create shipping labels"
ON public.shipping_labels FOR INSERT TO authenticated
WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()));

CREATE POLICY "Tenant users can update shipping labels"
ON public.shipping_labels FOR UPDATE TO authenticated
USING (tenant_id = public.get_user_tenant_id(auth.uid()))
WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()));

CREATE POLICY "Tenant users can delete shipping labels"
ON public.shipping_labels FOR DELETE TO authenticated
USING (tenant_id = public.get_user_tenant_id(auth.uid()));

CREATE INDEX idx_shipping_labels_dispatch ON public.shipping_labels(dispatch_id);