-- Fix LQT Lead Assignment: Round Robin sequence and employee visibility scoping

-- 1. Ensure lqt_round_robin_tracker exists with proper primary key and columns
CREATE TABLE IF NOT EXISTS public.lqt_round_robin_tracker (
  tenant_id uuid PRIMARY KEY REFERENCES public.tenants(id) ON DELETE CASCADE,
  last_assigned_lqt_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Centralized, deterministic Round Robin picker for LQT (CRO) team
CREATE OR REPLACE FUNCTION public.pick_next_lqt_user(
  p_tenant_id uuid,
  p_vertical_id uuid DEFAULT NULL::uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant uuid := COALESCE(p_tenant_id, '1a5184ef-5138-4327-8928-67bc4f229131'::uuid);
  v_users uuid[];
  v_count int;
  v_last uuid;
  v_idx int := 0;
  v_pick uuid;
BEGIN
  -- 1) Gather active eligible LQT (cro) members in tenant
  SELECT array_agg(p.id ORDER BY p.full_name, p.id)
  INTO v_users
  FROM public.profiles p
  JOIN public.user_roles ur ON ur.user_id = p.id AND ur.role = 'cro'::public.app_role
  JOIN public.tenant_users tu ON tu.user_id = p.id AND tu.is_active = true
  WHERE tu.tenant_id = v_tenant
    AND COALESCE(p.is_active, true) = true
    AND COALESCE(p.employment_status, 'active') = 'active'
    AND p.exit_date IS NULL
    AND COALESCE(p.lead_assignment_opt_out, false) = false
    AND COALESCE(p.round_robin_paused, false) = false
    AND (
      p_vertical_id IS NULL OR EXISTS (
        SELECT 1 FROM public.vertical_users vu
        WHERE vu.user_id = p.id AND vu.vertical_id = p_vertical_id AND vu.is_active = true
      )
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.leave_requests lr
      WHERE lr.user_id = p.id AND lr.status = 'approved'
        AND CURRENT_DATE BETWEEN lr.start_date AND lr.end_date
    );

  v_count := COALESCE(array_length(v_users, 1), 0);

  -- Fallback across verticals if vertical-scoped had no eligible users
  IF v_count = 0 AND p_vertical_id IS NOT NULL THEN
    RETURN public.pick_next_lqt_user(v_tenant, NULL);
  END IF;

  IF v_count = 0 THEN
    RETURN NULL;
  END IF;

  -- 2) Check tracker for last assigned LQT user
  SELECT last_assigned_lqt_id INTO v_last
  FROM public.lqt_round_robin_tracker
  WHERE tenant_id = v_tenant;

  -- Fallback: check most recently assigned lead among eligible users if tracker is empty
  IF v_last IS NULL THEN
    SELECT l.assigned_to INTO v_last
    FROM public.leads l
    WHERE l.tenant_id = v_tenant
      AND l.assigned_to = ANY(v_users)
      AND l.deleted_at IS NULL
    ORDER BY l.created_at DESC
    LIMIT 1;
  END IF;

  -- 3) Advance to next user in round-robin sequence
  IF v_last IS NOT NULL THEN
    FOR i IN 1..v_count LOOP
      IF v_users[i] = v_last THEN
        v_idx := i;
        EXIT;
      END IF;
    END LOOP;
  END IF;

  v_pick := v_users[(v_idx % v_count) + 1];

  -- 4) Update tracker atomically
  INSERT INTO public.lqt_round_robin_tracker (tenant_id, last_assigned_lqt_id, updated_at)
  VALUES (v_tenant, v_pick, now())
  ON CONFLICT (tenant_id)
  DO UPDATE SET
    last_assigned_lqt_id = EXCLUDED.last_assigned_lqt_id,
    updated_at = EXCLUDED.updated_at;

  RETURN v_pick;
END;
$$;

