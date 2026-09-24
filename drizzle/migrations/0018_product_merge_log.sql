CREATE TABLE IF NOT EXISTS public.product_merge_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid,
  old_id uuid NOT NULL,
  kept_id uuid NOT NULL,
  old_row jsonb NOT NULL,
  merged_at timestamptz NOT NULL DEFAULT now(),
  merged_by uuid
);

CREATE INDEX IF NOT EXISTS product_merge_log_kept_idx ON public.product_merge_log (kept_id);
CREATE INDEX IF NOT EXISTS product_merge_log_old_idx ON public.product_merge_log (old_id);

GRANT SELECT ON public.product_merge_log TO authenticated;
GRANT ALL ON public.product_merge_log TO service_role;

ALTER TABLE public.product_merge_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can view product merges"
  ON public.product_merge_log FOR SELECT
  TO authenticated
  USING (public.is_my_tenant(tenant_id));
