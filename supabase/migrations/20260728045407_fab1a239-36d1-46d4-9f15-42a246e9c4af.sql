
-- Helper: enforce office match on insert/update for branch-scoped roles
CREATE OR REPLACE FUNCTION public.branch_write_guard(_office_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT NOT public.is_branch_scoped_role(auth.uid())
    OR _office_id IS NULL
    OR _office_id = public.current_user_office_id();
$$;

-- ============ LEADS ============
DROP POLICY IF EXISTS "Users can update leads they can access" ON public.leads;
CREATE POLICY "Users can update leads they can access"
ON public.leads FOR UPDATE
USING (
  is_my_tenant(tenant_id)
  AND branch_guard(office_id)
  AND (
    is_admin_or_above(auth.uid())
    OR assigned_to = auth.uid()
    OR (is_manager_or_above(auth.uid()) AND assigned_to = ANY (get_subordinate_ids(auth.uid())))
  )
)
WITH CHECK (
  is_my_tenant(tenant_id)
  AND branch_write_guard(office_id)
);

DROP POLICY IF EXISTS "Authenticated users can create leads" ON public.leads;
CREATE POLICY "Authenticated users can create leads"
ON public.leads FOR INSERT
WITH CHECK (
  is_my_tenant(tenant_id)
  AND branch_write_guard(office_id)
);

-- ============ QUOTATIONS ============
DROP POLICY IF EXISTS "Creator and managers can update quotations" ON public.quotations;
CREATE POLICY "Creator and managers can update quotations"
ON public.quotations FOR UPDATE
USING (
  is_my_tenant(tenant_id)
  AND branch_guard(office_id)
  AND (
    is_admin_or_above(auth.uid())
    OR created_by = auth.uid()
    OR (is_manager_or_above(auth.uid()) AND created_by = ANY (get_subordinate_ids(auth.uid())))
  )
)
WITH CHECK (
  is_my_tenant(tenant_id)
  AND branch_write_guard(office_id)
);

DROP POLICY IF EXISTS "Authenticated users can create quotations" ON public.quotations;
CREATE POLICY "Authenticated users can create quotations"
ON public.quotations FOR INSERT
WITH CHECK (
  is_my_tenant(tenant_id)
  AND branch_write_guard(office_id)
);

-- ============ SALES ORDERS ============
DROP POLICY IF EXISTS "Creator and managers can update orders" ON public.sales_orders;
CREATE POLICY "Creator and managers can update orders"
ON public.sales_orders FOR UPDATE
USING (
  is_my_tenant(tenant_id)
  AND (
    is_admin_or_above(auth.uid())
    OR is_procurement_or_above(auth.uid())
    OR has_role(auth.uid(), 'accounts'::app_role)
    OR (
      branch_guard(office_id)
      AND (
        created_by = auth.uid()
        OR (is_manager_or_above(auth.uid()) AND created_by = ANY (get_subordinate_ids(auth.uid())))
      )
    )
  )
)
WITH CHECK (
  is_my_tenant(tenant_id)
  AND branch_write_guard(office_id)
);

DROP POLICY IF EXISTS "Sales can create orders" ON public.sales_orders;
CREATE POLICY "Sales can create orders"
ON public.sales_orders FOR INSERT
WITH CHECK (
  is_my_tenant(tenant_id)
  AND branch_write_guard(office_id)
);

-- ============ CUSTOMERS ============
DROP POLICY IF EXISTS "Sales and above can update customers" ON public.customers;
CREATE POLICY "Sales and above can update customers"
ON public.customers FOR UPDATE
USING (
  is_my_tenant(tenant_id)
  AND (
    is_admin_or_above(auth.uid())
    OR is_procurement_or_above(auth.uid())
    OR has_role(auth.uid(), 'accounts'::app_role)
    OR (
      branch_guard(office_id)
      AND (
        assigned_sales_id = auth.uid()
        OR (is_manager_or_above(auth.uid()) AND assigned_sales_id = ANY (get_subordinate_ids(auth.uid())))
        OR EXISTS (
          SELECT 1 FROM cro_customer_assignments cca
          WHERE cca.customer_id = customers.id AND cca.cro_user_id = auth.uid()
        )
      )
    )
  )
)
WITH CHECK (
  is_my_tenant(tenant_id)
  AND branch_write_guard(office_id)
);

DROP POLICY IF EXISTS "Sales and above can create customers" ON public.customers;
CREATE POLICY "Sales and above can create customers"
ON public.customers FOR INSERT
WITH CHECK (
  is_my_tenant(tenant_id)
  AND branch_write_guard(office_id)
);
