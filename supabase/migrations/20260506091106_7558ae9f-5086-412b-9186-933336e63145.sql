-- 1) Add is_active column to lead_qualification (history mode)
ALTER TABLE public.lead_qualification
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

-- Backfill: keep only the latest qualification per lead as active
WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (PARTITION BY lead_id ORDER BY qualified_at DESC, created_at DESC) AS rn
  FROM public.lead_qualification
)
UPDATE public.lead_qualification q
SET is_active = (r.rn = 1)
FROM ranked r
WHERE r.id = q.id;

-- 2) Replace the hard unique index on lead_id with a partial unique index on active rows
DROP INDEX IF EXISTS public.uq_lead_qualification_active;
CREATE UNIQUE INDEX uq_lead_qualification_active
  ON public.lead_qualification(lead_id) WHERE is_active = true;

-- 3) BEFORE INSERT trigger: deactivate the prior active qualification for this lead
CREATE OR REPLACE FUNCTION public.fn_deactivate_prior_qualification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.is_active IS NULL THEN
    NEW.is_active := true;
  END IF;
  IF NEW.is_active = true THEN
    UPDATE public.lead_qualification
       SET is_active = false
     WHERE lead_id = NEW.lead_id
       AND is_active = true
       AND (id IS DISTINCT FROM NEW.id);
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_deactivate_prior_qualification ON public.lead_qualification;
CREATE TRIGGER trg_deactivate_prior_qualification
BEFORE INSERT ON public.lead_qualification
FOR EACH ROW
EXECUTE FUNCTION public.fn_deactivate_prior_qualification();

-- 4) Helper: lead IDs the current user has ever qualified (so CRO can still see post-handoff)
CREATE OR REPLACE FUNCTION public.get_user_qualified_lead_ids(_uid uuid)
RETURNS uuid[]
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT COALESCE(array_agg(DISTINCT q.lead_id), ARRAY[]::uuid[])
  FROM public.lead_qualification q
  WHERE q.qualified_by = _uid;
$function$;

-- 5) Extend lead visibility so qualifiers retain SELECT access on the leads they qualified
DROP POLICY IF EXISTS "Lead visibility by role hierarchy" ON public.leads;

CREATE POLICY "Lead visibility by role hierarchy"
ON public.leads
FOR SELECT
USING (
  is_my_tenant(tenant_id) AND (
    is_admin_or_above(auth.uid())
    OR (assigned_to = auth.uid())
    OR (is_manager_or_above(auth.uid()) AND (assigned_to = ANY (get_subordinate_ids(auth.uid()))))
    OR ((customer_id IS NOT NULL) AND (customer_id = ANY (get_user_cro_customer_ids(auth.uid()))))
    OR (id = ANY (get_user_quotation_lead_ids(auth.uid())))
    OR (id = ANY (get_user_qualified_lead_ids(auth.uid())))
  )
);

