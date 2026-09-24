ALTER TABLE public.quotation_items
  ADD COLUMN IF NOT EXISTS model_number text,
  ADD COLUMN IF NOT EXISTS product_description text;