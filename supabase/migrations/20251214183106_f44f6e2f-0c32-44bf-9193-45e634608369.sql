-- Add purchase_price column to products table for profit margin calculation
ALTER TABLE public.products 
ADD COLUMN purchase_price numeric DEFAULT NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.products.purchase_price IS 'Purchase/cost price for profit margin calculation. Only visible to Procurement users.';