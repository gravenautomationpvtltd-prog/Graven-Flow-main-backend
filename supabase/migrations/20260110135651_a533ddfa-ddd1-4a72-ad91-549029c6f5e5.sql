-- Add won_reason column to leads table
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS won_reason text;

-- Add comment for documentation
COMMENT ON COLUMN public.leads.won_reason IS 'Reason for winning the deal (e.g., price, quality, delivery_time)';
COMMENT ON COLUMN public.leads.lost_reason IS 'Reason for losing the deal (e.g., price, quality, delivery_time)';