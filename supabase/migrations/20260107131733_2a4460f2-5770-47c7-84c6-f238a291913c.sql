-- Add exchange_rate column to quotations table
ALTER TABLE public.quotations 
ADD COLUMN IF NOT EXISTS exchange_rate NUMERIC DEFAULT 1;

-- Add exchange_rate column to purchase_orders table
ALTER TABLE public.purchase_orders 
ADD COLUMN IF NOT EXISTS exchange_rate NUMERIC DEFAULT 1;

-- Add comment for clarity
COMMENT ON COLUMN public.quotations.exchange_rate IS 'Exchange rate: 1 [selected currency] = X INR';
COMMENT ON COLUMN public.purchase_orders.exchange_rate IS 'Exchange rate: 1 [selected currency] = X INR';