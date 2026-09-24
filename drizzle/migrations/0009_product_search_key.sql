ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS search_key text GENERATED ALWAYS AS (
    translate(
      upper(regexp_replace(COALESCE(NULLIF(btrim(model_number), ''), btrim(COALESCE(name, '')), ''), '[^a-zA-Z0-9]', '', 'g')),
      'OIL', '011'
    )
  ) STORED;

CREATE INDEX IF NOT EXISTS idx_products_search_key ON public.products (search_key);
CREATE INDEX IF NOT EXISTS idx_products_search_key_prefix ON public.products (search_key text_pattern_ops);
CREATE INDEX IF NOT EXISTS idx_products_tenant_brand_search ON public.products (tenant_id, brand_match_key, search_key);