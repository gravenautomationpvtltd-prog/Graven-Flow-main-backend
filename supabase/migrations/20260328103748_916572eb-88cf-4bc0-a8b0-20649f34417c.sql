
-- Add accounts role to sales_orders SELECT policy
DROP POLICY IF EXISTS "Sales orders viewable by authenticated users" ON public.sales_orders;
CREATE POLICY "Sales orders viewable by authenticated users" ON public.sales_orders
  FOR SELECT TO authenticated
  USING (
    is_my_tenant(tenant_id)
    AND (
      is_admin_or_above(auth.uid())
      OR created_by = auth.uid()
      OR created_by = ANY(get_subordinate_ids(auth.uid()))
      OR is_procurement_or_above(auth.uid())
      OR has_role(auth.uid(), 'accounts')
    )
  );

-- Add accounts role to sales_orders UPDATE policy
DROP POLICY IF EXISTS "Creator and managers can update orders" ON public.sales_orders;
CREATE POLICY "Creator and managers can update orders" ON public.sales_orders
  FOR UPDATE TO authenticated
  USING (
    is_my_tenant(tenant_id)
    AND (
      created_by = auth.uid()
      OR is_manager_or_above(auth.uid())
      OR is_procurement_or_above(auth.uid())
      OR has_role(auth.uid(), 'accounts')
    )
  );
