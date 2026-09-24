-- Helper: is the current user a branch-scoped manager?
CREATE OR REPLACE FUNCTION public.is_branch_manager(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_branch_scoped_role(_user_id)
     AND public.has_role(_user_id, 'manager'::public.app_role);
$$;

-- LEADS: extend SELECT + UPDATE to allow branch managers in same office
DROP POLICY IF EXISTS "Lead visibility by role hierarchy" ON public.leads;
CREATE POLICY "Lead visibility by role hierarchy" ON public.leads
FOR SELECT USING (
  is_my_tenant(tenant_id) AND branch_guard(office_id) AND (
    is_admin_or_above(auth.uid())
    OR (assigned_to = auth.uid())
    OR (is_manager_or_above(auth.uid()) AND (assigned_to = ANY (get_subordinate_ids(auth.uid()))))
    OR (is_branch_manager(auth.uid()) AND office_id = current_user_office_id())
    OR ((customer_id IS NOT NULL) AND (customer_id = ANY (get_user_cro_customer_ids(auth.uid()))))
    OR (id = ANY (get_user_quotation_lead_ids(auth.uid())))
    OR (id = ANY (get_user_qualified_lead_ids(auth.uid())))
    OR was_recent_lead_assignee(id, auth.uid())
  )
);

DROP POLICY IF EXISTS "Users can update leads they can access" ON public.leads;
CREATE POLICY "Users can update leads they can access" ON public.leads
FOR UPDATE
USING (
  is_my_tenant(tenant_id) AND branch_guard(office_id) AND (
    is_admin_or_above(auth.uid())
    OR (assigned_to = auth.uid())
    OR (is_manager_or_above(auth.uid()) AND (assigned_to = ANY (get_subordinate_ids(auth.uid()))))
    OR (is_branch_manager(auth.uid()) AND office_id = current_user_office_id())
  )
)
WITH CHECK (is_my_tenant(tenant_id) AND branch_write_guard(office_id));

-- QUOTATIONS
DROP POLICY IF EXISTS "Quotations viewable by authenticated users" ON public.quotations;
CREATE POLICY "Quotations viewable by authenticated users" ON public.quotations
FOR SELECT USING (
  is_my_tenant(tenant_id) AND branch_guard(office_id) AND (
    is_admin_or_above(auth.uid())
    OR (created_by = auth.uid())
    OR (created_by = ANY (get_subordinate_ids(auth.uid())))
    OR (is_branch_manager(auth.uid()) AND office_id = current_user_office_id())
    OR is_procurement_or_above(auth.uid())
  )
);

DROP POLICY IF EXISTS "Creator and managers can update quotations" ON public.quotations;
CREATE POLICY "Creator and managers can update quotations" ON public.quotations
FOR UPDATE
USING (
  is_my_tenant(tenant_id) AND branch_guard(office_id) AND (
    is_admin_or_above(auth.uid())
    OR (created_by = auth.uid())
    OR (is_manager_or_above(auth.uid()) AND (created_by = ANY (get_subordinate_ids(auth.uid()))))
    OR (is_branch_manager(auth.uid()) AND office_id = current_user_office_id())
  )
)
WITH CHECK (is_my_tenant(tenant_id) AND branch_write_guard(office_id));

-- SALES ORDERS
DROP POLICY IF EXISTS "Sales orders viewable by authenticated users" ON public.sales_orders;
CREATE POLICY "Sales orders viewable by authenticated users" ON public.sales_orders
FOR SELECT USING (
  is_my_tenant(tenant_id) AND branch_guard(office_id) AND (
    is_admin_or_above(auth.uid())
    OR (created_by = auth.uid())
    OR (created_by = ANY (get_subordinate_ids(auth.uid())))
    OR (is_branch_manager(auth.uid()) AND office_id = current_user_office_id())
    OR is_procurement_or_above(auth.uid())
    OR has_role(auth.uid(), 'accounts'::app_role)
  )
);

DROP POLICY IF EXISTS "Creator and managers can update orders" ON public.sales_orders;
CREATE POLICY "Creator and managers can update orders" ON public.sales_orders
FOR UPDATE
USING (
  is_my_tenant(tenant_id) AND (
    is_admin_or_above(auth.uid())
    OR is_procurement_or_above(auth.uid())
    OR has_role(auth.uid(), 'accounts'::app_role)
    OR (branch_guard(office_id) AND (
      (created_by = auth.uid())
      OR (is_manager_or_above(auth.uid()) AND (created_by = ANY (get_subordinate_ids(auth.uid()))))
      OR (is_branch_manager(auth.uid()) AND office_id = current_user_office_id())
    ))
  )
)
WITH CHECK (is_my_tenant(tenant_id) AND branch_write_guard(office_id));

-- CUSTOMERS
DROP POLICY IF EXISTS "Customers are viewable by authenticated users" ON public.customers;
CREATE POLICY "Customers are viewable by authenticated users" ON public.customers
FOR SELECT USING (
  (deleted_at IS NULL) AND is_my_tenant(tenant_id) AND branch_guard(office_id) AND (
    is_admin_or_above(auth.uid())
    OR (assigned_sales_id = auth.uid())
    OR (assigned_sales_id = ANY (get_subordinate_ids(auth.uid())))
    OR (is_branch_manager(auth.uid()) AND office_id = current_user_office_id())
    OR (is_procurement_or_above(auth.uid()) AND EXISTS (SELECT 1 FROM sales_orders so WHERE so.customer_id = customers.id))
    OR EXISTS (SELECT 1 FROM cro_customer_assignments cca WHERE cca.customer_id = customers.id AND cca.cro_user_id = auth.uid())
    OR has_role(auth.uid(), 'accounts'::app_role)
  )
);

DROP POLICY IF EXISTS "Sales and above can update customers" ON public.customers;
CREATE POLICY "Sales and above can update customers" ON public.customers
FOR UPDATE
USING (
  is_my_tenant(tenant_id) AND (
    is_admin_or_above(auth.uid())
    OR is_procurement_or_above(auth.uid())
    OR has_role(auth.uid(), 'accounts'::app_role)
    OR (branch_guard(office_id) AND (
      (assigned_sales_id = auth.uid())
      OR (is_manager_or_above(auth.uid()) AND (assigned_sales_id = ANY (get_subordinate_ids(auth.uid()))))
      OR (is_branch_manager(auth.uid()) AND office_id = current_user_office_id())
      OR EXISTS (SELECT 1 FROM cro_customer_assignments cca WHERE cca.customer_id = customers.id AND cca.cro_user_id = auth.uid())
    ))
  )
)
WITH CHECK (is_my_tenant(tenant_id) AND branch_write_guard(office_id));