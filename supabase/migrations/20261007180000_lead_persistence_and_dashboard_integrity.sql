-- Migration: 20261007180000_lead_persistence_and_dashboard_integrity.sql
-- Goal: Ensure leads/enquiries never disappear or move out of an authorized employee's dashboard
--       due to quotation creation, qualification, handoff, reassignment, or realtime refreshes.

-- 1. get_lead_detail: Ensure former assignees (in lead_assignment_history within 30 days) can always load detail
CREATE OR REPLACE FUNCTION public.get_lead_detail(
  p_lead_id uuid,
  p_include_deleted boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _tenant uuid;
  _lead public.leads%ROWTYPE;
  _can_see boolean := false;
  _result jsonb;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;

  SELECT tenant_id INTO _tenant
  FROM public.tenant_users
  WHERE user_id = _uid AND is_active = true
  LIMIT 1;

  IF _tenant IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT * INTO _lead
  FROM public.leads
  WHERE id = p_lead_id
    AND tenant_id = _tenant
    AND (p_include_deleted OR deleted_at IS NULL)
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  -- Visibility check (mirrors leads SELECT RLS policy, evaluated once)
  SELECT (
    public.is_admin_or_above(_uid)
    OR _lead.assigned_to = _uid
    OR (public.is_manager_or_above(_uid) AND _lead.assigned_to = ANY(public.get_subordinate_ids(_uid)))
    OR (_lead.customer_id IS NOT NULL AND _lead.customer_id = ANY(public.get_user_cro_customer_ids(_uid)))
    OR _lead.id = ANY(public.get_user_quotation_lead_ids(_uid))
    OR _lead.id = ANY(public.get_user_qualified_lead_ids(_uid))
    OR public.was_recent_lead_assignee(_lead.id, _uid)
  ) INTO _can_see;

  IF NOT _can_see THEN
    RETURN NULL;
  END IF;

  SELECT to_jsonb(l.*)
    || jsonb_build_object(
         'customer', (SELECT to_jsonb(c.*) FROM public.customers c WHERE c.id = l.customer_id),
         'assigned_user', (SELECT to_jsonb(p.*) FROM public.profiles p WHERE p.id = l.assigned_to)
       )
  INTO _result
  FROM public.leads l
  WHERE l.id = p_lead_id;

  RETURN _result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_lead_detail(uuid, boolean) TO authenticated;

-- 2. get_spt_inbox: Ensure assigned leads, quotation-linked leads, and recently assigned leads
--    persist permanently in the sales inbox even after quotation creation or workflow handoffs.
CREATE OR REPLACE FUNCTION public.get_spt_inbox(
  p_stage text DEFAULT 'all'::text,
  p_limit integer DEFAULT NULL::integer,
  p_offset integer DEFAULT 0,
  p_search text DEFAULT NULL::text,
  p_sort_by text DEFAULT 'newest_handoff'::text,
  p_sources text[] DEFAULT NULL::text[],
  p_segments text[] DEFAULT NULL::text[],
  p_pricing_modes text[] DEFAULT NULL::text[],
  p_sla_buckets text[] DEFAULT NULL::text[],
  p_customer_traits text[] DEFAULT NULL::text[],
  p_item_buckets text[] DEFAULT NULL::text[],
  p_date_from timestamp with time zone DEFAULT NULL::timestamp with time zone,
  p_date_to timestamp with time zone DEFAULT NULL::timestamp with time zone,
  p_assigned_to text DEFAULT NULL::text
)
RETURNS TABLE(
  id uuid, title text, customer_query text, created_at timestamp with time zone,
  has_enquiry boolean, enquiry_status text, source text, assigned_to uuid,
  owner_name text, customer_id uuid, customer_company text, customer_contact text,
  customer_phone text, customer_email text, customer_segment text,
  qualification_type text, routed_to text, qualified_at timestamp with time zone,
  qualifier_name text, item_count integer, total_qty numeric,
  pending_pricing integer, verified_auto integer, updated_pricing integer,
  latest_quotation_id uuid, latest_quotation_status text,
  latest_quotation_sent_at timestamp with time zone, latest_quotation_created_at timestamp with time zone,
  latest_quotation_grand_total numeric, handoff_at timestamp with time zone,
  stage text, pricing_mode text, lead_status text, won_at timestamp with time zone,
  lost_at timestamp with time zone, estimated_value numeric, deal_stage text,
  total_count bigint
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
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
    LEFT JOIN active_q lq ON lq.lead_id = l.id
    LEFT JOIN public.boqs b ON b.lead_id = l.id
    WHERE l.deleted_at IS NULL
      AND l.tenant_id = v_tenant
      AND (
        COALESCE(l.has_enquiry, false) = true
        OR EXISTS (SELECT 1 FROM public.enquiry_items ei WHERE ei.lead_id = l.id)
        OR EXISTS (SELECT 1 FROM public.quotations q WHERE q.lead_id = l.id AND q.deleted_at IS NULL)
      )
      AND (
        v_is_admin 
        OR l.assigned_to = v_uid
        OR l.id = ANY(public.get_user_quotation_lead_ids(v_uid))
        OR public.was_recent_lead_assignee(l.id, v_uid)
        OR l.id = ANY(public.get_user_qualified_lead_ids(v_uid))
      )
      AND (
        lq.routed_to::text = 'spt'
        OR (lq.routed_to::text = 'tst' AND b.status::text = 'handed_off')
        OR l.assigned_to = v_uid
        OR l.id = ANY(public.get_user_quotation_lead_ids(v_uid))
        OR public.was_recent_lead_assignee(l.id, v_uid)
        OR l.id = ANY(public.get_user_qualified_lead_ids(v_uid))
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
  ),
  enriched AS (
    SELECT
      b.id,
      b.title,
      b.customer_query,
      b.created_at,
      b.has_enquiry,
      b.enquiry_status::text AS enquiry_status,
      b.source::text AS source,
      b.assigned_to,
      op.full_name AS owner_name,
      c.id AS customer_id,
      c.company_name AS customer_company,
      c.contact_person AS customer_contact,
      c.phone AS customer_phone,
      c.email AS customer_email,
      c.segment::text AS customer_segment,
      b.qualification_type::text AS qualification_type,
      b.routed_to::text AS routed_to,
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
      b.estimated_value,
      -- Canonical Deal Stage Classification
      CASE
        WHEN LOWER(COALESCE(b.status::text, '')) = 'won' OR b.won_at IS NOT NULL THEN 'won'
        WHEN LOWER(COALESCE(b.status::text, '')) = 'lost' OR b.lost_at IS NOT NULL THEN 'lost'
        WHEN LOWER(COALESCE(lqq.status::text, '')) = 'accepted' THEN 'won'
        WHEN LOWER(COALESCE(lqq.status::text, '')) IN ('rejected', 'expired') THEN 'lost'
        WHEN lqq.id IS NOT NULL AND lqq.sent_at IS NOT NULL THEN
          CASE
            WHEN LOWER(COALESCE(lqq.status::text, '')) IN ('revised', 'negotiating') THEN 'negotiation'
            WHEN EXTRACT(EPOCH FROM (now() - lqq.sent_at))/3600 > 48 THEN 'follow_up'
            ELSE 'negotiation'
          END
        WHEN COALESCE(e.item_count, 0) > 0 THEN 'pricing'
        ELSE 'new'
      END AS deal_stage,
      -- Canonical Source Classification
      CASE
        WHEN b.routed_to::text = 'spt' AND b.qualification_type::text = 'simple' THEN 'lqt_simple'
        WHEN (b.routed_to::text = 'spt' AND b.qualification_type::text = 'technical') OR b.routed_to::text = 'tst' THEN 'lqt_technical'
        WHEN b.source::text IN ('cro', 'outreach') THEN 'cro'
        ELSE 'direct'
      END AS derived_source,
      -- Value calculation
      CASE
        WHEN lqq.grand_total IS NOT NULL AND lqq.grand_total > 0 THEN lqq.grand_total
        WHEN b.estimated_value IS NOT NULL AND b.estimated_value > 0 THEN b.estimated_value
        ELSE NULL
      END AS deal_value,
      -- SLA tracking
      (EXTRACT(EPOCH FROM (now() - COALESCE(b.qualified_at, b.created_at))) / 3600)::numeric AS hours_since_handoff,
      CASE
        WHEN (EXTRACT(EPOCH FROM (now() - COALESCE(b.qualified_at, b.created_at))) / 3600) >= 24 THEN 'red'
        WHEN (EXTRACT(EPOCH FROM (now() - COALESCE(b.qualified_at, b.created_at))) / 3600) >= 12 THEN 'yellow'
        ELSE 'green'
      END AS sla_bucket
    FROM base b
    LEFT JOIN public.customers c ON c.id = b.customer_id
    LEFT JOIN public.profiles op ON op.id = b.assigned_to
    LEFT JOIN public.profiles qp ON qp.id = b.qualified_by
    LEFT JOIN enq e ON e.lead_id = b.id
    LEFT JOIN pr_state prs ON prs.lead_id = b.id
    LEFT JOIN latest_quote lqq ON lqq.lead_id = b.id
  ),
  filtered AS (
    SELECT en.*
    FROM enriched en
    WHERE
      -- Stage Filter
      (p_stage IS NULL OR p_stage = 'all' OR en.deal_stage = p_stage)
      -- Search Filter
      AND (
        p_search IS NULL OR trim(p_search) = '' OR
        en.title ILIKE '%' || trim(p_search) || '%' OR
        en.customer_company ILIKE '%' || trim(p_search) || '%' OR
        en.customer_contact ILIKE '%' || trim(p_search) || '%' OR
        en.customer_phone ILIKE '%' || trim(p_search) || '%' OR
        en.customer_email ILIKE '%' || trim(p_search) || '%'
      )
      -- Sources Filter
      AND (p_sources IS NULL OR cardinality(p_sources) = 0 OR en.derived_source = ANY(p_sources))
      -- Customer Segments Filter
      AND (p_segments IS NULL OR cardinality(p_segments) = 0 OR en.customer_segment = ANY(p_segments))
      -- Pricing Modes Filter
      AND (p_pricing_modes IS NULL OR cardinality(p_pricing_modes) = 0 OR en.pricing_mode = ANY(p_pricing_modes))
      -- SLA Status Filter
      AND (p_sla_buckets IS NULL OR cardinality(p_sla_buckets) = 0 OR en.sla_bucket = ANY(p_sla_buckets))
      -- Customer Traits Filter
      AND (
        p_customer_traits IS NULL OR cardinality(p_customer_traits) = 0 OR (
          (NOT ('has_phone' = ANY(p_customer_traits)) OR (en.customer_phone IS NOT NULL AND trim(en.customer_phone) <> '')) AND
          (NOT ('has_email' = ANY(p_customer_traits)) OR (en.customer_email IS NOT NULL AND trim(en.customer_email) <> ''))
        )
      )
      -- Item Buckets Filter
      AND (
        p_item_buckets IS NULL OR cardinality(p_item_buckets) = 0 OR (
          ('1' = ANY(p_item_buckets) AND en.item_count = 1) OR
          ('2-5' = ANY(p_item_buckets) AND en.item_count >= 2 AND en.item_count <= 5) OR
          ('6+' = ANY(p_item_buckets) AND en.item_count >= 6)
        )
      )
      -- Date Range Filter
      AND (p_date_from IS NULL OR en.handoff_at >= p_date_from)
      AND (p_date_to IS NULL OR en.handoff_at <= p_date_to)
      -- Assigned To Filter
      AND (
        p_assigned_to IS NULL OR p_assigned_to = '' OR p_assigned_to = 'all' 
        OR en.assigned_to = p_assigned_to::uuid
        OR (
          p_assigned_to::uuid = v_uid
          AND (
            en.id = ANY(public.get_user_quotation_lead_ids(v_uid))
            OR public.was_recent_lead_assignee(en.id, v_uid)
            OR en.id = ANY(public.get_user_qualified_lead_ids(v_uid))
          )
        )
      )
  ),
  counted AS (
    SELECT f.*, COUNT(*) OVER() AS total_count
    FROM filtered f
  )
  SELECT
    c.id,
    c.title,
    c.customer_query,
    c.created_at,
    c.has_enquiry,
    c.enquiry_status,
    c.source,
    c.assigned_to,
    c.owner_name,
    c.customer_id,
    c.customer_company,
    c.customer_contact,
    c.customer_phone,
    c.customer_email,
    c.customer_segment,
    c.qualification_type,
    c.routed_to,
    c.qualified_at,
    c.qualifier_name,
    c.item_count,
    c.total_qty,
    c.pending_pricing,
    c.verified_auto,
    c.updated_pricing,
    c.latest_quotation_id,
    c.latest_quotation_status,
    c.latest_quotation_sent_at,
    c.latest_quotation_created_at,
    c.latest_quotation_grand_total,
    c.handoff_at,
    c.stage,
    c.pricing_mode,
    c.lead_status,
    c.won_at,
    c.lost_at,
    c.estimated_value,
    c.deal_stage,
    c.total_count
  FROM counted c
  ORDER BY
    CASE WHEN p_sort_by = 'oldest_handoff' THEN c.handoff_at END ASC,
    CASE WHEN p_sort_by = 'most_overdue' THEN c.hours_since_handoff END DESC,
    CASE WHEN p_sort_by = 'highest_value' THEN COALESCE(c.deal_value, 0) END DESC,
    CASE WHEN p_sort_by = 'highest_qty' THEN COALESCE(c.total_qty, 0) END DESC,
    CASE WHEN p_sort_by = 'customer_az' THEN LOWER(COALESCE(c.customer_company, c.title, '')) END ASC,
    c.handoff_at DESC,
    c.id DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_spt_inbox(text, integer, integer, text, text, text[], text[], text[], text[], text[], text[], timestamp with time zone, timestamp with time zone, text) TO authenticated;

-- 3. get_dashboard_lead_analytics: Ensure self-scoped trends/pipeline/sources include all associated leads
CREATE OR REPLACE FUNCTION public.get_dashboard_lead_analytics(
  p_from timestamp with time zone DEFAULT NULL::timestamp with time zone,
  p_to timestamp with time zone DEFAULT NULL::timestamp with time zone,
  p_assigned_to uuid DEFAULT NULL::uuid,
  p_vertical_id uuid DEFAULT NULL::uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_tenant_id uuid;
  v_is_admin boolean := false;
  v_is_manager boolean := false;
  v_effective_assigned_to uuid := p_assigned_to;
  v_from timestamptz;
  v_to timestamptz;
  v_trends jsonb := '[]'::jsonb;
  v_pipeline jsonb := '[]'::jsonb;
  v_sources jsonb := '[]'::jsonb;
BEGIN
  IF v_user IS NULL THEN
    RETURN jsonb_build_object('leadTrends', '[]'::jsonb, 'salesPipeline', '[]'::jsonb, 'leadSources', '[]'::jsonb);
  END IF;

  SELECT tenant_id INTO v_tenant_id FROM public.profiles WHERE id = v_user;
  IF v_tenant_id IS NULL THEN
    v_tenant_id := '1a5184ef-5138-4327-8928-67bc4f229131'::uuid;
  END IF;

  v_is_admin := public.is_admin_or_above(v_user);
  v_is_manager := public.is_manager_or_above(v_user);

  -- If standard rep (non-admin, non-manager), always enforce self-scoping
  IF NOT (v_is_admin OR v_is_manager) THEN
    v_effective_assigned_to := v_user;
  END IF;

  -- 6 months window default
  v_from := COALESCE(p_from, date_trunc('month', now() - interval '5 months'));
  v_to := COALESCE(p_to, now());

  -- 1. Monthly Trends (last 6 months buckets)
  WITH months AS (
    SELECT generate_series(
      date_trunc('month', v_from),
      date_trunc('month', v_to),
      interval '1 month'
    ) AS m
  ),
  aggregated AS (
    SELECT 
      date_trunc('month', l.created_at) AS m,
      count(*)::int AS total_leads,
      count(*) FILTER (WHERE l.source = 'indiamart')::int AS indiamart,
      count(*) FILTER (WHERE l.source = 'tradeindia')::int AS tradeindia,
      count(*) FILTER (WHERE l.source = 'manual')::int AS manual,
      count(*) FILTER (WHERE l.source NOT IN ('indiamart', 'tradeindia', 'manual'))::int AS other
    FROM public.leads l
    WHERE l.tenant_id = v_tenant_id
      AND l.deleted_at IS NULL
      AND l.created_at >= v_from
      AND l.created_at <= v_to
      AND (
        v_effective_assigned_to IS NULL 
        OR l.assigned_to = v_effective_assigned_to
        OR (
          v_effective_assigned_to = v_user 
          AND (
            l.id = ANY(public.get_user_quotation_lead_ids(v_user))
            OR public.was_recent_lead_assignee(l.id, v_user)
            OR l.id = ANY(public.get_user_qualified_lead_ids(v_user))
          )
        )
      )
      AND (p_vertical_id IS NULL OR l.vertical_id = p_vertical_id)
    GROUP BY 1
  )
  SELECT jsonb_agg(
    jsonb_build_object(
      'month', to_char(months.m, 'Mon'),
      'leads', COALESCE(agg.total_leads, 0),
      'indiamart', COALESCE(agg.indiamart, 0),
      'tradeindia', COALESCE(agg.tradeindia, 0),
      'manual', COALESCE(agg.manual, 0),
      'other', COALESCE(agg.other, 0)
    ) ORDER BY months.m
  ) INTO v_trends
  FROM months
  LEFT JOIN aggregated agg ON agg.m = months.m;

  -- 2. Sales Pipeline
  WITH pipe_agg AS (
    SELECT 
      l.status,
      count(*)::int AS count
    FROM public.leads l
    WHERE l.tenant_id = v_tenant_id
      AND l.deleted_at IS NULL
      AND l.created_at >= v_from
      AND l.created_at <= v_to
      AND (
        v_effective_assigned_to IS NULL 
        OR l.assigned_to = v_effective_assigned_to
        OR (
          v_effective_assigned_to = v_user 
          AND (
            l.id = ANY(public.get_user_quotation_lead_ids(v_user))
            OR public.was_recent_lead_assignee(l.id, v_user)
            OR l.id = ANY(public.get_user_qualified_lead_ids(v_user))
          )
        )
      )
      AND (p_vertical_id IS NULL OR l.vertical_id = p_vertical_id)
    GROUP BY l.status
  )
  SELECT jsonb_agg(
    jsonb_build_object(
      'status', status,
      'count', count,
      'label', initcap(replace(status::text, '_', ' ')),
      'color', CASE status::text
        WHEN 'new' THEN 'hsl(var(--chart-1))'
        WHEN 'contacted' THEN 'hsl(var(--chart-2))'
        WHEN 'engaged' THEN 'hsl(var(--chart-3))'
        WHEN 'quoted' THEN 'hsl(var(--chart-4))'
        WHEN 'negotiation' THEN 'hsl(var(--chart-5))'
        WHEN 'won' THEN 'hsl(var(--success))'
        WHEN 'lost' THEN 'hsl(var(--destructive))'
        ELSE 'hsl(var(--muted))'
      END
    ) ORDER BY count DESC
  ) INTO v_pipeline
  FROM pipe_agg;

  -- 3. Lead Sources
  WITH src_agg AS (
    SELECT 
      l.source,
      count(*)::int AS count
    FROM public.leads l
    WHERE l.tenant_id = v_tenant_id
      AND l.deleted_at IS NULL
      AND l.created_at >= v_from
      AND l.created_at <= v_to
      AND (
        v_effective_assigned_to IS NULL 
        OR l.assigned_to = v_effective_assigned_to
        OR (
          v_effective_assigned_to = v_user 
          AND (
            l.id = ANY(public.get_user_quotation_lead_ids(v_user))
            OR public.was_recent_lead_assignee(l.id, v_user)
            OR l.id = ANY(public.get_user_qualified_lead_ids(v_user))
          )
        )
      )
      AND (p_vertical_id IS NULL OR l.vertical_id = p_vertical_id)
    GROUP BY l.source
  )
  SELECT jsonb_agg(
    jsonb_build_object(
      'source', source,
      'count', count,
      'label', CASE source::text
        WHEN 'indiamart' THEN 'IndiaMART'
        WHEN 'tradeindia' THEN 'TradeIndia'
        WHEN 'whatsapp' THEN 'WhatsApp'
        WHEN 'manual' THEN 'Manual'
        WHEN 'website' THEN 'Website'
        ELSE initcap(source::text)
      END,
      'fill', CASE source::text
        WHEN 'indiamart' THEN 'hsl(var(--chart-1))'
        WHEN 'tradeindia' THEN 'hsl(var(--chart-2))'
        WHEN 'whatsapp' THEN 'hsl(var(--chart-4))'
        WHEN 'manual' THEN 'hsl(var(--primary))'
        WHEN 'website' THEN 'hsl(var(--chart-5))'
        ELSE 'hsl(var(--muted))'
      END
    ) ORDER BY count DESC
  ) INTO v_sources
  FROM src_agg;

  RETURN jsonb_build_object(
    'leadTrends', COALESCE(v_trends, '[]'::jsonb),
    'salesPipeline', COALESCE(v_pipeline, '[]'::jsonb),
    'leadSources', COALESCE(v_sources, '[]'::jsonb)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_dashboard_lead_analytics(timestamp with time zone, timestamp with time zone, uuid, uuid) TO authenticated;
