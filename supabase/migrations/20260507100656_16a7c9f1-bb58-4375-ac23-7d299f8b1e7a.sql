
-- Add richer pricing fields to price_requests
ALTER TABLE public.price_requests
  ADD COLUMN IF NOT EXISTS purchase_price numeric,
  ADD COLUMN IF NOT EXISTS selling_price numeric,
  ADD COLUMN IF NOT EXISTS seller_name text,
  ADD COLUMN IF NOT EXISTS lead_time_days integer;

-- Allow procurement assignees to read the enquiry_items they need to price
DROP POLICY IF EXISTS "Procurement assignees can view their enquiry items" ON public.enquiry_items;
CREATE POLICY "Procurement assignees can view their enquiry items"
ON public.enquiry_items
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.price_requests pr
    WHERE pr.enquiry_item_id = enquiry_items.id
      AND (pr.assigned_to = auth.uid() OR pr.requested_by = auth.uid())
      AND public.is_my_tenant(pr.tenant_id)
  )
);

-- Allow procurement assignees to read the parent lead so embeds + customer joins work
DROP POLICY IF EXISTS "Procurement assignees can view related leads" ON public.leads;
CREATE POLICY "Procurement assignees can view related leads"
ON public.leads
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.price_requests pr
    WHERE pr.lead_id = leads.id
      AND (pr.assigned_to = auth.uid() OR pr.requested_by = auth.uid())
      AND public.is_my_tenant(pr.tenant_id)
  )
);