-- Single-argument overload
CREATE OR REPLACE FUNCTION public.pick_next_lqt_user(p_tenant_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN public.pick_next_lqt_user(p_tenant_id, NULL::uuid);
END;
$$;

-- Office-scoped overload
CREATE OR REPLACE FUNCTION public.pick_next_lqt_user_in_office(p_tenant_id uuid, p_office_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN public.pick_next_lqt_user(p_tenant_id, NULL);
END;
$$;

-- 3. enforce_lqt_landing_zone trigger function
CREATE OR REPLACE FUNCTION public.enforce_lqt_landing_zone()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_external_sources text[] := ARRAY['indiamart','tradeindia','whatsapp','email','website','webhook'];
  v_caller uuid := auth.uid();
  v_caller_is_lqt boolean := false;
  v_lqt_pick uuid;
  v_loyal uuid;
BEGIN
  NEW.has_enquiry := false;
  NEW.enquiry_status := NULL;

  IF NEW.tenant_id IS NULL THEN
    NEW.tenant_id := '1a5184ef-5138-4327-8928-67bc4f229131'::uuid;
  END IF;

  IF NEW.customer_id IS NOT NULL AND NEW.suggested_assignee_id IS NULL THEN
    SELECT assigned_sales_id INTO v_loyal FROM public.customers WHERE id = NEW.customer_id;
    IF v_loyal IS NOT NULL THEN
      NEW.suggested_assignee_id := v_loyal;
    END IF;
  END IF;

  -- CRO author inserting manually: stays with creator
  IF v_caller IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM public.user_roles WHERE user_id = v_caller AND role = 'cro'::public.app_role
    ) INTO v_caller_is_lqt;

    IF v_caller_is_lqt THEN
      NEW.assigned_to := v_caller;
      PERFORM set_config('app.lead_assign_reason', 'manual_by_cro', true);
      RETURN NEW;
    END IF;
  END IF;

  IF NOT (NEW.source::text = ANY(v_external_sources)) THEN
    RETURN NEW;
  END IF;

  IF NEW.assigned_to IS NOT NULL AND NEW.suggested_assignee_id IS NULL THEN
    NEW.suggested_assignee_id := NEW.assigned_to;
  END IF;

  -- Centralized Round Robin assignment
  v_lqt_pick := public.pick_next_lqt_user(NEW.tenant_id, NEW.vertical_id);

  IF v_lqt_pick IS NOT NULL THEN
    NEW.assigned_to := v_lqt_pick;
    PERFORM set_config('app.lead_assign_reason', 'webhook_round_robin', true);
  ELSE
    PERFORM set_config('app.lead_assign_reason', 'unassigned_no_cro_available', true);
  END IF;

  RETURN NEW;
END;
$$;

-- 4. get_lqt_inbox: Enforce strict backend assignment scoping (assigned_to = current authenticated employee)
CREATE OR REPLACE FUNCTION public.get_lqt_inbox(
  p_tab text,
  p_from timestamp with time zone DEFAULT NULL::timestamp with time zone,
  p_to timestamp with time zone DEFAULT NULL::timestamp with time zone,
  p_limit integer DEFAULT 500,
  p_vertical_id uuid DEFAULT NULL::uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
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
  IF v_tenant IS NULL THEN
    v_tenant := '1a5184ef-5138-4327-8928-67bc4f229131'::uuid;
  END IF;

  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = v_user AND role = 'cro'::app_role) INTO v_is_lqt;
  SELECT (public.is_manager_or_above(v_user) OR EXISTS(SELECT 1 FROM public.user_roles WHERE user_id = v_user AND role = 'platform_admin'::app_role)) INTO v_is_manager;

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
$$;

-- 5. get_lqt_stats: Scoped stats for non-managers
CREATE OR REPLACE FUNCTION public.get_lqt_stats(
  p_from timestamp with time zone DEFAULT NULL::timestamp with time zone,
  p_to timestamp with time zone DEFAULT NULL::timestamp with time zone
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_tenant uuid;
  v_is_manager boolean := false;
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
    v_tenant := '1a5184ef-5138-4327-8928-67bc4f229131'::uuid;
  END IF;

  SELECT (public.is_manager_or_above(v_uid) OR EXISTS(SELECT 1 FROM public.user_roles WHERE user_id = v_uid AND role = 'platform_admin'::app_role)) INTO v_is_manager;

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
      AND (
        (v_is_manager AND l.assigned_to IN (SELECT user_id FROM cro_users))
        OR (NOT v_is_manager AND l.assigned_to = v_uid)
      )
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
      AND (
        (v_is_manager AND l.assigned_to IN (
          SELECT ur.user_id FROM public.user_roles ur
          JOIN public.profiles p ON p.id = ur.user_id
          WHERE ur.role = 'cro' AND p.tenant_id = v_tenant
        ))
        OR (NOT v_is_manager AND l.assigned_to = v_uid)
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
      AND (v_is_manager OR q.qualified_by = v_uid OR l.assigned_to = v_uid)
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
      AND (v_is_manager OR q.qualified_by = v_uid OR l.assigned_to = v_uid)
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
$$;
