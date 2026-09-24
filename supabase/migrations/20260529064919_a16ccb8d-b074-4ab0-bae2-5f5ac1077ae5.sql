
-- 1) Tighten customer visibility: remove the "any assigned lead" leak path
DROP POLICY IF EXISTS "Customers are viewable by authenticated users" ON public.customers;

CREATE POLICY "Customers are viewable by authenticated users"
ON public.customers FOR SELECT TO authenticated
USING (
  deleted_at IS NULL
  AND is_my_tenant(tenant_id)
  AND (
    is_admin_or_above(auth.uid())
    OR assigned_sales_id = auth.uid()
    OR assigned_sales_id = ANY(get_subordinate_ids(auth.uid()))
    OR (
      is_procurement_or_above(auth.uid())
      AND EXISTS (
        SELECT 1 FROM public.sales_orders so
        WHERE so.customer_id = customers.id
      )
    )
    OR EXISTS (
      SELECT 1 FROM public.cro_customer_assignments cca
      WHERE cca.customer_id = customers.id
        AND cca.cro_user_id = auth.uid()
    )
    OR has_role(auth.uid(), 'accounts'::app_role)
  )
);

-- 2) Repair stray live lead assignments so non-closed leads belong to the locked customer owner.
--    Leaves won/lost leads alone to preserve historical attribution.
UPDATE public.leads l
SET assigned_to = c.assigned_sales_id
FROM public.customers c
WHERE l.customer_id = c.id
  AND c.assigned_sales_id IS NOT NULL
  AND l.assigned_to IS DISTINCT FROM c.assigned_sales_id
  AND COALESCE(l.status::text, 'new') NOT IN ('won','lost')
  AND l.deleted_at IS NULL;
