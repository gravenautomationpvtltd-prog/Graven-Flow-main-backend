
-- ============================================================================
-- Canonical Sales Inbox RPC + Procurement visibility hardening
-- ============================================================================

-- 1) Auto-create price_requests when a free-text enquiry item is added
--    so SPT/Procurement queues populate even if frontend forgot to call the API.
CREATE OR REPLACE FUNCTION public.auto_create_price_request_for_enquiry()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id uuid;
  v_assigned uuid;
BEGIN
  -- Only auto-create when there's no matched product (free-text) AND no existing price_request
  IF NEW.matched_product_id IS NULL THEN
    SELECT tenant_id, assigned_to INTO v_tenant_id, v_assigned
    FROM public.leads WHERE id = NEW.lead_id;

    IF NOT EXISTS (
      SELECT 1 FROM public.price_requests
      WHERE enquiry_item_id = NEW.id
    ) THEN
      INSERT INTO public.price_requests (
        lead_id, enquiry_item_id, requested_by, status, priority, tenant_id, target_rate
      ) VALUES (
        NEW.lead_id,
        NEW.id,
        COALESCE(v_assigned, auth.uid()),
        'pending',
        'normal',
        v_tenant_id,
        NEW.target_rate
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_create_price_request ON public.enquiry_items;
CREATE TRIGGER trg_auto_create_price_request
AFTER INSERT ON public.enquiry_items
FOR EACH ROW EXECUTE FUNCTION public.auto_create_price_request_for_enquiry();

-- 2) Canonical Sales Inbox RPC. Single source of truth for stages.
CREATE OR REPLACE FUNCTION public.get_spt_inbox()
RETURNS TABLE (
  id uuid,
  title text,
  customer_query text,
  created_at timestamptz,
  has_enquiry boolean,
  enquiry_status text,
  source text,
  assigned_to uuid,
  owner_name text,
  customer_id uuid,
  customer_company text,
  customer_contact text,
  customer_phone text,
  customer_email text,
  qualification_type text,
  routed_to text,
  qualified_at timestamptz,
  qualifier_name text,
  item_count int,
  total_qty numeric,
  pending_pricing int,
  verified_auto int,
  updated_pricing int,
  latest_quotation_id uuid,
  latest_quotation_status text,
  latest_quotation_sent_at timestamptz,
  latest_quotation_created_at timestamptz,
  latest_quotation_grand_total numeric,
  handoff_at timestamptz,
  stage text,
  pricing_mode text
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
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
  WITH base AS (
    SELECT l.*
    FROM public.leads l
    WHERE l.deleted_at IS NULL
      AND l.tenant_id = v_tenant
      AND (v_is_admin OR l.assigned_to = v_uid)
  ),
  enq AS (
    SELECT lead_id,
           COUNT(*)::int AS item_count,
           COALESCE(SUM(quantity),0)::numeric AS total_qty,
           COUNT(*) FILTER (WHERE pricing_status = 'pending')::int AS pending_pricing,
           COUNT(*) FILTER (WHERE pricing_status = 'verified_auto')::int AS verified_auto,
           COUNT(*) FILTER (WHERE pricing_status = 'updated')::int AS updated_pricing
    FROM public.enquiry_items
    WHERE lead_id IN (SELECT id FROM base)
    GROUP BY lead_id
  ),
  q_real AS (
    -- Real quotations (ignore empty placeholder drafts)
    SELECT q.*,
           ROW_NUMBER() OVER (PARTITION BY q.lead_id ORDER BY q.created_at DESC) AS rn
    FROM public.quotations q
    WHERE q.deleted_at IS NULL
      AND q.lead_id IN (SELECT id FROM base)
      AND (q.sent_at IS NOT NULL OR COALESCE(q.grand_total,0) > 0 OR (q.status IS NOT NULL AND q.status::text <> 'draft'))
  ),
  latest_q AS (
    SELECT * FROM q_real WHERE rn = 1
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
    lq.qualification_type::text,
    lq.routed_to::text,
    lq.qualified_at,
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
    COALESCE(lq.qualified_at, b.created_at) AS handoff_at,
    -- stage classification
    CASE
      WHEN lqq.id IS NOT NULL AND lqq.sent_at IS NOT NULL
           AND lqq.status::text NOT IN ('accepted','rejected','expired')
           AND EXTRACT(EPOCH FROM (now() - lqq.sent_at))/86400 >= 2
        THEN 'awaiting'
      WHEN lqq.id IS NOT NULL AND lqq.status::text IN ('draft','sent') AND lqq.sent_at IS NULL
        THEN 'in_progress'
      WHEN lqq.id IS NOT NULL AND lqq.status::text IN ('draft','sent')
        THEN 'in_progress'
      WHEN b.has_enquiry = true AND lqq.id IS NULL
        THEN 'new'
      ELSE 'other'
    END AS stage,
    -- pricing mode
    CASE
      WHEN COALESCE(e.item_count,0) = 0 THEN 'none'
      WHEN COALESCE(e.pending_pricing,0) > 0 THEN 'awaiting'
      WHEN COALESCE(e.verified_auto,0) = COALESCE(e.item_count,0) THEN 'fast'
      ELSE 'updated'
    END AS pricing_mode
  FROM base b
  LEFT JOIN public.customers c ON c.id = b.customer_id
  LEFT JOIN public.profiles op ON op.id = b.assigned_to
  LEFT JOIN public.lead_qualification lq ON lq.lead_id = b.id
  LEFT JOIN public.profiles qp ON qp.id = lq.qualified_by
  LEFT JOIN public.enq e ON e.lead_id = b.id
  LEFT JOIN public.latest_q lqq ON lqq.lead_id = b.id
  ORDER BY b.created_at DESC
  LIMIT 500;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_spt_inbox() TO authenticated;

-- 3) Backfill missing price_requests for existing free-text enquiry items
INSERT INTO public.price_requests (lead_id, enquiry_item_id, requested_by, status, priority, tenant_id, target_rate)
SELECT ei.lead_id, ei.id,
       COALESCE(l.assigned_to, (SELECT id FROM public.profiles WHERE id = l.assigned_to LIMIT 1)),
       'pending', 'normal', l.tenant_id, ei.target_rate
FROM public.enquiry_items ei
JOIN public.leads l ON l.id = ei.lead_id
WHERE ei.matched_product_id IS NULL
  AND l.assigned_to IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.price_requests pr WHERE pr.enquiry_item_id = ei.id);
