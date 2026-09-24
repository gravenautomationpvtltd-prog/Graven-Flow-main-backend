-- Add currency column to quotations table
ALTER TABLE public.quotations 
ADD COLUMN currency TEXT NOT NULL DEFAULT 'INR';

-- Add currency column to purchase_orders table
ALTER TABLE public.purchase_orders 
ADD COLUMN currency TEXT NOT NULL DEFAULT 'INR';