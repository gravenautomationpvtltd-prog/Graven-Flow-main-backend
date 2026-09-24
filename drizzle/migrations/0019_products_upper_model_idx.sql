CREATE INDEX IF NOT EXISTS products_tenant_upper_model_idx
  ON public.products (tenant_id, upper(btrim(model_number)));