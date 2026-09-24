ALTER TABLE public.price_requests ADD COLUMN IF NOT EXISTS price_valid_until date;
ALTER TABLE public.enquiry_items ADD COLUMN IF NOT EXISTS price_valid_until date;