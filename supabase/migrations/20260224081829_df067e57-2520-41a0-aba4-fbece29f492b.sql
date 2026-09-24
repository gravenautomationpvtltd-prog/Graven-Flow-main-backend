-- Drop and recreate the SELECT policy to handle NULL created_by
DROP POLICY IF EXISTS "Suppliers viewable by authenticated users" ON suppliers;
CREATE POLICY "Suppliers viewable by authenticated users" 
  ON suppliers FOR SELECT TO authenticated
  USING (is_same_tenant(created_by) OR created_by IS NULL);