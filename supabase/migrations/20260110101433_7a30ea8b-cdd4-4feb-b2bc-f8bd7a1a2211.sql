-- Add target_rate column to quotation_items table for capturing customer's expected price during negotiations
ALTER TABLE public.quotation_items ADD COLUMN target_rate numeric DEFAULT NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.quotation_items.target_rate IS 'Customer expected/target price during negotiation';