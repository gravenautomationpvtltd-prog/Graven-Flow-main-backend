CREATE OR REPLACE FUNCTION public.find_ownership_mismatches(
  p_tenant uuid,
  p_days integer DEFAULT 90,
  p_min_worker_actions integer DEFAULT 1,
  p_require_owner_zero boolean DEFAULT false
)
RETURNS TABLE (
  lead_id uuid,
  lead_title text,
  lead_status lead_status,
  lead_source text,
  customer_id uuid,
  customer_name text,
  owner_id uuid,
  owner_name text,
  worker_id uuid,
  worker_name text,
  owner_activity_count bigint,
  worker_activity_count bigint,
  last_activity_at timestamptz,
  lead_created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH acts AS (
    SELECT a.lead_id, a.user_id, COUNT(*)::bigint AS cnt, MAX(a.created_at) AS last_at
    FROM public.activities a
    JOIN public.leads l ON l.id = a.lead_id
    WHERE l.tenant_id = p_tenant
      AND a.lead_id IS NOT NULL
      AND a.user_id IS NOT NULL
      AND a.created_at > now() - make_interval(days => p_days)
    GROUP BY a.lead_id, a.user_id
  ),
  top_worker AS (
    SELECT DISTINCT ON (lead_id) lead_id, user_id AS worker_id, cnt AS worker_cnt, last_at
    FROM acts
    ORDER BY lead_id, cnt DESC, last_at DESC
  ),
  owner_act AS (
    SELECT a.lead_id, COALESCE(SUM(a.cnt), 0)::bigint AS owner_cnt
    FROM acts a
    JOIN public.leads l ON l.id = a.lead_id
    WHERE a.user_id = l.assigned_to
    GROUP BY a.lead_id
  )
  SELECT
    l.id,
    l.title,
    l.status,
    l.source::text,
    l.customer_id,
    c.company_name,
    l.assigned_to,
    po.full_name,
    t.worker_id,
    pw.full_name,
    COALESCE(oa.owner_cnt, 0),
    t.worker_cnt,
    t.last_at,
    l.created_at
  FROM public.leads l
  JOIN top_worker t ON t.lead_id = l.id
  LEFT JOIN owner_act oa ON oa.lead_id = l.id
  LEFT JOIN public.customers c ON c.id = l.customer_id
  LEFT JOIN public.profiles po ON po.id = l.assigned_to
  LEFT JOIN public.profiles pw ON pw.id = t.worker_id
  WHERE l.tenant_id = p_tenant
    AND l.deleted_at IS NULL
    AND l.assigned_to IS NOT NULL
    AND t.worker_id <> l.assigned_to
    AND l.status NOT IN ('won','lost')
    AND t.worker_cnt >= p_min_worker_actions
    AND (NOT p_require_owner_zero OR COALESCE(oa.owner_cnt, 0) = 0)
  ORDER BY t.last_at DESC NULLS LAST
  LIMIT 5000
$$;

GRANT EXECUTE ON FUNCTION public.find_ownership_mismatches(uuid, integer, integer, boolean) TO authenticated;