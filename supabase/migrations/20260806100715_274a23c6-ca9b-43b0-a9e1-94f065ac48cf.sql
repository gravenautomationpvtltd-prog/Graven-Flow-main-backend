CREATE OR REPLACE FUNCTION public.get_procurement_scorecard(
  _from timestamptz,
  _to timestamptz,
  _user uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  result jsonb;
BEGIN
  WITH pr AS (
    SELECT * FROM public.price_requests p
    WHERE p.requested_at >= _from AND p.requested_at <= _to
      AND (_user IS NULL OR p.assigned_to = _user OR p.resolved_by = _user)
  ),
  res AS (
    SELECT * FROM public.price_requests p
    WHERE p.resolved_at IS NOT NULL AND p.resolved_at >= _from AND p.resolved_at <= _to
      AND (_user IS NULL OR p.resolved_by = _user OR p.assigned_to = _user)
  ),
  openq AS (
    SELECT * FROM public.price_requests p
    WHERE p.resolved_at IS NULL AND p.status IS DISTINCT FROM 'no_price'
      AND (_user IS NULL OR p.assigned_to = _user)
  ),
  q AS (
    SELECT * FROM public.price_request_quotes qq
    WHERE qq.created_at >= _from AND qq.created_at <= _to
      AND (_user IS NULL OR qq.created_by = _user)
  ),
  po AS (
    SELECT * FROM public.purchase_orders o
    WHERE o.created_at >= _from AND o.created_at <= _to
      AND (_user IS NULL OR o.created_by = _user)
  )
  SELECT jsonb_build_object(
    'requests_raised', (SELECT count(*) FROM pr),
    'requests_unassigned', (SELECT count(*) FROM openq WHERE assigned_to IS NULL),
    'prices_given', (SELECT count(*) FROM res WHERE status = 'resolved'),
    'no_price', (SELECT count(*) FROM res WHERE status = 'no_price')
                + (SELECT count(*) FROM pr WHERE status = 'no_price' AND resolved_at IS NULL),
    'backlog_open', (SELECT count(*) FROM openq),
    'age_0_1', (SELECT count(*) FROM openq WHERE now() - requested_at < interval '1 day'),
    'age_1_3', (SELECT count(*) FROM openq WHERE now() - requested_at >= interval '1 day' AND now() - requested_at < interval '3 days'),
    'age_3_7', (SELECT count(*) FROM openq WHERE now() - requested_at >= interval '3 days' AND now() - requested_at < interval '7 days'),
    'age_7_plus', (SELECT count(*) FROM openq WHERE now() - requested_at >= interval '7 days'),
    'oldest_open_days', (SELECT COALESCE(EXTRACT(EPOCH FROM (now() - min(requested_at)))/86400, 0) FROM openq),
    'avg_resolution_hours', (SELECT COALESCE(AVG(EXTRACT(EPOCH FROM (resolved_at - requested_at))/3600), 0) FROM res),
    'median_resolution_hours', (SELECT COALESCE(percentile_cont(0.5) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (resolved_at - requested_at))/3600), 0) FROM res),
    'tat_met', (SELECT count(*) FROM res WHERE tat_deadline IS NOT NULL AND resolved_at <= tat_deadline),
    'tat_missed', (SELECT count(*) FROM res WHERE tat_deadline IS NOT NULL AND resolved_at > tat_deadline),
    'breached_open', (SELECT count(*) FROM openq WHERE tat_deadline IS NOT NULL AND now() > tat_deadline),
    'escalated_open', (SELECT count(*) FROM openq WHERE tat_status IN ('escalated','critical')),
    'target_requests', (SELECT count(*) FROM res WHERE target_rate IS NOT NULL AND target_rate > 0),
    'target_matched', (SELECT count(*) FROM res WHERE target_matched_at IS NOT NULL
                        OR (target_rate IS NOT NULL AND target_rate > 0 AND resolved_price IS NOT NULL AND resolved_price <= target_rate)),
    'avg_gap_vs_target_pct', (SELECT COALESCE(AVG((resolved_price - target_rate) / NULLIF(target_rate,0) * 100), 0)
                               FROM res WHERE target_rate IS NOT NULL AND target_rate > 0 AND resolved_price IS NOT NULL),
    'quotes_captured', (SELECT count(*) FROM q),
    'quotes_pushed', (SELECT count(*) FROM q WHERE is_pushed),
    'multi_quote_items', (SELECT count(*) FROM (SELECT price_request_id FROM q GROUP BY 1 HAVING count(*) > 1) s),
    'quoted_items', (SELECT count(DISTINCT price_request_id) FROM q),
    'suppliers_quoted', (SELECT count(DISTINCT COALESCE(supplier_id::text, supplier_name)) FROM q),
    'negotiation_saving_pct', (
      SELECT COALESCE(AVG((first_p - last_p) / NULLIF(first_p,0) * 100), 0) FROM (
        SELECT price_request_id,
               (array_agg(purchase_price ORDER BY created_at))[1] AS first_p,
               (array_agg(purchase_price ORDER BY created_at DESC))[1] AS last_p
        FROM q GROUP BY price_request_id HAVING count(*) > 1
      ) n
    ),
    'po_count', (SELECT count(*) FROM po),
    'po_value', (SELECT COALESCE(SUM(grand_total),0) FROM po),
    'suppliers_new', (SELECT count(*) FROM public.suppliers s WHERE s.created_at >= _from AND s.created_at <= _to),
    'grn_count', (SELECT count(*) FROM public.goods_receipt_notes g WHERE g.created_at >= _from AND g.created_at <= _to)
  ) INTO result;

  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_procurement_team_board(
  _from timestamptz,
  _to timestamptz
)
RETURNS TABLE (
  user_id uuid,
  user_name text,
  assigned_count bigint,
  open_count bigint,
  resolved_count bigint,
  no_price_count bigint,
  avg_resolution_hours numeric,
  tat_met bigint,
  tat_missed bigint,
  breached_open bigint,
  quotes_captured bigint,
  target_matched bigint,
  po_count bigint,
  po_value numeric
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  WITH people AS (
    SELECT DISTINCT p.id, COALESCE(p.full_name, 'Unknown') AS full_name
    FROM public.profiles p
    JOIN public.user_roles ur ON ur.user_id = p.id
    WHERE p.is_active AND ur.role IN ('procurement','procurement_manager','import_procurement','warehouse')
  )
  SELECT
    pe.id,
    pe.full_name,
    (SELECT count(*) FROM public.price_requests r WHERE r.assigned_to = pe.id AND r.requested_at BETWEEN _from AND _to),
    (SELECT count(*) FROM public.price_requests r WHERE r.assigned_to = pe.id AND r.resolved_at IS NULL AND r.status IS DISTINCT FROM 'no_price'),
    (SELECT count(*) FROM public.price_requests r WHERE r.resolved_by = pe.id AND r.status = 'resolved' AND r.resolved_at BETWEEN _from AND _to),
    (SELECT count(*) FROM public.price_requests r WHERE r.resolved_by = pe.id AND r.status = 'no_price' AND r.resolved_at BETWEEN _from AND _to),
    (SELECT COALESCE(AVG(EXTRACT(EPOCH FROM (r.resolved_at - r.requested_at))/3600),0) FROM public.price_requests r WHERE r.resolved_by = pe.id AND r.resolved_at BETWEEN _from AND _to),
    (SELECT count(*) FROM public.price_requests r WHERE r.resolved_by = pe.id AND r.resolved_at BETWEEN _from AND _to AND r.tat_deadline IS NOT NULL AND r.resolved_at <= r.tat_deadline),
    (SELECT count(*) FROM public.price_requests r WHERE r.resolved_by = pe.id AND r.resolved_at BETWEEN _from AND _to AND r.tat_deadline IS NOT NULL AND r.resolved_at > r.tat_deadline),
    (SELECT count(*) FROM public.price_requests r WHERE r.assigned_to = pe.id AND r.resolved_at IS NULL AND r.tat_deadline IS NOT NULL AND now() > r.tat_deadline),
    (SELECT count(*) FROM public.price_request_quotes qq WHERE qq.created_by = pe.id AND qq.created_at BETWEEN _from AND _to),
    (SELECT count(*) FROM public.price_requests r WHERE r.resolved_by = pe.id AND r.resolved_at BETWEEN _from AND _to
        AND (r.target_matched_at IS NOT NULL OR (r.target_rate IS NOT NULL AND r.target_rate > 0 AND r.resolved_price IS NOT NULL AND r.resolved_price <= r.target_rate))),
    (SELECT count(*) FROM public.purchase_orders o WHERE o.created_by = pe.id AND o.created_at BETWEEN _from AND _to),
    (SELECT COALESCE(SUM(o.grand_total),0) FROM public.purchase_orders o WHERE o.created_by = pe.id AND o.created_at BETWEEN _from AND _to)
  FROM people pe
  ORDER BY 6 DESC NULLS LAST;
$$;

GRANT EXECUTE ON FUNCTION public.get_procurement_scorecard(timestamptz, timestamptz, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_procurement_team_board(timestamptz, timestamptz) TO authenticated;