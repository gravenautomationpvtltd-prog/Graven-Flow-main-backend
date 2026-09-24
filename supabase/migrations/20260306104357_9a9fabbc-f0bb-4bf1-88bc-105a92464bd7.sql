
DROP POLICY "Lead visibility by role hierarchy" ON public.leads;

CREATE POLICY "Lead visibility by role hierarchy" ON public.leads
FOR SELECT TO authenticated
USING (
  is_my_tenant(tenant_id) AND (
    is_admin_or_above(auth.uid())
    OR assigned_to = auth.uid()
    OR (is_manager_or_above(auth.uid()) AND assigned_to = ANY(get_subordinate_ids(auth.uid())))
    OR EXISTS (
      SELECT 1 FROM cro_customer_assignments
      WHERE cro_customer_assignments.customer_id = leads.customer_id
        AND cro_customer_assignments.cro_user_id = auth.uid()
    )
  )
);
