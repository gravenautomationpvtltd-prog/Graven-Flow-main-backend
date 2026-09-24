
DROP FUNCTION IF EXISTS public.get_segment_analytics(timestamp with time zone, timestamp with time zone, uuid, boolean);

CREATE OR REPLACE FUNCTION public.get_segment_analytics(
  p_from timestamp with time zone DEFAULT NULL,
  p_to timestamp with time zone DEFAULT NULL,
  p_user_id uuid DEFAULT NULL,
  p_is_scoped boolean DEFAULT false,
  p_vertical_id uuid DEFAULT NULL
)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
      AND (p_vertical_id IS NULL OR vertical_id = p_vertical_id)
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
      AND (p_vertical_id IS NULL OR l.vertical_id = p_vertical_id)
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
      AND (p_vertical_id IS NULL OR l.vertical_id = p_vertical_id)
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
      AND (p_vertical_id IS NULL OR q.vertical_id = p_vertical_id)
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
      AND (p_vertical_id IS NULL OR l.vertical_id = p_vertical_id)
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
      AND (p_vertical_id IS NULL OR so.vertical_id = p_vertical_id)
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
      AND (p_vertical_id IS NULL OR c.vertical_id = p_vertical_id)
      AND EXISTS (SELECT 1 FROM leads l WHERE l.customer_id = c.id AND l.deleted_at IS NULL
        AND (p_vertical_id IS NULL OR l.vertical_id = p_vertical_id)
        AND (p_from IS NULL OR l.created_at >= p_from) AND (p_to IS NULL OR l.created_at <= p_to))
      AND EXISTS (SELECT 1 FROM enquiry_items ei JOIN leads l ON l.id = ei.lead_id AND l.deleted_at IS NULL
        WHERE l.customer_id = c.id
        AND (p_vertical_id IS NULL OR l.vertical_id = p_vertical_id)
        AND (p_from IS NULL OR ei.created_at >= p_from) AND (p_to IS NULL OR ei.created_at <= p_to))
      AND EXISTS (SELECT 1 FROM quotations q WHERE q.customer_id = c.id AND q.deleted_at IS NULL
        AND (p_vertical_id IS NULL OR q.vertical_id = p_vertical_id)
        AND (p_from IS NULL OR q.created_at >= p_from) AND (p_to IS NULL OR q.created_at <= p_to))
      AND EXISTS (SELECT 1 FROM sales_orders so WHERE so.customer_id = c.id AND so.status != 'cancelled'
        AND (p_vertical_id IS NULL OR so.vertical_id = p_vertical_id)
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
$function$;
