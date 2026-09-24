-- Add lead_time_days column to quotation_items table
ALTER TABLE public.quotation_items 
ADD COLUMN IF NOT EXISTS lead_time_days INTEGER DEFAULT NULL;

COMMENT ON COLUMN public.quotation_items.lead_time_days IS 
'Estimated lead time in days for this item, auto-populated from product catalog';