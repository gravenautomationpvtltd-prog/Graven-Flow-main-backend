
-- =========================================================================
-- Phase 3: Vertical-scoped LQT routing
-- =========================================================================

CREATE OR REPLACE FUNCTION public.pick_next_lqt_user(p_tenant_id uuid, p_vertical_id uuid DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
  v_pick uuid;
BEGIN
  -- 1) Presence-filtered, vertical-scoped pool
  SELECT user_id INTO v_pick
  FROM (
    SELECT p.id AS user_id,
           COUNT(l.id) FILTER (
             WHERE l.assigned_to = p.id
               AND COALESCE(l.deleted_at IS NULL, true)
               AND NOT EXISTS (SELECT 1 FROM public.lead_qualification q WHERE q.lead_id = l.id)
           ) AS open_pending,
           MAX(l.created_at) FILTER (WHERE l.assigned_to = p.id) AS last_assigned_at
    FROM public.profiles p
    JOIN public.user_roles ur ON ur.user_id = p.id AND ur.role = 'cro'::public.app_role
    JOIN public.tenant_users tu ON tu.user_id = p.id AND tu.is_active = true
    LEFT JOIN public.leads l
      ON l.assigned_to = p.id
     AND (p_tenant_id IS NULL OR l.tenant_id = p_tenant_id)
     AND (p_vertical_id IS NULL OR l.vertical_id = p_vertical_id)
    WHERE (p_tenant_id IS NULL OR tu.tenant_id = p_tenant_id)
      AND COALESCE(p.is_active, true) = true
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
      )
      AND EXISTS (
        SELECT 1 FROM public.attendance_records ar
        WHERE ar.user_id = p.id AND ar.date = CURRENT_DATE
          AND ar.check_in_time IS NOT NULL
          AND COALESCE(ar.status, '') NOT IN ('absent','on_leave')
      )
    GROUP BY p.id
  ) backlog
  ORDER BY open_pending ASC, last_assigned_at ASC NULLS FIRST, user_id ASC
  LIMIT 1;

  IF v_pick IS NOT NULL THEN RETURN v_pick; END IF;

  -- 2) Vertical-scoped fallback ignoring presence
  SELECT user_id INTO v_pick
  FROM (
    SELECT p.id AS user_id,
           COUNT(l.id) FILTER (
             WHERE l.assigned_to = p.id
               AND COALESCE(l.deleted_at IS NULL, true)
               AND NOT EXISTS (SELECT 1 FROM public.lead_qualification q WHERE q.lead_id = l.id)
           ) AS open_pending,
           MAX(l.created_at) FILTER (WHERE l.assigned_to = p.id) AS last_assigned_at
    FROM public.profiles p
    JOIN public.user_roles ur ON ur.user_id = p.id AND ur.role = 'cro'::public.app_role
    JOIN public.tenant_users tu ON tu.user_id = p.id AND tu.is_active = true
    LEFT JOIN public.leads l
      ON l.assigned_to = p.id
     AND (p_tenant_id IS NULL OR l.tenant_id = p_tenant_id)
     AND (p_vertical_id IS NULL OR l.vertical_id = p_vertical_id)
    WHERE (p_tenant_id IS NULL OR tu.tenant_id = p_tenant_id)
      AND COALESCE(p.is_active, true) = true
      AND COALESCE(p.lead_assignment_opt_out, false) = false
      AND COALESCE(p.round_robin_paused, false) = false
      AND (
        p_vertical_id IS NULL OR EXISTS (
          SELECT 1 FROM public.vertical_users vu
          WHERE vu.user_id = p.id AND vu.vertical_id = p_vertical_id AND vu.is_active = true
        )
      )
    GROUP BY p.id
  ) backlog
  ORDER BY open_pending ASC, last_assigned_at ASC NULLS FIRST, user_id ASC
  LIMIT 1;

  IF v_pick IS NOT NULL THEN RETURN v_pick; END IF;

  -- 3) Cross-vertical safety net (any active LQT user in the tenant)
  IF p_vertical_id IS NOT NULL THEN
    RETURN public.pick_next_lqt_user(p_tenant_id, NULL);
  END IF;

  RETURN NULL;
END;
$function$;

CREATE OR REPLACE FUNCTION public.enforce_lqt_landing_zone()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $function$
DECLARE
  v_sweta_id uuid := 'e292c56d-c021-4f33-82de-32794d7a4b59';
  v_external_sources text[] := ARRAY['indiamart','tradeindia','whatsapp','email','website','webhook'];
  v_caller uuid := auth.uid();
  v_caller_is_lqt boolean := false;
  v_lqt_pick uuid;
BEGIN
  NEW.has_enquiry := false;
  NEW.enquiry_status := NULL;

  IF NOT (NEW.source::text = ANY(v_external_sources)) THEN
    RETURN NEW;
  END IF;

  IF v_caller IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = v_caller AND role = 'cro'::public.app_role
    ) INTO v_caller_is_lqt;
    IF v_caller_is_lqt AND NEW.assigned_to = v_caller THEN
      RETURN NEW;
    END IF;
  END IF;

  IF NEW.assigned_to IS NOT NULL AND NEW.suggested_assignee_id IS NULL THEN
    NEW.suggested_assignee_id := NEW.assigned_to;
  END IF;

  v_lqt_pick := public.pick_next_lqt_user(NEW.tenant_id, NEW.vertical_id);
  IF v_lqt_pick IS NOT NULL THEN
    NEW.assigned_to := v_lqt_pick;
  ELSE
    NEW.assigned_to := v_sweta_id;
  END IF;

  RETURN NEW;
END;
$function$;
