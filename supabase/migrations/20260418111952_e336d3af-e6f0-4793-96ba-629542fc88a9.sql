-- 1) Add tenant_id to price_requests for direct, durable scoping
ALTER TABLE public.price_requests
  ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id);

-- 2) Backfill tenant_id from the related lead
UPDATE public.price_requests pr
SET tenant_id = l.tenant_id
FROM public.leads l
WHERE pr.lead_id = l.id
  AND pr.tenant_id IS NULL
  AND l.tenant_id IS NOT NULL;

-- 3) Trigger to auto-set tenant_id on insert (from lead) so it never goes missing
CREATE OR REPLACE FUNCTION public.set_price_request_tenant()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.tenant_id IS NULL AND NEW.lead_id IS NOT NULL THEN
    SELECT tenant_id INTO NEW.tenant_id FROM public.leads WHERE id = NEW.lead_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_price_request_tenant ON public.price_requests;
CREATE TRIGGER trg_set_price_request_tenant
BEFORE INSERT ON public.price_requests
FOR EACH ROW EXECUTE FUNCTION public.set_price_request_tenant();

-- 4) Replace fragile SELECT policy with tenant_id-based one (with safe fallback)
DROP POLICY IF EXISTS "Price requests viewable by same tenant" ON public.price_requests;
CREATE POLICY "Price requests viewable by same tenant"
ON public.price_requests
FOR SELECT
USING (
  (tenant_id IS NOT NULL AND public.is_my_tenant(tenant_id))
  OR (tenant_id IS NULL AND public.is_same_tenant(requested_by))
);

-- 5) Helpful index for the queue queries
CREATE INDEX IF NOT EXISTS idx_price_requests_tenant_status ON public.price_requests(tenant_id, status);