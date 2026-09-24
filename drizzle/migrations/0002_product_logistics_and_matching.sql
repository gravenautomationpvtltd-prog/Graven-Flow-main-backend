-- Logistics fields on product master (KG / CM canonical)
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS weight_kg NUMERIC,
  ADD COLUMN IF NOT EXISTS length_cm NUMERIC,
  ADD COLUMN IF NOT EXISTS width_cm NUMERIC,
  ADD COLUMN IF NOT EXISTS height_cm NUMERIC;

-- Normalised model for fuzzy/typo-tolerant search
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS normalized_model TEXT
  GENERATED ALWAYS AS (upper(regexp_replace(coalesce(model_number, ''), '[^a-zA-Z0-9]', '', 'g'))) STORED;

CREATE INDEX IF NOT EXISTS idx_products_normalized_model ON public.products (normalized_model);
CREATE INDEX IF NOT EXISTS idx_products_brand_model_key ON public.products (tenant_id, brand_key, model_key);

-- Dispatch line logistics snapshot
ALTER TABLE public.dispatch_items
  ADD COLUMN IF NOT EXISTS unit_weight_kg NUMERIC,
  ADD COLUMN IF NOT EXISTS length_cm NUMERIC,
  ADD COLUMN IF NOT EXISTS width_cm NUMERIC,
  ADD COLUMN IF NOT EXISTS height_cm NUMERIC,
  ADD COLUMN IF NOT EXISTS model_number TEXT;

-- Price version link on quotation lines
ALTER TABLE public.quotation_items
  ADD COLUMN IF NOT EXISTS price_version_id UUID;
