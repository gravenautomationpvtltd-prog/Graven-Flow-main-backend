
DROP INDEX IF EXISTS public.products_tenant_model_unique;
ALTER TABLE public.products
  ADD CONSTRAINT products_tenant_model_number_key UNIQUE (tenant_id, model_number);
