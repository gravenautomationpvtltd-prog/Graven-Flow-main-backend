-- Add target_rate to price_requests table
ALTER TABLE public.price_requests ADD COLUMN IF NOT EXISTS target_rate numeric NULL;

-- Add target_rate to enquiry_items table (for persistent storage at enquiry level)
ALTER TABLE public.enquiry_items ADD COLUMN IF NOT EXISTS target_rate numeric NULL;

-- Add comment for clarity
COMMENT ON COLUMN public.price_requests.target_rate IS 'Customer expected/target price entered by sales when creating price request';
COMMENT ON COLUMN public.enquiry_items.target_rate IS 'Customer expected/target price for this enquiry item';