-- 6) Update get_lqt_stats to use only ACTIVE qualifications (avoids double counting after re-route)
CREATE OR REPLACE FUNCTION public.get_lqt_stats(p_from timestamp with time zone DEFAULT NULL::timestamp with time zone, p_to timestamp with time zone DEFAULT NULL::timestamp with time zone)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
        SELECT 1 FROM public.lead_qualification q WHERE q.lead_id = l.id AND q.is_active = true
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
      AND NOT EXISTS (SELECT 1 FROM public.lead_qualification q WHERE q.lead_id = l.id AND q.is_active = true)
    ORDER BY l.created_at ASC
    LIMIT 5
  ) sub;

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
    JOIN public.lead_qualification q ON q.lead_id = l.id AND q.is_active = true
    WHERE l.tenant_id = v_tenant
      AND l.deleted_at IS NULL
      AND q.qualified_by IN (SELECT user_id FROM cro_users)
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

  WITH cro_users AS (
    SELECT ur.user_id FROM public.user_roles ur
    JOIN public.profiles p ON p.id = ur.user_id
    WHERE ur.role = 'cro' AND p.tenant_id = v_tenant
  ),
  routed AS (
    SELECT l.id, l.status, l.has_enquiry, q.routed_to,
           EXISTS(SELECT 1 FROM public.enquiry_items ei WHERE ei.lead_id = l.id) AS has_items
    FROM public.leads l
    JOIN public.lead_qualification q ON q.lead_id = l.id AND q.is_active = true
    WHERE l.tenant_id = v_tenant
      AND l.deleted_at IS NULL
      AND q.routed_to IN ('spt','tst')
      AND q.qualified_by IN (SELECT user_id FROM cro_users)
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
    JOIN public.lead_qualification q ON q.lead_id = l.id AND q.is_active = true
    WHERE l.tenant_id = v_tenant
      AND l.deleted_at IS NULL
      AND q.qualified_by IN (SELECT user_id FROM cro_users)
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
$function$;

-- 7) Update get_spt_inbox so it considers only the LATEST ACTIVE qualification per lead
CREATE OR REPLACE FUNCTION public.get_spt_inbox()
RETURNS TABLE(
  id uuid, title text, customer_query text, created_at timestamptz,
  has_enquiry boolean, enquiry_status text, source text,
  assigned_to uuid, owner_name text,
  customer_id uuid, customer_company text, customer_contact text,
  customer_phone text, customer_email text, customer_segment text,
  qualification_type text, routed_to text, qualified_at timestamptz, qualifier_name text,
  item_count integer, total_qty numeric,
  pending_pricing integer, verified_auto integer, updated_pricing integer,
  latest_quotation_id uuid, latest_quotation_status text,
  latest_quotation_sent_at timestamptz, latest_quotation_created_at timestamptz,
  latest_quotation_grand_total numeric,
  handoff_at timestamptz, stage text, pricing_mode text,
  lead_status text, won_at timestamptz, lost_at timestamptz, estimated_value numeric
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_tenant uuid;
  v_is_admin boolean;
BEGIN
  IF v_uid IS NULL THEN RETURN; END IF;

  SELECT tu.tenant_id INTO v_tenant
  FROM public.tenant_users tu
  WHERE tu.user_id = v_uid AND tu.is_active = true
  LIMIT 1;

  v_is_admin := public.is_admin_or_above(v_uid);

  RETURN QUERY
  WITH active_q AS (
    SELECT q.lead_id, q.qualification_type, q.routed_to, q.qualified_at,
           q.qualified_by, q.decision_reason
    FROM public.lead_qualification q
    WHERE q.is_active = true
  ),
  base AS (
    SELECT l.*, lq.qualification_type, lq.routed_to, lq.qualified_at, lq.qualified_by
    FROM public.leads l
    JOIN active_q lq ON lq.lead_id = l.id
    LEFT JOIN public.boqs b ON b.lead_id = l.id
    WHERE l.deleted_at IS NULL
      AND l.tenant_id = v_tenant
      AND COALESCE(l.has_enquiry, false) = true
      AND (v_is_admin OR l.assigned_to = v_uid)
      AND (
        lq.routed_to::text = 'spt'
        OR (lq.routed_to::text = 'tst' AND b.status::text = 'handed_off')
      )
  ),
  enq AS (
    SELECT ei.lead_id,
           COUNT(*)::int AS item_count,
           COALESCE(SUM(ei.quantity),0)::numeric AS total_qty,
           COUNT(*) FILTER (WHERE ei.pricing_status = 'pending')::int AS pending_pricing,
           COUNT(*) FILTER (WHERE ei.pricing_status = 'verified_auto')::int AS verified_auto,
           COUNT(*) FILTER (WHERE ei.pricing_status = 'updated')::int AS updated_pricing
    FROM public.enquiry_items ei
    WHERE ei.lead_id IN (SELECT base.id FROM base)
    GROUP BY ei.lead_id
  ),
  pr_state AS (
    SELECT ei.lead_id,
           COUNT(*) FILTER (WHERE pr.status IN ('pending','in_progress'))::int AS open_requests
    FROM public.price_requests pr
    JOIN public.enquiry_items ei ON ei.id = pr.enquiry_item_id
    WHERE ei.lead_id IN (SELECT base.id FROM base)
    GROUP BY ei.lead_id
  ),
  q_real AS (
    SELECT q.*,
           ROW_NUMBER() OVER (PARTITION BY q.lead_id ORDER BY q.created_at DESC) AS rn
    FROM public.quotations q
    WHERE q.deleted_at IS NULL
      AND q.lead_id IN (SELECT base.id FROM base)
      AND (q.sent_at IS NOT NULL OR COALESCE(q.grand_total,0) > 0 OR (q.status IS NOT NULL AND q.status::text <> 'draft'))
  ),
  latest_quote AS (
    SELECT * FROM q_real WHERE q_real.rn = 1
  )
  SELECT
    b.id,
    b.title,
    b.customer_query,
    b.created_at,
    b.has_enquiry,
    b.enquiry_status::text,
    b.source::text,
    b.assigned_to,
    op.full_name AS owner_name,
    c.id AS customer_id,
    c.company_name AS customer_company,
    c.contact_person AS customer_contact,
    c.phone AS customer_phone,
    c.email AS customer_email,
    c.segment::text AS customer_segment,
    b.qualification_type::text,
    b.routed_to::text,
    b.qualified_at,
    qp.full_name AS qualifier_name,
    COALESCE(e.item_count, 0) AS item_count,
    COALESCE(e.total_qty, 0) AS total_qty,
    COALESCE(e.pending_pricing, 0) AS pending_pricing,
    COALESCE(e.verified_auto, 0) AS verified_auto,
    COALESCE(e.updated_pricing, 0) AS updated_pricing,
    lqq.id AS latest_quotation_id,
    lqq.status::text AS latest_quotation_status,
    lqq.sent_at AS latest_quotation_sent_at,
    lqq.created_at AS latest_quotation_created_at,
    lqq.grand_total AS latest_quotation_grand_total,
    COALESCE(b.qualified_at, b.created_at) AS handoff_at,
    CASE
      WHEN COALESCE(prs.open_requests,0) > 0 AND lqq.id IS NULL THEN 'awaiting'
      WHEN lqq.id IS NOT NULL AND lqq.sent_at IS NOT NULL
           AND lqq.status::text NOT IN ('accepted','rejected','expired')
           AND EXTRACT(EPOCH FROM (now() - lqq.sent_at))/86400 >= 2
        THEN 'awaiting'
      WHEN lqq.id IS NOT NULL AND lqq.status::text IN ('draft','sent')
        THEN 'in_progress'
      WHEN b.has_enquiry = true AND lqq.id IS NULL
        THEN 'new'
      ELSE 'other'
    END AS stage,
    CASE
      WHEN COALESCE(e.item_count,0) = 0 THEN 'none'
      WHEN COALESCE(prs.open_requests,0) > 0 OR COALESCE(e.pending_pricing,0) > 0 THEN 'awaiting'
      WHEN COALESCE(e.verified_auto,0) = COALESCE(e.item_count,0) THEN 'fast'
      ELSE 'updated'
    END AS pricing_mode,
    b.status::text AS lead_status,
    b.won_at,
    b.lost_at,
    b.estimated_value
  FROM base b
  LEFT JOIN public.customers c ON c.id = b.customer_id
  LEFT JOIN public.profiles op ON op.id = b.assigned_to
  LEFT JOIN public.profiles qp ON qp.id = b.qualified_by
  LEFT JOIN enq e ON e.lead_id = b.id
  LEFT JOIN pr_state prs ON prs.lead_id = b.id
  LEFT JOIN latest_quote lqq ON lqq.lead_id = b.id
  ORDER BY b.created_at DESC;
END;
$function$;