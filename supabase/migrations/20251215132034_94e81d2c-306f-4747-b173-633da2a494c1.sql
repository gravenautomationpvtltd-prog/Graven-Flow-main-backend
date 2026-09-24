-- Drop existing policy
DROP POLICY IF EXISTS "Customers are viewable by authenticated users" ON customers;

-- Create new policy with proper sales user restriction
-- Sales users only see customers assigned to them
-- Managers and above can see all customers
CREATE POLICY "Customers are viewable by authenticated users" ON customers
FOR SELECT USING (
  -- Managers and above can see all customers
  is_manager_or_above(auth.uid())
  
  -- Users can see customers assigned to them
  OR (assigned_sales_id = auth.uid())
);