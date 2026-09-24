ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS price_valid_until date,
  ADD COLUMN IF NOT EXISTS last_quote_supplier_id uuid,
  ADD COLUMN IF NOT EXISTS price_source text;

CREATE INDEX IF NOT EXISTS idx_products_model_number_lower ON public.products (lower(model_number));
CREATE INDEX IF NOT EXISTS idx_products_price_valid_until ON public.products (price_valid_until);