CREATE POLICY "Procurement can view enquiry items behind price requests"
ON public.enquiry_items
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.price_requests pr
    WHERE pr.enquiry_item_id = enquiry_items.id
      AND public.is_my_tenant(pr.tenant_id)
  )
  AND (
    public.has_role(auth.uid(), 'procurement')
    OR public.has_role(auth.uid(), 'procurement_manager')
    OR public.has_role(auth.uid(), 'import_procurement')
    OR public.has_role(auth.uid(), 'cct')
  )
);