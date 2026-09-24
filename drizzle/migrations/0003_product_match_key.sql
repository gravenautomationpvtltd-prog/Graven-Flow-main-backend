ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS match_key text GENERATED ALWAYS AS (
    translate(upper(regexp_replace(COALESCE(model_number, ''), '[^a-zA-Z0-9]', '', 'g')), 'OIL', '011')
  ) STORED;

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS brand_match_key text GENERATED ALWAYS AS (
    translate(upper(regexp_replace(COALESCE(brand, ''), '[^a-zA-Z0-9]', '', 'g')), 'OIL', '011')
  ) STORED;

CREATE INDEX IF NOT EXISTS idx_products_match_key ON public.products (match_key);
CREATE INDEX IF NOT EXISTS idx_products_match_key_prefix ON public.products (match_key text_pattern_ops);
CREATE INDEX IF NOT EXISTS idx_products_tenant_brand_match ON public.products (tenant_id, brand_match_key, match_key);