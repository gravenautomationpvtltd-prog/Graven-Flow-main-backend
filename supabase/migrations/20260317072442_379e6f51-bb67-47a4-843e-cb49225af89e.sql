
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
BEGIN
  SELECT jsonb_object_agg(COALESCE(segment, 'bronze'), cnt)
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
    SELECT COALESCE(c.segment, 'bronze') as seg, count(*)::int as cnt
    FROM leads l
    JOIN customers c ON c.id = l.customer_id AND c.deleted_at IS NULL
    WHERE l.deleted_at IS NULL
      AND (NOT p_is_scoped OR p_user_id IS NULL OR c.assigned_sales_id = p_user_id)
      AND (p_from IS NULL OR l.created_at >= p_from)
      AND (p_to IS NULL OR l.created_at <= p_to)
    GROUP BY COALESCE(c.segment, 'bronze')
  ) t;

  SELECT jsonb_object_agg(seg, cnt)
  INTO v_enquiries
  FROM (
    SELECT COALESCE(c.segment, 'bronze') as seg, count(*)::int as cnt
    FROM enquiry_items ei
    JOIN leads l ON l.id = ei.lead_id AND l.deleted_at IS NULL
    JOIN customers c ON c.id = l.customer_id AND c.deleted_at IS NULL
    WHERE (NOT p_is_scoped OR p_user_id IS NULL OR c.assigned_sales_id = p_user_id)
      AND (p_from IS NULL OR ei.created_at >= p_from)
      AND (p_to IS NULL OR ei.created_at <= p_to)
    GROUP BY COALESCE(c.segment, 'bronze')
  ) t;

  SELECT jsonb_object_agg(seg, cnt)
  INTO v_quotations
  FROM (
    SELECT COALESCE(c.segment, 'bronze') as seg, count(*)::int as cnt
    FROM quotations q
    JOIN customers c ON c.id = q.customer_id AND c.deleted_at IS NULL
    WHERE q.deleted_at IS NULL
      AND (NOT p_is_scoped OR p_user_id IS NULL OR c.assigned_sales_id = p_user_id)
      AND (p_from IS NULL OR q.created_at >= p_from)
      AND (p_to IS NULL OR q.created_at <= p_to)
    GROUP BY COALESCE(c.segment, 'bronze')
  ) t;

  SELECT jsonb_object_agg(seg, cnt)
  INTO v_conversions
  FROM (
    SELECT COALESCE(c.segment, 'bronze') as seg, count(*)::int as cnt
    FROM leads l
    JOIN customers c ON c.id = l.customer_id AND c.deleted_at IS NULL
    WHERE l.deleted_at IS NULL
      AND l.status = 'won'
      AND (NOT p_is_scoped OR p_user_id IS NULL OR c.assigned_sales_id = p_user_id)
      AND (p_from IS NULL OR l.created_at >= p_from)
      AND (p_to IS NULL OR l.created_at <= p_to)
    GROUP BY COALESCE(c.segment, 'bronze')
  ) t;

  SELECT jsonb_object_agg(seg, rev)
  INTO v_revenue
  FROM (
    SELECT COALESCE(c.segment, 'bronze') as seg, COALESCE(sum(so.order_value), 0)::numeric as rev
    FROM sales_orders so
    JOIN customers c ON c.id = so.customer_id AND c.deleted_at IS NULL
    WHERE so.status != 'cancelled'
      AND (NOT p_is_scoped OR p_user_id IS NULL OR c.assigned_sales_id = p_user_id)
      AND (p_from IS NULL OR so.created_at >= p_from)
      AND (p_to IS NULL OR so.created_at <= p_to)
    GROUP BY COALESCE(c.segment, 'bronze')
  ) t;

  v_result := jsonb_build_object(
    'customers', COALESCE(v_customers, '{}'::jsonb),
    'leads', COALESCE(v_leads, '{}'::jsonb),
    'enquiries', COALESCE(v_enquiries, '{}'::jsonb),
    'quotations', COALESCE(v_quotations, '{}'::jsonb),
    'conversions', COALESCE(v_conversions, '{}'::jsonb),
    'revenue', COALESCE(v_revenue, '{}'::jsonb)
  );

  RETURN v_result;
END;
$$;
