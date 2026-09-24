
-- 1) Helpful index for latest-qualification-per-lead lookups
CREATE INDEX IF NOT EXISTS idx_lead_qualification_lead_qualified_desc
  ON public.lead_qualification(lead_id, qualified_at DESC);

-- 2) Qualification reassignment trigger:
--    'spt' -> immediate Sales reassignment via assign_lead_to_spt
--    'tst' -> stay in Technical queue (NO Sales reassignment)
--    others -> no-op
CREATE OR REPLACE FUNCTION public.trg_fn_reassign_on_qualification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _enq_count int;
BEGIN
  IF NEW.routed_to = 'spt' THEN
    SELECT COUNT(*) INTO _enq_count
    FROM public.enquiry_items
    WHERE lead_id = NEW.lead_id;

    IF _enq_count = 0 THEN
      RAISE EXCEPTION 'Cannot route lead to SPT without at least one enquiry item. Please add the enquiry first.'
        USING ERRCODE = 'check_violation';
    END IF;

    PERFORM public.assign_lead_to_spt(NEW.lead_id);
  END IF;

  -- 'tst', 'discard', 'nurture' -> no Sales reassignment here.
  RETURN NEW;
END;
$function$;

-- 3) get_spt_inbox: only show leads truly ready for Sales
--    - Use the LATEST qualification per lead
--    - Simple route ('spt') → visible in Sales
--    - Technical route ('tst') → visible in Sales ONLY after a BOQ handoff
--    - 'discard' / 'nurture' → never visible
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
  WITH latest_q AS (
    SELECT DISTINCT ON (q.lead_id)
      q.lead_id, q.qualification_type, q.routed_to, q.qualified_at,
      q.qualified_by, q.decision_reason
    FROM public.lead_qualification q
    ORDER BY q.lead_id, q.qualified_at DESC, q.created_at DESC
  ),
  base AS (
    SELECT l.*, lq.qualification_type, lq.routed_to, lq.qualified_at, lq.qualified_by
    FROM public.leads l
    JOIN latest_q lq ON lq.lead_id = l.id
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
