
CREATE OR REPLACE FUNCTION public.get_lqt_inbox(
  p_tab text,
  p_from timestamp with time zone DEFAULT NULL,
  p_to timestamp with time zone DEFAULT NULL,
  p_limit integer DEFAULT 500,
  p_vertical_id uuid DEFAULT NULL
)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
  v_user uuid := auth.uid();
  v_tenant uuid;
  v_is_lqt boolean := false;
  v_is_manager boolean := false;
  v_rows jsonb;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'NOT_AUTHENTICATED'; END IF;

  SELECT tenant_id INTO v_tenant FROM public.tenant_users
  WHERE user_id = v_user AND is_active = true LIMIT 1;
  IF v_tenant IS NULL THEN RAISE EXCEPTION 'NO_ORGANIZATION'; END IF;

  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = v_user AND role = 'cro'::app_role) INTO v_is_lqt;
  SELECT public.is_manager_or_above(v_user) INTO v_is_manager;

  IF p_tab = 'pending' THEN
    SELECT COALESCE(jsonb_agg(row_data ORDER BY (row_data->>'created_at') DESC), '[]'::jsonb) INTO v_rows
    FROM (
      SELECT jsonb_build_object(
        'id', l.id, 'title', l.title, 'source', l.source,
        'source_reference', l.source_reference, 'customer_query', l.customer_query,
        'created_at', l.created_at, 'assigned_to', l.assigned_to,
        'customer_id', l.customer_id, 'suggested_assignee_id', l.suggested_assignee_id,
        'customer', CASE WHEN c.id IS NULL THEN NULL ELSE jsonb_build_object(
          'id', c.id, 'company_name', c.company_name, 'contact_person', c.contact_person,
          'phone', c.phone, 'email', c.email, 'city', c.city, 'state', c.state
        ) END,
        'suggested_assignee', CASE WHEN p.id IS NULL THEN NULL ELSE jsonb_build_object(
          'id', p.id, 'full_name', p.full_name
        ) END,
        'qualification', NULL
      ) AS row_data
      FROM public.leads l
      LEFT JOIN public.customers c ON c.id = l.customer_id
      LEFT JOIN public.profiles  p ON p.id = l.suggested_assignee_id
      JOIN public.user_roles ur ON ur.user_id = l.assigned_to AND ur.role = 'cro'::app_role
      WHERE l.tenant_id = v_tenant
        AND l.deleted_at IS NULL
        AND (p_vertical_id IS NULL OR l.vertical_id = p_vertical_id)
        AND (v_is_manager OR l.assigned_to = v_user)
        AND NOT EXISTS (
          SELECT 1 FROM public.lead_qualification q
          WHERE q.lead_id = l.id AND q.is_active = true
        )
      ORDER BY l.created_at DESC LIMIT p_limit
    ) sub;
    RETURN v_rows;
  END IF;

  SELECT COALESCE(jsonb_agg(row_data ORDER BY (row_data->'qualification'->>'qualified_at') DESC), '[]'::jsonb) INTO v_rows
  FROM (
    SELECT jsonb_build_object(
      'id', l.id, 'title', l.title, 'source', l.source,
      'source_reference', l.source_reference, 'customer_query', l.customer_query,
      'created_at', l.created_at, 'assigned_to', l.assigned_to,
      'customer_id', l.customer_id, 'suggested_assignee_id', l.suggested_assignee_id,
      'customer', CASE WHEN c.id IS NULL THEN NULL ELSE jsonb_build_object(
        'id', c.id, 'company_name', c.company_name, 'contact_person', c.contact_person,
        'phone', c.phone, 'email', c.email, 'city', c.city, 'state', c.state
      ) END,
      'suggested_assignee', CASE WHEN p.id IS NULL THEN NULL ELSE jsonb_build_object(
        'id', p.id, 'full_name', p.full_name
      ) END,
      'qualification', jsonb_build_object(
        'id', q.id, 'qualification_type', q.qualification_type,
        'routed_to', q.routed_to, 'qualified_at', q.qualified_at,
        'decision_reason', q.decision_reason
      )
    ) AS row_data
    FROM public.lead_qualification q
    JOIN public.leads l ON l.id = q.lead_id AND l.deleted_at IS NULL
    LEFT JOIN public.customers c ON c.id = l.customer_id
    LEFT JOIN public.profiles  p ON p.id = l.suggested_assignee_id
    WHERE q.tenant_id = v_tenant
      AND q.is_active = true
      AND (p_vertical_id IS NULL OR l.vertical_id = p_vertical_id)
      AND CASE
        WHEN p_tab = 'nurture'   THEN q.routed_to = 'nurture'
        WHEN p_tab = 'qualified' THEN q.routed_to IN ('spt','tst')
        WHEN p_tab = 'discarded' THEN q.routed_to = 'discard'
        ELSE false
      END
      AND (v_is_manager OR q.qualified_by = v_user OR l.assigned_to = v_user)
      AND (p_from IS NULL OR q.qualified_at >= p_from)
      AND (p_to   IS NULL OR q.qualified_at <= p_to)
    ORDER BY q.qualified_at DESC LIMIT p_limit
  ) sub;
  RETURN v_rows;
END;
$function$;
