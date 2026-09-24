-- Drop existing policy
DROP POLICY IF EXISTS "Customers are viewable by authenticated users" ON customers;

-- Create new policy with lead-based visibility
-- Sales users can see customers assigned to them OR linked to their assigned leads
CREATE POLICY "Customers are viewable by authenticated users" ON customers
FOR SELECT USING (
  -- Managers and above can see all customers
  is_manager_or_above(auth.uid())
  
  -- Users can see customers assigned to them
  OR (assigned_sales_id = auth.uid())
  
  -- Users can see customers linked to leads assigned to them
  OR EXISTS (
    SELECT 1 FROM leads 
    WHERE leads.customer_id = customers.id 
    AND leads.assigned_to = auth.uid()
  )
);