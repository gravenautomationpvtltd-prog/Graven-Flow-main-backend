DROP POLICY IF EXISTS "Lead visibility by role hierarchy" ON public.leads;

CREATE POLICY "Lead visibility by role hierarchy"
ON public.leads
FOR SELECT
USING (
  is_my_tenant(tenant_id) AND (
    is_admin_or_above(auth.uid())
    OR assigned_to = auth.uid()
    OR (is_manager_or_above(auth.uid()) AND assigned_to = ANY (get_subordinate_ids(auth.uid())))
    OR EXISTS (
      SELECT 1 FROM public.cro_customer_assignments cca
      WHERE cca.customer_id = leads.customer_id
        AND cca.cro_user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.quotations q
      WHERE q.lead_id = leads.id
        AND q.created_by = auth.uid()
    )
  )
);