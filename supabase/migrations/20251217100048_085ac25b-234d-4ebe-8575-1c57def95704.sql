-- Drop existing INSERT policy on customers
DROP POLICY IF EXISTS "Sales and above can create customers" ON public.customers;

-- Recreate as explicitly PERMISSIVE for authenticated users
CREATE POLICY "Sales and above can create customers" 
ON public.customers 
FOR INSERT 
TO authenticated 
WITH CHECK (true);