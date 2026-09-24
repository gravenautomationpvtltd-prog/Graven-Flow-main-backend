-- Add procurement_price column to enquiry_items to store resolved prices from procurement
ALTER TABLE public.enquiry_items ADD COLUMN IF NOT EXISTS procurement_price numeric;