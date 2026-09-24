CREATE INDEX IF NOT EXISTS idx_prq_supplier_created ON public.price_request_quotes (supplier_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_prq_request_round ON public.price_request_quotes (price_request_id, round);

CREATE OR REPLACE FUNCTION public.get_supplier_quote_stats(_from timestamptz DEFAULT (now() - interval '365 days'), _to timestamptz DEFAULT now())
RETURNS TABLE (
  supplier_id uuid,
  supplier_name text,
  quotes_count bigint,
  pushed_count bigint,
  win_rate numeric,
  avg_lead_time numeric,
  avg_price numeric,
  target_met_count bigint,
  avg_gap_vs_lowest_pct numeric,
  last_quoted_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH scoped AS (
    SELECT q.*, COALESCE(q.sale_price, q.purchase_price) AS eff, pr.target_rate
    FROM public.price_request_quotes q
    JOIN public.price_requests pr ON pr.id = q.price_request_id
    WHERE q.created_at >= _from AND q.created_at <= _to
      AND public.is_same_tenant(pr.tenant_id)
      AND (public.is_procurement_or_above(auth.uid())
           OR public.is_manager_or_above(auth.uid())
           OR public.has_role(auth.uid(), 'procurement_manager')
           OR public.has_role(auth.uid(), 'cct'))
  ), lows AS (
    SELECT price_request_id, round, MIN(eff) AS low
    FROM scoped GROUP BY price_request_id, round
  )
  SELECT
    s.supplier_id,
    COALESCE(sup.name, MAX(s.supplier_name), 'Unlinked supplier') AS supplier_name,
    COUNT(*)::bigint,
    COUNT(*) FILTER (WHERE s.is_pushed)::bigint,
    ROUND(100.0 * COUNT(*) FILTER (WHERE s.is_pushed) / NULLIF(COUNT(*), 0), 1),
    ROUND(AVG(s.lead_time_days)::numeric, 1),
    ROUND(AVG(s.eff)::numeric, 2),
    COUNT(*) FILTER (WHERE s.target_rate IS NOT NULL AND s.eff <= s.target_rate)::bigint,
    ROUND(AVG(CASE WHEN l.low > 0 THEN 100.0 * (s.eff - l.low) / l.low END)::numeric, 1),
    MAX(s.created_at)
  FROM scoped s
  LEFT JOIN lows l ON l.price_request_id = s.price_request_id AND l.round = s.round
  LEFT JOIN public.suppliers sup ON sup.id = s.supplier_id
  GROUP BY s.supplier_id, sup.name
  ORDER BY COUNT(*) DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_supplier_quote_stats(timestamptz, timestamptz) TO authenticated;