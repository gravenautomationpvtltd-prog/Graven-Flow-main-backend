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
  SELECT count(*) INTO v_total
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
          SELECT 1 FROM leads l
          WHERE l.customer_id = c.id AND l.deleted_at IS NULL
            AND (p_from IS NULL OR l.created_at >= p_from)
            AND (p_to IS NULL OR l.created_at <= p_to)
        )
        WHEN 'enquiries' THEN EXISTS (
          SELECT 1 FROM enquiry_items ei
          JOIN leads l ON l.id = ei.lead_id AND l.deleted_at IS NULL
          WHERE l.customer_id = c.id
            AND (p_from IS NULL OR ei.created_at >= p_from)
            AND (p_to IS NULL OR ei.created_at <= p_to)
        )
        WHEN 'quotations' THEN EXISTS (
          SELECT 1 FROM quotations q
          WHERE q.customer_id = c.id AND q.deleted_at IS NULL
            AND (p_from IS NULL OR q.created_at >= p_from)
            AND (p_to IS NULL OR q.created_at <= p_to)
        )
        WHEN 'conversions' THEN EXISTS (
          SELECT 1 FROM leads l
          WHERE l.customer_id = c.id AND l.deleted_at IS NULL AND l.status = 'won'
            AND (p_from IS NULL OR l.created_at >= p_from)
            AND (p_to IS NULL OR l.created_at <= p_to)
        )
        WHEN 'revenue' THEN EXISTS (
          SELECT 1 FROM sales_orders so
          WHERE so.customer_id = c.id AND so.status != 'cancelled'
            AND (p_from IS NULL OR so.created_at >= p_from)
            AND (p_to IS NULL OR so.created_at <= p_to)
        )
        WHEN 'all_qualifiers' THEN (
          EXISTS (SELECT 1 FROM leads l WHERE l.customer_id = c.id AND l.deleted_at IS NULL
            AND (p_from IS NULL OR l.created_at >= p_from) AND (p_to IS NULL OR l.created_at <= p_to))
          AND EXISTS (SELECT 1 FROM enquiry_items ei JOIN leads l ON l.id = ei.lead_id AND l.deleted_at IS NULL
            WHERE l.customer_id = c.id AND (p_from IS NULL OR ei.created_at >= p_from) AND (p_to IS NULL OR ei.created_at <= p_to))
          AND EXISTS (SELECT 1 FROM quotations q WHERE q.customer_id = c.id AND q.deleted_at IS NULL
            AND (p_from IS NULL OR q.created_at >= p_from) AND (p_to IS NULL OR q.created_at <= p_to))
          AND EXISTS (SELECT 1 FROM sales_orders so WHERE so.customer_id = c.id AND so.status != 'cancelled'
            AND (p_from IS NULL OR so.created_at >= p_from) AND (p_to IS NULL OR so.created_at <= p_to))
        )
        ELSE true
      END
    );

  SELECT COALESCE(jsonb_agg(to_jsonb(t)), '[]'::jsonb) INTO v_rows
  FROM (
    SELECT c.id, c.company_name, c.contact_person, c.phone, c.created_at,
           p.full_name as assigned_sales_name
    FROM customers c
    LEFT JOIN profiles p ON p.id = c.assigned_sales_id
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
              AND (p_from IS NULL OR l.created_at >= p_from) AND (p_to IS NULL OR l.created_at <= p_to))
          WHEN 'enquiries' THEN EXISTS (
            SELECT 1 FROM enquiry_items ei JOIN leads l ON l.id = ei.lead_id AND l.deleted_at IS NULL
            WHERE l.customer_id = c.id AND (p_from IS NULL OR ei.created_at >= p_from) AND (p_to IS NULL OR ei.created_at <= p_to))
          WHEN 'quotations' THEN EXISTS (
            SELECT 1 FROM quotations q WHERE q.customer_id = c.id AND q.deleted_at IS NULL
              AND (p_from IS NULL OR q.created_at >= p_from) AND (p_to IS NULL OR q.created_at <= p_to))
          WHEN 'conversions' THEN EXISTS (
            SELECT 1 FROM leads l WHERE l.customer_id = c.id AND l.deleted_at IS NULL AND l.status = 'won'
              AND (p_from IS NULL OR l.created_at >= p_from) AND (p_to IS NULL OR l.created_at <= p_to))
          WHEN 'revenue' THEN EXISTS (
            SELECT 1 FROM sales_orders so WHERE so.customer_id = c.id AND so.status != 'cancelled'
              AND (p_from IS NULL OR so.created_at >= p_from) AND (p_to IS NULL OR so.created_at <= p_to))
          WHEN 'all_qualifiers' THEN (
            EXISTS (SELECT 1 FROM leads l WHERE l.customer_id = c.id AND l.deleted_at IS NULL
              AND (p_from IS NULL OR l.created_at >= p_from) AND (p_to IS NULL OR l.created_at <= p_to))
            AND EXISTS (SELECT 1 FROM enquiry_items ei JOIN leads l ON l.id = ei.lead_id AND l.deleted_at IS NULL
              WHERE l.customer_id = c.id AND (p_from IS NULL OR ei.created_at >= p_from) AND (p_to IS NULL OR ei.created_at <= p_to))
            AND EXISTS (SELECT 1 FROM quotations q WHERE q.customer_id = c.id AND q.deleted_at IS NULL
              AND (p_from IS NULL OR q.created_at >= p_from) AND (p_to IS NULL OR q.created_at <= p_to))
            AND EXISTS (SELECT 1 FROM sales_orders so WHERE so.customer_id = c.id AND so.status != 'cancelled'
              AND (p_from IS NULL OR so.created_at >= p_from) AND (p_to IS NULL OR so.created_at <= p_to))
          )
          ELSE true
        END
      )
    ORDER BY c.company_name
    LIMIT p_limit OFFSET p_offset
  ) t;

  RETURN jsonb_build_object('rows', v_rows, 'total', v_total);
END;
$$;