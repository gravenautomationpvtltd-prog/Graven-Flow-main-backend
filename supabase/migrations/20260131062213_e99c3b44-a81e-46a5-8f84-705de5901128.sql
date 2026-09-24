-- Add is_import column to sales_orders table
ALTER TABLE public.sales_orders 
ADD COLUMN is_import boolean DEFAULT false;