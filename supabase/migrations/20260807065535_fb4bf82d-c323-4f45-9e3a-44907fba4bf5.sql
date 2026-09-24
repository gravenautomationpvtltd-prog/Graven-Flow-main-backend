CREATE OR REPLACE FUNCTION public.get_variance_drilldown(
  _metric text,
  _from timestamptz,
  _to timestamptz,
  _office uuid DEFAULT NULL,
  _department text DEFAULT NULL,
  _limit int DEFAULT 200
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  result jsonb;
BEGIN
  RETURN (
  WITH scoped AS (
    SELECT
      p.id,
      p.lead_id,
      l.office_id,
      o.name AS office_name,
      COALESCE(
        (SELECT ur.role::text FROM public.user_roles ur
          WHERE ur.user_id = COALESCE(p.resolved_by, p.assigned_to, p.requested_by)
          ORDER BY ur.role::text LIMIT 1),
        'unassigned'
      ) AS department,
      COALESCE(pr.full_name, 'Unassigned') AS owner_name,
      COALESCE(ei.product_query_text, 'Item') AS item_label,
      ei.quantity,
      p.requested_at,
      p.resolved_at,
      p.tat_deadline,
      p.status::text AS status,
      p.target_rate,
      p.resolved_price,
      p.sales_outcome,
      (p.resolved_price - p.target_rate) / NULLIF(p.target_rate, 0) * 100 AS gap_pct,
      EXTRACT(EPOCH FROM (p.resolved_at - p.requested_at)) / 3600 AS hours_taken,
      (p.requested_at >= _from AND p.requested_at <= _to) AS in_raised,
      (p.resolved_at IS NOT NULL AND p.resolved_at >= _from AND p.resolved_at <= _to) AS in_res,
      (p.resolved_at IS NULL AND p.status::text IS DISTINCT FROM 'no_price') AS is_open,
      (p.target_matched_at IS NOT NULL) AS matched,
      EXTRACT(EPOCH FROM (now() - p.requested_at)) / 86400 AS age_days
    FROM public.price_requests p
    LEFT JOIN public.leads l ON l.id = p.lead_id
    LEFT JOIN public.offices o ON o.id = l.office_id
    LEFT JOIN public.enquiry_items ei ON ei.id = p.enquiry_item_id
    LEFT JOIN public.profiles pr ON pr.id = COALESCE(p.resolved_by, p.assigned_to, p.requested_by)
    WHERE (_office IS NULL OR l.office_id = _office)
      AND (
        _department IS NULL OR _department = 'all'
        OR EXISTS (
          SELECT 1 FROM public.user_roles ur
          WHERE ur.user_id = COALESCE(p.resolved_by, p.assigned_to, p.requested_by)
            AND ur.role::text = _department
        )
      )
  ),
  flagged AS (
    SELECT s.*,
      (s.in_res AND s.status = 'resolved') AS is_resolved,
      (s.in_res AND s.status = 'no_price') AS is_no_price,
      (s.in_res AND s.target_rate IS NOT NULL AND s.target_rate > 0 AND s.resolved_price IS NOT NULL) AS has_tgt,
      (s.in_res AND s.tat_deadline IS NOT NULL AND s.resolved_at <= s.tat_deadline) AS tat_ok,
      (s.in_res AND s.tat_deadline IS NOT NULL AND s.resolved_at > s.tat_deadline) AS tat_late,
      (s.sales_outcome = 'won') AS is_won,
      (s.sales_outcome = 'lost') AS is_lost
    FROM scoped s
  ),
  offenders AS (
    SELECT f.*,
      CASE _metric
        WHEN 'price_gap_pct' THEN f.gap_pct
        WHEN 'target_match_pct' THEN COALESCE(f.gap_pct, 0)
        WHEN 'tat_compliance_pct' THEN EXTRACT(EPOCH FROM (f.resolved_at - f.tat_deadline)) / 3600
        WHEN 'avg_resolution_hours' THEN f.hours_taken
        WHEN 'backlog_open' THEN f.age_days
        WHEN 'coverage_pct' THEN f.age_days
        WHEN 'no_price_rate_pct' THEN f.age_days
        ELSE f.age_days
      END AS severity
    FROM flagged f
    WHERE CASE _metric
      WHEN 'coverage_pct' THEN f.in_raised AND NOT COALESCE(f.is_resolved, false)
      WHEN 'no_price_rate_pct' THEN f.is_no_price
      WHEN 'tat_compliance_pct' THEN f.tat_late
      WHEN 'avg_resolution_hours' THEN f.in_res AND f.hours_taken IS NOT NULL
      WHEN 'target_match_pct' THEN f.has_tgt AND NOT f.matched
      WHEN 'price_gap_pct' THEN f.has_tgt AND f.gap_pct > 0
      WHEN 'backlog_open' THEN f.is_open
      WHEN 'win_rate_pct' THEN f.is_lost
      WHEN 'multi_quote_pct' THEN f.is_resolved
      ELSE f.in_raised
    END
  ),
  metric_by AS (
    SELECT 'region'::text AS dim, COALESCE(office_name, 'Unassigned branch') AS label,
      count(*) FILTER (WHERE in_raised) AS raised,
      count(*) FILTER (WHERE is_resolved) AS resolved,
      count(*) FILTER (WHERE is_no_price) AS no_price,
      count(*) FILTER (WHERE has_tgt) AS tgt,
      count(*) FILTER (WHERE has_tgt AND matched) AS tgt_matched,
      AVG(gap_pct) FILTER (WHERE has_tgt) AS avg_gap,
      count(*) FILTER (WHERE tat_ok) AS tat_ok,
      count(*) FILTER (WHERE tat_late) AS tat_late,
      AVG(hours_taken) FILTER (WHERE in_res) AS avg_hours,
      count(*) FILTER (WHERE is_open) AS open_cnt,
      count(*) FILTER (WHERE is_won) AS won,
      count(*) FILTER (WHERE is_lost) AS lost
    FROM flagged GROUP BY 2
    UNION ALL
    SELECT 'department', department,
      count(*) FILTER (WHERE in_raised),
      count(*) FILTER (WHERE is_resolved),
      count(*) FILTER (WHERE is_no_price),
      count(*) FILTER (WHERE has_tgt),
      count(*) FILTER (WHERE has_tgt AND matched),
      AVG(gap_pct) FILTER (WHERE has_tgt),
      count(*) FILTER (WHERE tat_ok),
      count(*) FILTER (WHERE tat_late),
      AVG(hours_taken) FILTER (WHERE in_res),
      count(*) FILTER (WHERE is_open),
      count(*) FILTER (WHERE is_won),
      count(*) FILTER (WHERE is_lost)
    FROM flagged GROUP BY 2
    UNION ALL
    SELECT 'owner', owner_name,
      count(*) FILTER (WHERE in_raised),
      count(*) FILTER (WHERE is_resolved),
      count(*) FILTER (WHERE is_no_price),
      count(*) FILTER (WHERE has_tgt),
      count(*) FILTER (WHERE has_tgt AND matched),
      AVG(gap_pct) FILTER (WHERE has_tgt),
      count(*) FILTER (WHERE tat_ok),
      count(*) FILTER (WHERE tat_late),
      AVG(hours_taken) FILTER (WHERE in_res),
      count(*) FILTER (WHERE is_open),
      count(*) FILTER (WHERE is_won),
      count(*) FILTER (WHERE is_lost)
    FROM flagged GROUP BY 2
  ),
  breakdown AS (
    SELECT dim, label,
      CASE _metric
        WHEN 'coverage_pct' THEN COALESCE(resolved::numeric / NULLIF(raised, 0) * 100, 0)
        WHEN 'no_price_rate_pct' THEN COALESCE(no_price::numeric / NULLIF(raised, 0) * 100, 0)
        WHEN 'tat_compliance_pct' THEN COALESCE(tat_ok::numeric / NULLIF(tat_ok + tat_late, 0) * 100, 0)
        WHEN 'avg_resolution_hours' THEN COALESCE(avg_hours, 0)
        WHEN 'target_match_pct' THEN COALESCE(tgt_matched::numeric / NULLIF(tgt, 0) * 100, 0)
        WHEN 'price_gap_pct' THEN COALESCE(avg_gap, 0)
        WHEN 'backlog_open' THEN open_cnt
        WHEN 'win_rate_pct' THEN COALESCE(won::numeric / NULLIF(won + lost, 0) * 100, 0)
        ELSE 0
      END AS value,
      CASE _metric
        WHEN 'coverage_pct' THEN raised - resolved
        WHEN 'no_price_rate_pct' THEN no_price
        WHEN 'tat_compliance_pct' THEN tat_late
        WHEN 'avg_resolution_hours' THEN resolved
        WHEN 'target_match_pct' THEN tgt - tgt_matched
        WHEN 'price_gap_pct' THEN tgt
        WHEN 'backlog_open' THEN open_cnt
        WHEN 'win_rate_pct' THEN lost
        ELSE raised
      END AS offenders,
      raised AS volume
    FROM metric_by
  )
  SELECT jsonb_build_object(
    'metric', _metric,
    'total_offenders', (SELECT count(*) FROM offenders),
    'rows', COALESCE((
      SELECT jsonb_agg(r ORDER BY (r->>'severity')::numeric DESC NULLS LAST)
      FROM (
        SELECT to_jsonb(x) AS r FROM (
          SELECT id, lead_id, item_label, quantity, office_name, department, owner_name,
                 requested_at, resolved_at, tat_deadline, status, target_rate, resolved_price,
                 ROUND(gap_pct::numeric, 2) AS gap_pct,
                 ROUND(hours_taken::numeric, 2) AS hours_taken,
                 ROUND(age_days::numeric, 1) AS age_days,
                 sales_outcome,
                 ROUND(severity::numeric, 2) AS severity
          FROM offenders
          ORDER BY severity DESC NULLS LAST
          LIMIT _limit
        ) x
      ) y
    ), '[]'::jsonb),
    'breakdown', COALESCE((
      SELECT jsonb_agg(to_jsonb(b) ORDER BY b.offenders DESC)
      FROM (SELECT * FROM breakdown WHERE volume > 0 OR offenders > 0) b
    ), '[]'::jsonb)
  ));
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_variance_drilldown(text, timestamptz, timestamptz, uuid, text, int) TO authenticated;