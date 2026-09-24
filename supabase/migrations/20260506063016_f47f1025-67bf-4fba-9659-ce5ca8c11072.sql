
-- 1) Supporting indexes for narrow LQT queries
CREATE INDEX IF NOT EXISTS idx_leads_assigned_to_active
  ON public.leads(assigned_to)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_leads_tenant_created_active
  ON public.leads(tenant_id, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_lead_qualification_qualified_at
  ON public.lead_qualification(qualified_at DESC);

CREATE INDEX IF NOT EXISTS idx_lead_qualification_routed_qualified
  ON public.lead_qualification(routed_to, qualified_at DESC);

-- 2) Single aggregate RPC powering LqtStatsHeader
CREATE OR REPLACE FUNCTION public.get_lqt_stats(
  p_from timestamptz DEFAULT NULL,
  p_to   timestamptz DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_tenant uuid;
  v_result jsonb;
  v_pending_count int := 0;
  v_oldest_pending_ts timestamptz;
  v_oldest_pending_hours int;
  v_oldest_pending_label text;
  v_priority_pending int := 0;
  v_oldest_pending_list jsonb := '[]'::jsonb;
  v_spt int := 0;
  v_tst int := 0;
  v_qualified int := 0;
  v_discarded int := 0;
  v_junk int := 0;
  v_dup int := 0;
  v_total_decisions int := 0;
  v_discard_pct int := 0;
  v_avg_min int;
  v_spt_routed int := 0;
  v_tst_routed int := 0;
  v_spt_accepted int := 0;
  v_tst_accepted int := 0;
  v_total_routed int := 0;
  v_total_accepted int := 0;
  v_team jsonb := '[]'::jsonb;
  v_diff_ms bigint;
  v_h int;
  v_m int;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'auth required';
  END IF;

  v_tenant := public.get_user_tenant_id(v_uid);
  IF v_tenant IS NULL THEN
    RETURN jsonb_build_object('error', 'no tenant');
  END IF;

  -- Pending bucket: leads currently sitting with a CRO and not yet qualified
  WITH cro_users AS (
    SELECT ur.user_id
    FROM public.user_roles ur
    JOIN public.profiles p ON p.id = ur.user_id
    WHERE ur.role = 'cro' AND p.tenant_id = v_tenant
  ),
  pending AS (
    SELECT l.id, l.title, l.created_at, l.customer_id
    FROM public.leads l
    WHERE l.tenant_id = v_tenant
      AND l.deleted_at IS NULL
      AND l.assigned_to IN (SELECT user_id FROM cro_users)
      AND NOT EXISTS (
        SELECT 1 FROM public.lead_qualification q WHERE q.lead_id = l.id
      )
  )
  SELECT
    count(*),
    min(created_at),
    count(*) FILTER (WHERE created_at <= now() - interval '4 hours')
  INTO v_pending_count, v_oldest_pending_ts, v_priority_pending
  FROM pending;

  IF v_pending_count > 0 AND v_oldest_pending_ts IS NOT NULL THEN
    v_diff_ms := EXTRACT(EPOCH FROM (now() - v_oldest_pending_ts))::bigint * 1000;
    v_oldest_pending_hours := round(v_diff_ms / 3600000.0)::int;
    v_h := floor(v_diff_ms / 3600000.0)::int;
    v_m := floor((v_diff_ms % 3600000) / 60000.0)::int;
    v_oldest_pending_label := v_h::text || 'h ' || v_m::text || 'm';
  END IF;

  -- Oldest pending list (top 5)
  SELECT COALESCE(jsonb_agg(row), '[]'::jsonb)
  INTO v_oldest_pending_list
  FROM (
    SELECT jsonb_build_object(
      'id', l.id,
      'title', l.title,
      'hoursWaiting', round(EXTRACT(EPOCH FROM (now() - l.created_at)) / 3600.0)::int,
      'customer_name', c.company_name
    ) AS row
    FROM public.leads l
    LEFT JOIN public.customers c ON c.id = l.customer_id
    WHERE l.tenant_id = v_tenant
      AND l.deleted_at IS NULL
      AND l.assigned_to IN (
        SELECT ur.user_id FROM public.user_roles ur
        JOIN public.profiles p ON p.id = ur.user_id
        WHERE ur.role = 'cro' AND p.tenant_id = v_tenant
      )
      AND NOT EXISTS (SELECT 1 FROM public.lead_qualification q WHERE q.lead_id = l.id)
    ORDER BY l.created_at ASC
    LIMIT 5
  ) sub;

  -- Decisions in range: lead created in range AND qualified in range AND qualified by a CRO
  WITH cro_users AS (
    SELECT ur.user_id
    FROM public.user_roles ur
    JOIN public.profiles p ON p.id = ur.user_id
    WHERE ur.role = 'cro' AND p.tenant_id = v_tenant
  ),
  decisions AS (
    SELECT l.id, l.created_at, l.status, l.has_enquiry,
           q.qualified_at, q.routed_to, q.decision_reason, q.qualified_by
    FROM public.leads l
    JOIN public.lead_qualification q ON q.lead_id = l.id
    WHERE l.tenant_id = v_tenant
      AND l.deleted_at IS NULL
      AND q.qualified_by IN (SELECT user_id FROM cro_users)
      AND (p_from IS NULL OR l.created_at >= p_from)
      AND (p_to   IS NULL OR l.created_at <= p_to)
      AND (p_from IS NULL OR q.qualified_at >= p_from)
      AND (p_to   IS NULL OR q.qualified_at <= p_to)
  )
  SELECT
    count(*) FILTER (WHERE routed_to = 'spt'),
    count(*) FILTER (WHERE routed_to = 'tst'),
    count(*) FILTER (WHERE routed_to = 'discard'),
    count(*) FILTER (WHERE routed_to = 'discard' AND decision_reason ~* 'junk|spam|invalid|wrong'),
    count(*) FILTER (WHERE routed_to = 'discard' AND decision_reason ~* 'dup'),
    round(avg(EXTRACT(EPOCH FROM (qualified_at - created_at)) / 60.0))::int
  INTO v_spt, v_tst, v_discarded, v_junk, v_dup, v_avg_min
  FROM decisions;

  v_qualified := v_spt + v_tst;
  v_total_decisions := v_qualified + v_discarded;
  IF v_total_decisions > 0 THEN
    v_discard_pct := round((v_discarded::numeric / v_total_decisions) * 100)::int;
  END IF;

  -- Acceptance: routed to spt/tst, accepted = downstream activity
  WITH cro_users AS (
    SELECT ur.user_id FROM public.user_roles ur
    JOIN public.profiles p ON p.id = ur.user_id
    WHERE ur.role = 'cro' AND p.tenant_id = v_tenant
  ),
  routed AS (
    SELECT l.id, l.status, l.has_enquiry, q.routed_to,
           EXISTS(SELECT 1 FROM public.enquiry_items ei WHERE ei.lead_id = l.id) AS has_items
    FROM public.leads l
    JOIN public.lead_qualification q ON q.lead_id = l.id
    WHERE l.tenant_id = v_tenant
      AND l.deleted_at IS NULL
      AND q.routed_to IN ('spt','tst')
      AND q.qualified_by IN (SELECT user_id FROM cro_users)
      AND (p_from IS NULL OR l.created_at >= p_from)
      AND (p_to   IS NULL OR l.created_at <= p_to)
      AND (p_from IS NULL OR q.qualified_at >= p_from)
      AND (p_to   IS NULL OR q.qualified_at <= p_to)
  )
  SELECT
    count(*) FILTER (WHERE routed_to = 'spt'),
    count(*) FILTER (WHERE routed_to = 'tst'),
    count(*) FILTER (WHERE routed_to = 'spt' AND (has_items OR has_enquiry = true OR (status IS NOT NULL AND status::text <> 'new'))),
    count(*) FILTER (WHERE routed_to = 'tst' AND (has_items OR has_enquiry = true OR (status IS NOT NULL AND status::text <> 'new')))
  INTO v_spt_routed, v_tst_routed, v_spt_accepted, v_tst_accepted
  FROM routed;

  v_total_routed := v_spt_routed + v_tst_routed;
  v_total_accepted := v_spt_accepted + v_tst_accepted;

  -- Team breakdown
  WITH cro_users AS (
    SELECT ur.user_id FROM public.user_roles ur
    JOIN public.profiles p ON p.id = ur.user_id
    WHERE ur.role = 'cro' AND p.tenant_id = v_tenant
  ),
  agg AS (
    SELECT
      q.qualified_by AS user_id,
      count(*) FILTER (WHERE q.routed_to IN ('spt','tst'))::int AS qualified,
      count(*) FILTER (WHERE q.routed_to = 'discard')::int AS discarded,
      round(avg(EXTRACT(EPOCH FROM (q.qualified_at - l.created_at)) / 60.0))::int AS avg_min
    FROM public.leads l
    JOIN public.lead_qualification q ON q.lead_id = l.id
    WHERE l.tenant_id = v_tenant
      AND l.deleted_at IS NULL
      AND q.qualified_by IN (SELECT user_id FROM cro_users)
      AND (p_from IS NULL OR l.created_at >= p_from)
      AND (p_to   IS NULL OR l.created_at <= p_to)
      AND (p_from IS NULL OR q.qualified_at >= p_from)
      AND (p_to   IS NULL OR q.qualified_at <= p_to)
    GROUP BY q.qualified_by
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'user_id', a.user_id,
    'name',    COALESCE(p.full_name, 'Unknown'),
    'qualified', a.qualified,
    'discarded', a.discarded,
    'avgMinutes', a.avg_min
  ) ORDER BY a.qualified DESC), '[]'::jsonb)
  INTO v_team
  FROM agg a
  LEFT JOIN public.profiles p ON p.id = a.user_id;

  v_result := jsonb_build_object(
    'pending', v_pending_count,
    'oldestPendingHours', v_oldest_pending_hours,
    'oldestPendingLabel', v_oldest_pending_label,
    'priorityPending', v_priority_pending,
    'oldestPendingList', v_oldest_pending_list,
    'qualifiedToday', v_qualified,
    'sptToday', v_spt,
    'tstToday', v_tst,
    'discardedToday', v_discarded,
    'junkToday', v_junk,
    'duplicateToday', v_dup,
    'todayDecisionTotal', v_total_decisions,
    'discardRatePct', v_discard_pct,
    'avgQualMinutes', v_avg_min,
    'acceptance', jsonb_build_object(
      'overall', CASE WHEN v_total_routed > 0 THEN round((v_total_accepted::numeric / v_total_routed) * 100)::int ELSE 0 END,
      'spt',     CASE WHEN v_spt_routed   > 0 THEN round((v_spt_accepted::numeric   / v_spt_routed)   * 100)::int ELSE 0 END,
      'tst',     CASE WHEN v_tst_routed   > 0 THEN round((v_tst_accepted::numeric   / v_tst_routed)   * 100)::int ELSE 0 END,
      'sptTotal', v_spt_routed,
      'tstTotal', v_tst_routed
    ),
    'team', v_team
  );

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_lqt_stats(timestamptz, timestamptz) TO authenticated;
