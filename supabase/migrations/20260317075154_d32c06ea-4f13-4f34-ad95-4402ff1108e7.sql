
CREATE OR REPLACE FUNCTION public.get_segment_drilldown_customers(
  p_segment text,
  p_metric text,
  p_from timestamptz DEFAULT NULL,
  p_to timestamptz DEFAULT NULL,
  p_user_id uuid DEFAULT NULL,
  p_is_scoped boolean DEFAULT false,
  p_search text DEFAULT NULL,
  p_limit int DEFAULT 50,
  p_offset int DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_rows jsonb;
  v_total int;
BEGIN
  CREATE TEMP TABLE _drilldown_ids ON COMMIT DROP AS
  SELECT c.id
  FROM customers c
  WHERE c.deleted_at IS NULL
    AND COALESCE(c.segment::text, 'bronze') = p_segment
    AND (NOT p_is_scoped OR p_user_id IS NULL OR c.assigned_sales_id = p_user_id)
    AND (p_search IS NULL OR p_search = '' OR
         c.company_name ILIKE '%' || p_search || '%' OR
         c.contact_person ILIKE '%' || p_search || '%' OR
         c.phone ILIKE '%' || p_search || '%')
    AND (
      CASE p_metric
        WHEN 'customers' THEN true
        WHEN 'leads' THEN EXISTS (
          SELECT 1 FROM leads l WHERE l.customer_id = c.id AND l.deleted_at IS NULL
            AND (p_from IS NULL OR l.created_at >= p_from)
            AND (p_to IS NULL OR l.created_at <= p_to)
        )
        WHEN 'conversions' THEN EXISTS (
          SELECT 1 FROM leads l WHERE l.customer_id = c.id AND l.deleted_at IS NULL AND l.status = 'won'
            AND (p_from IS NULL OR l.created_at >= p_from)
            AND (p_to IS NULL OR l.created_at <= p_to)
        )
        WHEN 'enquiries' THEN EXISTS (
          SELECT 1 FROM enquiry_items ei JOIN leads l ON l.id = ei.lead_id AND l.deleted_at IS NULL
          WHERE l.customer_id = c.id
            AND (p_from IS NULL OR ei.created_at >= p_from)
            AND (p_to IS NULL OR ei.created_at <= p_to)
        )
        WHEN 'quotations' THEN EXISTS (
          SELECT 1 FROM quotations q WHERE q.customer_id = c.id AND q.deleted_at IS NULL
            AND (p_from IS NULL OR q.created_at >= p_from)
            AND (p_to IS NULL OR q.created_at <= p_to)
        )
        WHEN 'revenue' THEN EXISTS (
          SELECT 1 FROM sales_orders so WHERE so.customer_id = c.id AND so.status != 'cancelled'
            AND (p_from IS NULL OR so.created_at >= p_from)
            AND (p_to IS NULL OR so.created_at <= p_to)
        )
        WHEN 'all_qualifiers' THEN (
          EXISTS (SELECT 1 FROM leads l WHERE l.customer_id = c.id AND l.deleted_at IS NULL
            AND (p_from IS NULL OR l.created_at >= p_from) AND (p_to IS NULL OR l.created_at <= p_to))
          AND EXISTS (SELECT 1 FROM enquiry_items ei JOIN leads l ON l.id = ei.lead_id AND l.deleted_at IS NULL
            WHERE l.customer_id = c.id
            AND (p_from IS NULL OR ei.created_at >= p_from) AND (p_to IS NULL OR ei.created_at <= p_to))
          AND EXISTS (SELECT 1 FROM quotations q WHERE q.customer_id = c.id AND q.deleted_at IS NULL
            AND (p_from IS NULL OR q.created_at >= p_from) AND (p_to IS NULL OR q.created_at <= p_to))
          AND EXISTS (SELECT 1 FROM sales_orders so WHERE so.customer_id = c.id AND so.status != 'cancelled'
            AND (p_from IS NULL OR so.created_at >= p_from) AND (p_to IS NULL OR so.created_at <= p_to))
        )
        ELSE true
      END
    );

  SELECT count(*) INTO v_total FROM _drilldown_ids;

  SELECT COALESCE(jsonb_agg(row_to_jsonb(t)), '[]'::jsonb) INTO v_rows
  FROM (
    SELECT c.id, c.company_name, c.contact_person, c.email, c.phone, c.segment, c.created_at,
           p.full_name as assigned_sales_name
    FROM customers c
    JOIN _drilldown_ids d ON d.id = c.id
    LEFT JOIN profiles p ON p.id = c.assigned_sales_id
    ORDER BY c.company_name
    LIMIT p_limit OFFSET p_offset
  ) t;

  RETURN jsonb_build_object('rows', v_rows, 'total', v_total);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_segment_analytics(
  p_from timestamptz DEFAULT NULL,
  p_to timestamptz DEFAULT NULL,
  p_user_id uuid DEFAULT NULL,
  p_is_scoped boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_result jsonb;
  v_customers jsonb;
  v_leads jsonb;
  v_enquiries jsonb;
  v_quotations jsonb;
  v_conversions jsonb;
  v_revenue jsonb;
  v_all_qualifiers jsonb;
BEGIN
  SELECT jsonb_object_agg(COALESCE(segment::text, 'bronze'), cnt)
  INTO v_customers
  FROM (
    SELECT segment, count(*)::int as cnt
    FROM customers
    WHERE deleted_at IS NULL
      AND (NOT p_is_scoped OR p_user_id IS NULL OR assigned_sales_id = p_user_id)
    GROUP BY segment
  ) t;

  SELECT jsonb_object_agg(seg, cnt)
  INTO v_leads
  FROM (
    SELECT COALESCE(c.segment::text, 'bronze') as seg, count(*)::int as cnt
    FROM leads l
    JOIN customers c ON c.id = l.customer_id AND c.deleted_at IS NULL
    WHERE l.deleted_at IS NULL
      AND (NOT p_is_scoped OR p_user_id IS NULL OR c.assigned_sales_id = p_user_id)
      AND (p_from IS NULL OR l.created_at >= p_from)
      AND (p_to IS NULL OR l.created_at <= p_to)
    GROUP BY COALESCE(c.segment::text, 'bronze')
  ) t;

  SELECT jsonb_object_agg(seg, cnt)
  INTO v_enquiries
  FROM (
    SELECT COALESCE(c.segment::text, 'bronze') as seg, count(*)::int as cnt
    FROM enquiry_items ei
    JOIN leads l ON l.id = ei.lead_id AND l.deleted_at IS NULL
    JOIN customers c ON c.id = l.customer_id AND c.deleted_at IS NULL
    WHERE (NOT p_is_scoped OR p_user_id IS NULL OR c.assigned_sales_id = p_user_id)
      AND (p_from IS NULL OR ei.created_at >= p_from)
      AND (p_to IS NULL OR ei.created_at <= p_to)
    GROUP BY COALESCE(c.segment::text, 'bronze')
  ) t;

  SELECT jsonb_object_agg(seg, cnt)
  INTO v_quotations
  FROM (
    SELECT COALESCE(c.segment::text, 'bronze') as seg, count(*)::int as cnt
    FROM quotations q
    JOIN customers c ON c.id = q.customer_id AND c.deleted_at IS NULL
    WHERE q.deleted_at IS NULL
      AND (NOT p_is_scoped OR p_user_id IS NULL OR c.assigned_sales_id = p_user_id)
      AND (p_from IS NULL OR q.created_at >= p_from)
      AND (p_to IS NULL OR q.created_at <= p_to)
    GROUP BY COALESCE(c.segment::text, 'bronze')
  ) t;

  SELECT jsonb_object_agg(seg, cnt)
  INTO v_conversions
  FROM (
    SELECT COALESCE(c.segment::text, 'bronze') as seg, count(*)::int as cnt
    FROM leads l
    JOIN customers c ON c.id = l.customer_id AND c.deleted_at IS NULL
    WHERE l.deleted_at IS NULL
      AND l.status = 'won'
      AND (NOT p_is_scoped OR p_user_id IS NULL OR c.assigned_sales_id = p_user_id)
      AND (p_from IS NULL OR l.created_at >= p_from)
      AND (p_to IS NULL OR l.created_at <= p_to)
    GROUP BY COALESCE(c.segment::text, 'bronze')
  ) t;

  SELECT jsonb_object_agg(seg, rev)
  INTO v_revenue
  FROM (
    SELECT COALESCE(c.segment::text, 'bronze') as seg, COALESCE(sum(so.order_value), 0)::numeric as rev
    FROM sales_orders so
    JOIN customers c ON c.id = so.customer_id AND c.deleted_at IS NULL
    WHERE so.status != 'cancelled'
      AND (NOT p_is_scoped OR p_user_id IS NULL OR c.assigned_sales_id = p_user_id)
      AND (p_from IS NULL OR so.created_at >= p_from)
      AND (p_to IS NULL OR so.created_at <= p_to)
    GROUP BY COALESCE(c.segment::text, 'bronze')
  ) t;

  SELECT jsonb_object_agg(seg, cnt)
  INTO v_all_qualifiers
  FROM (
    SELECT COALESCE(c.segment::text, 'bronze') as seg, count(*)::int as cnt
    FROM customers c
    WHERE c.deleted_at IS NULL
      AND (NOT p_is_scoped OR p_user_id IS NULL OR c.assigned_sales_id = p_user_id)
      AND EXISTS (SELECT 1 FROM leads l WHERE l.customer_id = c.id AND l.deleted_at IS NULL
        AND (p_from IS NULL OR l.created_at >= p_from) AND (p_to IS NULL OR l.created_at <= p_to))
      AND EXISTS (SELECT 1 FROM enquiry_items ei JOIN leads l ON l.id = ei.lead_id AND l.deleted_at IS NULL
        WHERE l.customer_id = c.id
        AND (p_from IS NULL OR ei.created_at >= p_from) AND (p_to IS NULL OR ei.created_at <= p_to))
      AND EXISTS (SELECT 1 FROM quotations q WHERE q.customer_id = c.id AND q.deleted_at IS NULL
        AND (p_from IS NULL OR q.created_at >= p_from) AND (p_to IS NULL OR q.created_at <= p_to))
      AND EXISTS (SELECT 1 FROM sales_orders so WHERE so.customer_id = c.id AND so.status != 'cancelled'
        AND (p_from IS NULL OR so.created_at >= p_from) AND (p_to IS NULL OR so.created_at <= p_to))
    GROUP BY COALESCE(c.segment::text, 'bronze')
  ) t;

  v_result := jsonb_build_object(
    'customers', COALESCE(v_customers, '{}'::jsonb),
    'leads', COALESCE(v_leads, '{}'::jsonb),
    'enquiries', COALESCE(v_enquiries, '{}'::jsonb),
    'quotations', COALESCE(v_quotations, '{}'::jsonb),
    'conversions', COALESCE(v_conversions, '{}'::jsonb),
    'revenue', COALESCE(v_revenue, '{}'::jsonb),
    'all_qualifiers', COALESCE(v_all_qualifiers, '{}'::jsonb)
  );

  RETURN v_result;
END;
$$;
