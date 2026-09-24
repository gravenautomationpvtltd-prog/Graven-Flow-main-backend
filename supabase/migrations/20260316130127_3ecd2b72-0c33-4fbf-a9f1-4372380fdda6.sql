-- 1. Scope Customers SELECT policy: managers only see their own + subordinates' customers
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
    OR EXISTS (
      SELECT 1 FROM leads
      WHERE leads.customer_id = customers.id
        AND leads.assigned_to = auth.uid()
    )
    OR (is_procurement_or_above(auth.uid()) AND EXISTS (
      SELECT 1 FROM sales_orders
      WHERE sales_orders.customer_id = customers.id
    ))
    OR EXISTS (
      SELECT 1 FROM cro_customer_assignments
      WHERE cro_customer_assignments.customer_id = customers.id
        AND cro_customer_assignments.cro_user_id = auth.uid()
    )
  )
);

-- 2. Scope Quotations SELECT policy
DROP POLICY IF EXISTS "Quotations viewable by authenticated users" ON public.quotations;
CREATE POLICY "Quotations viewable by authenticated users"
ON public.quotations FOR SELECT TO authenticated
USING (
  is_my_tenant(tenant_id)
  AND (
    is_admin_or_above(auth.uid())
    OR created_by = auth.uid()
    OR created_by = ANY(get_subordinate_ids(auth.uid()))
    OR is_procurement_or_above(auth.uid())
  )
);

-- 3. Scope Sales Orders SELECT policy
DROP POLICY IF EXISTS "Sales orders viewable by authenticated users" ON public.sales_orders;
CREATE POLICY "Sales orders viewable by authenticated users"
ON public.sales_orders FOR SELECT TO authenticated
USING (
  is_my_tenant(tenant_id)
  AND (
    is_admin_or_above(auth.uid())
    OR created_by = auth.uid()
    OR created_by = ANY(get_subordinate_ids(auth.uid()))
    OR is_procurement_or_above(auth.uid())
  )
);