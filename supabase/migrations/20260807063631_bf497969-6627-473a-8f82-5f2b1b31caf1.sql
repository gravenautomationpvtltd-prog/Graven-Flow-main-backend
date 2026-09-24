ALTER TABLE public.price_requests
  ADD COLUMN IF NOT EXISTS sales_outcome_at timestamptz;

-- Auto-stamp target match whenever a price is written back
CREATE OR REPLACE FUNCTION public.sync_target_matched()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.target_rate IS NOT NULL AND NEW.target_rate > 0 AND NEW.resolved_price IS NOT NULL THEN
    IF NEW.resolved_price <= NEW.target_rate THEN
      IF NEW.target_matched_at IS NULL THEN
        NEW.target_matched_at := COALESCE(NEW.resolved_at, now());
      END IF;
    ELSE
      NEW.target_matched_at := NULL;
    END IF;
  END IF;

  IF TG_OP = 'UPDATE'
     AND NEW.sales_outcome IS DISTINCT FROM OLD.sales_outcome
     AND NEW.sales_outcome IS NOT NULL THEN
    NEW.sales_outcome_at := now();
  ELSIF TG_OP = 'INSERT' AND NEW.sales_outcome IS NOT NULL THEN
    NEW.sales_outcome_at := now();
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_target_matched ON public.price_requests;
CREATE TRIGGER trg_sync_target_matched
BEFORE INSERT OR UPDATE ON public.price_requests
FOR EACH ROW EXECUTE FUNCTION public.sync_target_matched();

-- Backfill existing rows
UPDATE public.price_requests
SET target_matched_at = COALESCE(target_matched_at, resolved_at, now())
WHERE target_rate IS NOT NULL AND target_rate > 0
  AND resolved_price IS NOT NULL AND resolved_price <= target_rate
  AND target_matched_at IS NULL;

UPDATE public.price_requests
SET target_matched_at = NULL
WHERE target_matched_at IS NOT NULL
  AND target_rate IS NOT NULL AND target_rate > 0
  AND resolved_price IS NOT NULL AND resolved_price > target_rate;

