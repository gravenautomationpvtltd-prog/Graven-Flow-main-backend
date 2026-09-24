ALTER TABLE public.quotations
  ADD COLUMN IF NOT EXISTS advance_remark text,
  ADD COLUMN IF NOT EXISTS balance_remark text;