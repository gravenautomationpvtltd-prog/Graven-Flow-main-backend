-- Allow all authenticated users to create products (for auto-save from quotations)
CREATE POLICY "Authenticated users can create products" 
ON public.products 
FOR INSERT 
WITH CHECK (true);