-- Update customers RLS policy to allow procurement users to view customers with sales orders
DROP POLICY IF EXISTS "Customers are viewable by authenticated users" ON customers;

CREATE POLICY "Customers are viewable by authenticated users" 
ON customers FOR SELECT 
TO public 
USING (
  is_manager_or_above(auth.uid()) 
  OR assigned_sales_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM leads WHERE leads.customer_id = customers.id AND leads.assigned_to = auth.uid()
  )
  OR (
    is_procurement_or_above(auth.uid()) 
    AND EXISTS (
      SELECT 1 FROM sales_orders WHERE sales_orders.customer_id = customers.id
    )
  )
);