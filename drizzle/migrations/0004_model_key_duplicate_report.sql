CREATE OR REPLACE FUNCTION public.get_model_key_duplicates()
RETURNS TABLE (
  match_key text,
  brand_match_key text,
  product_count bigint,
  products jsonb
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.match_key,
         p.brand_match_key,
         count(*) AS product_count,
         jsonb_agg(jsonb_build_object(
           'id', p.id,
           'model_number', p.model_number,
           'brand', p.brand,
           'description', p.description,
           'list_price', p.list_price,
           'product_status', p.product_status
         ) ORDER BY p.model_number) AS products
  FROM public.products p
  WHERE p.tenant_id = public.get_user_tenant_id(auth.uid())
    AND coalesce(p.match_key, '') <> ''
  GROUP BY p.match_key, p.brand_match_key
  HAVING count(*) > 1
  ORDER BY count(*) DESC, p.match_key
  LIMIT 500;
$$;

GRANT EXECUTE ON FUNCTION public.get_model_key_duplicates() TO authenticated;