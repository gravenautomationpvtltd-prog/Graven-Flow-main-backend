-- Fix CRO customer assignments: enforce tenant isolation on all policies

-- 1. SELECT
DROP POLICY IF EXISTS "CRO users can view their assignments" ON public.cro_customer_assignments;
CREATE POLICY "CRO users can view their assignments"
ON public.cro_customer_assignments FOR SELECT TO authenticated
USING (
  is_my_tenant(tenant_id) AND (
    cro_user_id = auth.uid()
    OR is_admin_or_above(auth.uid())
    OR (is_manager_or_above(auth.uid()) AND cro_user_id = ANY(get_subordinate_ids(auth.uid())))
  )
);

-- 2. UPDATE
DROP POLICY IF EXISTS "CRO users can update their assignments" ON public.cro_customer_assignments;
CREATE POLICY "CRO users can update their assignments"
ON public.cro_customer_assignments FOR UPDATE TO authenticated
USING (
  is_my_tenant(tenant_id) AND (
    cro_user_id = auth.uid()
    OR is_admin_or_above(auth.uid())
    OR (is_manager_or_above(auth.uid()) AND cro_user_id = ANY(get_subordinate_ids(auth.uid())))
  )
)
WITH CHECK (
  is_my_tenant(tenant_id) AND (
    cro_user_id = auth.uid()
    OR is_admin_or_above(auth.uid())
    OR (is_manager_or_above(auth.uid()) AND cro_user_id = ANY(get_subordinate_ids(auth.uid())))
  )
);

-- 3. INSERT
DROP POLICY IF EXISTS "Admins and managers can create CRO assignments" ON public.cro_customer_assignments;
CREATE POLICY "Admins and managers can create CRO assignments"
ON public.cro_customer_assignments FOR INSERT TO authenticated
WITH CHECK (
  is_my_tenant(tenant_id) AND (
    is_admin_or_above(auth.uid())
    OR is_manager_or_above(auth.uid())
  )
);

-- 4. DELETE
DROP POLICY IF EXISTS "Admins can delete CRO assignments" ON public.cro_customer_assignments;
CREATE POLICY "Admins can delete CRO assignments"
ON public.cro_customer_assignments FOR DELETE TO authenticated
USING (
  is_my_tenant(tenant_id) AND is_admin_or_above(auth.uid())
);