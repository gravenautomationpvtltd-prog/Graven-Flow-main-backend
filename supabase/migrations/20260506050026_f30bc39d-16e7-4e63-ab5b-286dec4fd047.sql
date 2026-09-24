-- 1) Indexes to support the new RLS sub-paths (and general lead/quotation joins)
CREATE INDEX IF NOT EXISTS idx_quotations_lead_created_by
  ON public.quotations (lead_id, created_by)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_quotations_created_by
  ON public.quotations (created_by);

CREATE INDEX IF NOT EXISTS idx_quotations_lead_id
  ON public.quotations (lead_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_cro_cust_assignments_customer_user
  ON public.cro_customer_assignments (customer_id, cro_user_id);

CREATE INDEX IF NOT EXISTS idx_cro_cust_assignments_user
  ON public.cro_customer_assignments (cro_user_id);

-- 2) Set-based helper functions (run ONCE per query, not per row)
CREATE OR REPLACE FUNCTION public.get_user_quotation_lead_ids(_uid uuid)
RETURNS uuid[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(array_agg(DISTINCT q.lead_id), ARRAY[]::uuid[])
  FROM public.quotations q
  WHERE q.created_by = _uid
    AND q.lead_id IS NOT NULL
    AND q.deleted_at IS NULL;
$$;

CREATE OR REPLACE FUNCTION public.get_user_cro_customer_ids(_uid uuid)
RETURNS uuid[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(array_agg(DISTINCT cca.customer_id), ARRAY[]::uuid[])
  FROM public.cro_customer_assignments cca
  WHERE cca.cro_user_id = _uid;
$$;

-- 3) Replace the row-correlated SELECT policy with a set-based one
DROP POLICY IF EXISTS "Lead visibility by role hierarchy" ON public.leads;

CREATE POLICY "Lead visibility by role hierarchy"
ON public.leads
FOR SELECT
USING (
  is_my_tenant(tenant_id) AND (
    is_admin_or_above(auth.uid())
    OR assigned_to = auth.uid()
    OR (
      is_manager_or_above(auth.uid())
      AND assigned_to = ANY (get_subordinate_ids(auth.uid()))
    )
    OR (
      customer_id IS NOT NULL
      AND customer_id = ANY (get_user_cro_customer_ids(auth.uid()))
    )
    OR id = ANY (get_user_quotation_lead_ids(auth.uid()))
  )
);