
DROP POLICY IF EXISTS "Procurement and managers can manage suppliers" ON public.suppliers;

CREATE POLICY "Procurement and managers can manage suppliers"
ON public.suppliers FOR ALL
TO authenticated
USING (
  is_procurement_or_above(auth.uid())
  AND (is_same_tenant(created_by) OR created_by IS NULL)
)
WITH CHECK (
  is_procurement_or_above(auth.uid())
  AND (is_same_tenant(created_by) OR created_by IS NULL)
);
