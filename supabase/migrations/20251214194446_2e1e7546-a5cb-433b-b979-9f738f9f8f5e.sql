-- Drop existing manager-only policy
DROP POLICY IF EXISTS "Managers can manage products" ON products;

-- Create new policy allowing managers AND procurement to manage products
CREATE POLICY "Authorized users can manage products" ON products
FOR ALL
TO authenticated
USING (
  is_manager_or_above(auth.uid()) OR 
  has_role(auth.uid(), 'procurement')
)
WITH CHECK (
  is_manager_or_above(auth.uid()) OR 
  has_role(auth.uid(), 'procurement')
);