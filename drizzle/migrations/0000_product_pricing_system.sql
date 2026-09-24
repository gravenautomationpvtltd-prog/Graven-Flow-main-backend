-- 1. Product status enum
DO $$ BEGIN
  CREATE TYPE public.product_status AS ENUM ('active', 'discontinued', 'obsolete');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. Product master additions
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS product_status public.product_status NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS sales_discount_pct numeric,
  ADD COLUMN IF NOT EXISTS purchase_discount_pct numeric,
  ADD COLUMN IF NOT EXISTS sales_price numeric,
  ADD COLUMN IF NOT EXISTS replacement_model_no text;

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS model_key text GENERATED ALWAYS AS (upper(btrim(model_number))) STORED,
  ADD COLUMN IF NOT EXISTS brand_key text GENERATED ALWAYS AS (upper(btrim(coalesce(brand, '')))) STORED,
  ADD COLUMN IF NOT EXISTS gross_profit numeric GENERATED ALWAYS AS (coalesce(sales_price, 0) - coalesce(purchase_price, 0)) STORED,
  ADD COLUMN IF NOT EXISTS gross_margin_pct numeric GENERATED ALWAYS AS (
    CASE WHEN coalesce(sales_price, 0) > 0
      THEN round(((coalesce(sales_price, 0) - coalesce(purchase_price, 0)) / sales_price) * 100, 2)
      ELSE NULL END
  ) STORED;

-- Backfill sales_price for existing rows that already have a usable rate
UPDATE public.products
SET sales_price = default_rate
WHERE sales_price IS NULL AND default_rate IS NOT NULL AND default_rate > 0;

-- 3. Search + matching indexes
CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;

CREATE INDEX IF NOT EXISTS idx_products_model_key ON public.products (tenant_id, model_key);
CREATE INDEX IF NOT EXISTS idx_products_brand_model_key ON public.products (tenant_id, brand_key, model_key);
CREATE INDEX IF NOT EXISTS idx_products_status ON public.products (tenant_id, product_status);
CREATE INDEX IF NOT EXISTS idx_products_model_trgm ON public.products USING gin (model_number extensions.gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_products_name_trgm ON public.products USING gin (name extensions.gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_products_desc_trgm ON public.products USING gin (description extensions.gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_products_brand_trgm ON public.products USING gin (brand extensions.gin_trgm_ops);

-- 4. Price versions (insert-only history)
CREATE TABLE IF NOT EXISTS public.product_price_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  effective_date date NOT NULL DEFAULT (now() AT TIME ZONE 'utc')::date,
  old_list_price numeric,
  new_list_price numeric,
  old_sales_discount_pct numeric,
  new_sales_discount_pct numeric,
  old_purchase_discount_pct numeric,
  new_purchase_discount_pct numeric,
  old_sales_price numeric,
  new_sales_price numeric,
  old_purchase_price numeric,
  new_purchase_price numeric,
  source_label text,
  import_run_id uuid,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.product_price_versions TO authenticated;
GRANT ALL ON public.product_price_versions TO service_role;
ALTER TABLE public.product_price_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant users can view price versions"
  ON public.product_price_versions FOR SELECT TO authenticated
  USING (tenant_id IS NULL OR public.is_same_tenant(tenant_id));

CREATE POLICY "Tenant users can insert price versions"
  ON public.product_price_versions FOR INSERT TO authenticated
  WITH CHECK (tenant_id IS NULL OR public.is_same_tenant(tenant_id));

CREATE INDEX IF NOT EXISTS idx_price_versions_product ON public.product_price_versions (product_id, effective_date DESC);

-- 5. Import runs
CREATE TABLE IF NOT EXISTS public.product_import_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid,
  import_type text NOT NULL DEFAULT 'active',
  filename text,
  storage_path text,
  status text NOT NULL DEFAULT 'processing',
  rows_parsed integer NOT NULL DEFAULT 0,
  rows_new integer NOT NULL DEFAULT 0,
  rows_updated integer NOT NULL DEFAULT 0,
  rows_unchanged integer NOT NULL DEFAULT 0,
  rows_errored integer NOT NULL DEFAULT 0,
  rows_processed integer NOT NULL DEFAULT 0,
  error_rows jsonb NOT NULL DEFAULT '[]'::jsonb,
  error_message text,
  uploaded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

GRANT SELECT, INSERT, UPDATE ON public.product_import_runs TO authenticated;
GRANT ALL ON public.product_import_runs TO service_role;
ALTER TABLE public.product_import_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant users can view import runs"
  ON public.product_import_runs FOR SELECT TO authenticated
  USING (tenant_id IS NULL OR public.is_same_tenant(tenant_id));

CREATE POLICY "Tenant users can create import runs"
  ON public.product_import_runs FOR INSERT TO authenticated
  WITH CHECK (tenant_id IS NULL OR public.is_same_tenant(tenant_id));

CREATE POLICY "Tenant users can update import runs"
  ON public.product_import_runs FOR UPDATE TO authenticated
  USING (tenant_id IS NULL OR public.is_same_tenant(tenant_id));

-- 6. Quotation line price snapshot
ALTER TABLE public.quotation_items
  ADD COLUMN IF NOT EXISTS snap_list_price numeric,
  ADD COLUMN IF NOT EXISTS snap_sales_discount_pct numeric,
  ADD COLUMN IF NOT EXISTS snap_sales_price numeric,
  ADD COLUMN IF NOT EXISTS snap_purchase_discount_pct numeric,
  ADD COLUMN IF NOT EXISTS snap_purchase_price numeric,
  ADD COLUMN IF NOT EXISTS snap_gross_profit numeric,
  ADD COLUMN IF NOT EXISTS snap_gross_margin_pct numeric,
  ADD COLUMN IF NOT EXISTS snap_product_status text;

-- 7. Unquoted reasons on leads
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS unquoted_reason text,
  ADD COLUMN IF NOT EXISTS unquoted_note text,
  ADD COLUMN IF NOT EXISTS unquoted_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_leads_unquoted_reason ON public.leads (tenant_id, unquoted_reason);