-- Region + department scoped scorecard for the target-matched workflow
CREATE OR REPLACE FUNCTION public.get_target_match_scorecard(
  _from timestamptz,
  _to timestamptz,
  _office uuid DEFAULT NULL,
  _department text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  result jsonb;
BEGIN
  WITH scoped AS (
    SELECT p.*, l.office_id
    FROM public.price_requests p
    LEFT JOIN public.leads l ON l.id = p.lead_id
    WHERE (_office IS NULL OR l.office_id = _office)
      AND (
        _department IS NULL
        OR _department = 'all'
        OR EXISTS (
          SELECT 1 FROM public.user_roles ur
          WHERE ur.user_id = COALESCE(p.resolved_by, p.assigned_to, p.requested_by)
            AND ur.role::text = _department
        )
      )
  ),
  raised AS (
    SELECT * FROM scoped WHERE requested_at >= _from AND requested_at <= _to
  ),
  res AS (
    SELECT * FROM scoped WHERE resolved_at IS NOT NULL AND resolved_at >= _from AND resolved_at <= _to
  ),
  openq AS (
    SELECT * FROM scoped WHERE resolved_at IS NULL AND status IS DISTINCT FROM 'no_price'
  ),
  tgt AS (
    SELECT *,
           (resolved_price - target_rate) / NULLIF(target_rate, 0) * 100 AS gap_pct,
           (target_matched_at IS NOT NULL) AS matched
    FROM res
    WHERE target_rate IS NOT NULL AND target_rate > 0 AND resolved_price IS NOT NULL
  ),
  outc AS (
    SELECT * FROM scoped
    WHERE sales_outcome IS NOT NULL
      AND COALESCE(sales_outcome_at, resolved_at, requested_at) >= _from
      AND COALESCE(sales_outcome_at, resolved_at, requested_at) <= _to
  )
  SELECT jsonb_build_object(
    'requests_raised', (SELECT count(*) FROM raised),
    'prices_given', (SELECT count(*) FROM res WHERE status = 'resolved'),
    'coverage_pct', (SELECT COALESCE(count(*) FILTER (WHERE status = 'resolved')::numeric
                                     / NULLIF((SELECT count(*) FROM raised), 0) * 100, 0) FROM res),
    'no_price_rate_pct', (SELECT COALESCE(count(*) FILTER (WHERE status = 'no_price')::numeric
                                     / NULLIF((SELECT count(*) FROM raised), 0) * 100, 0) FROM res),
    'backlog_open', (SELECT count(*) FROM openq),
    'target_requests', (SELECT count(*) FROM tgt),
    'target_matched', (SELECT count(*) FROM tgt WHERE matched),
    'target_match_pct', (SELECT COALESCE(count(*) FILTER (WHERE matched)::numeric / NULLIF(count(*), 0) * 100, 0) FROM tgt),
    'price_gap_pct', (SELECT COALESCE(AVG(gap_pct), 0) FROM tgt),
    'price_gap_median_pct', (SELECT COALESCE(percentile_cont(0.5) WITHIN GROUP (ORDER BY gap_pct), 0) FROM tgt),
    'price_gap_p90_pct', (SELECT COALESCE(percentile_cont(0.9) WITHIN GROUP (ORDER BY gap_pct), 0) FROM tgt),
    'price_gap_worst_pct', (SELECT COALESCE(MAX(gap_pct), 0) FROM tgt),
    'avg_resolution_hours', (SELECT COALESCE(AVG(EXTRACT(EPOCH FROM (resolved_at - requested_at))/3600), 0) FROM res),
    'median_resolution_hours', (SELECT COALESCE(percentile_cont(0.5) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (resolved_at - requested_at))/3600), 0) FROM res),
    'matched_avg_resolution_hours', (SELECT COALESCE(AVG(EXTRACT(EPOCH FROM (resolved_at - requested_at))/3600), 0) FROM tgt WHERE matched),
    'tat_met', (SELECT count(*) FROM res WHERE tat_deadline IS NOT NULL AND resolved_at <= tat_deadline),
    'tat_missed', (SELECT count(*) FROM res WHERE tat_deadline IS NOT NULL AND resolved_at > tat_deadline),
    'tat_compliance_pct', (SELECT COALESCE(count(*) FILTER (WHERE tat_deadline IS NOT NULL AND resolved_at <= tat_deadline)::numeric
                                    / NULLIF(count(*) FILTER (WHERE tat_deadline IS NOT NULL), 0) * 100, 0) FROM res),
    'breached_open', (SELECT count(*) FROM openq WHERE tat_deadline IS NOT NULL AND now() > tat_deadline),
    'outcomes_recorded', (SELECT count(*) FROM outc),
    'outcome_quoted', (SELECT count(*) FROM outc WHERE sales_outcome = 'quoted'),
    'outcome_won', (SELECT count(*) FROM outc WHERE sales_outcome = 'won'),
    'outcome_lost', (SELECT count(*) FROM outc WHERE sales_outcome = 'lost'),
    'outcome_on_hold', (SELECT count(*) FROM outc WHERE sales_outcome = 'on_hold'),
    'win_rate_pct', (SELECT COALESCE(count(*) FILTER (WHERE sales_outcome = 'won')::numeric
                                    / NULLIF(count(*) FILTER (WHERE sales_outcome IN ('won','lost')), 0) * 100, 0) FROM outc),
    'matched_pending_outcome', (SELECT count(*) FROM tgt WHERE matched AND sales_outcome IS NULL),
    'won_avg_gap_pct', (SELECT COALESCE(AVG(gap_pct), 0) FROM tgt WHERE sales_outcome = 'won'),
    'lost_avg_gap_pct', (SELECT COALESCE(AVG(gap_pct), 0) FROM tgt WHERE sales_outcome = 'lost')
  ) INTO result;

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_target_match_scorecard(timestamptz, timestamptz, uuid, text) TO authenticated;