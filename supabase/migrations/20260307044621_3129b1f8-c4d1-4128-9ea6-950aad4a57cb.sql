
-- Update cro_customer_assignments SELECT policy to scope managers to their subordinates only
DROP POLICY IF EXISTS "CROs see own assignments" ON public.cro_customer_assignments;

CREATE POLICY "CROs see own assignments" ON public.cro_customer_assignments
FOR SELECT TO authenticated
USING (
  cro_user_id = auth.uid()
  OR public.is_admin_or_above(auth.uid())
  OR (
    public.is_manager_or_above(auth.uid())
    AND cro_user_id = ANY(public.get_subordinate_ids(auth.uid()))
  )
);
