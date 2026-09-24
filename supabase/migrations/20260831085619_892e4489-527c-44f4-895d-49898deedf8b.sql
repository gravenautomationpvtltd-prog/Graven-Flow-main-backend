ALTER TABLE public.quotations
  ADD COLUMN IF NOT EXISTS advance_percent numeric,
  ADD COLUMN IF NOT EXISTS advance_amount numeric,
  ADD COLUMN IF NOT EXISTS balance_amount numeric,
  ADD COLUMN IF NOT EXISTS payment_remark text;