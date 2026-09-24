CREATE OR REPLACE FUNCTION public.pick_next_lqt_user(p_tenant_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_pick uuid;
BEGIN
  -- 1) Presence-filtered pool: only LQT members checked-in today and not on approved leave
  SELECT user_id INTO v_pick
  FROM (
    SELECT p.id AS user_id,
           COUNT(l.id) FILTER (
             WHERE l.assigned_to = p.id
               AND COALESCE(l.deleted_at IS NULL, true)
               AND NOT EXISTS (
                 SELECT 1 FROM public.lead_qualification q WHERE q.lead_id = l.id
               )
           ) AS open_pending,
           MAX(l.created_at) FILTER (WHERE l.assigned_to = p.id) AS last_assigned_at
    FROM public.profiles p
    JOIN public.user_roles ur
      ON ur.user_id = p.id AND ur.role = 'cro'::public.app_role
    JOIN public.tenant_users tu
      ON tu.user_id = p.id AND tu.is_active = true
    LEFT JOIN public.leads l
      ON l.assigned_to = p.id
     AND (p_tenant_id IS NULL OR l.tenant_id = p_tenant_id)
    WHERE (p_tenant_id IS NULL OR tu.tenant_id = p_tenant_id)
      AND COALESCE(p.is_active, true) = true
      AND COALESCE(p.lead_assignment_opt_out, false) = false
      AND COALESCE(p.round_robin_paused, false) = false
      AND NOT EXISTS (
        SELECT 1 FROM public.leave_requests lr
        WHERE lr.user_id = p.id
          AND lr.status = 'approved'
          AND CURRENT_DATE BETWEEN lr.start_date AND lr.end_date
      )
      AND EXISTS (
        SELECT 1 FROM public.attendance_records ar
        WHERE ar.user_id = p.id
          AND ar.date = CURRENT_DATE
          AND ar.check_in_time IS NOT NULL
          AND COALESCE(ar.status, '') NOT IN ('absent','on_leave')
      )
    GROUP BY p.id
  ) backlog
  ORDER BY open_pending ASC, last_assigned_at ASC NULLS FIRST, user_id ASC
  LIMIT 1;

  IF v_pick IS NOT NULL THEN
    RETURN v_pick;
  END IF;

  -- 2) Fallback: original active LQT pool (early morning before check-ins, holidays, etc.)
  SELECT user_id INTO v_pick
  FROM (
    SELECT p.id AS user_id,
           COUNT(l.id) FILTER (
             WHERE l.assigned_to = p.id
               AND COALESCE(l.deleted_at IS NULL, true)
               AND NOT EXISTS (
                 SELECT 1 FROM public.lead_qualification q WHERE q.lead_id = l.id
               )
           ) AS open_pending,
           MAX(l.created_at) FILTER (WHERE l.assigned_to = p.id) AS last_assigned_at
    FROM public.profiles p
    JOIN public.user_roles ur
      ON ur.user_id = p.id AND ur.role = 'cro'::public.app_role
    JOIN public.tenant_users tu
      ON tu.user_id = p.id AND tu.is_active = true
    LEFT JOIN public.leads l
      ON l.assigned_to = p.id
     AND (p_tenant_id IS NULL OR l.tenant_id = p_tenant_id)
    WHERE (p_tenant_id IS NULL OR tu.tenant_id = p_tenant_id)
      AND COALESCE(p.is_active, true) = true
      AND COALESCE(p.lead_assignment_opt_out, false) = false
      AND COALESCE(p.round_robin_paused, false) = false
    GROUP BY p.id
  ) backlog
  ORDER BY open_pending ASC, last_assigned_at ASC NULLS FIRST, user_id ASC
  LIMIT 1;

  RETURN v_pick;
END;
$function$;

COMMENT ON FUNCTION public.pick_next_lqt_user(uuid) IS
'Presence-aware LQT round-robin picker. Prefers checked-in, non-leave LQT members ordered by lowest open backlog. Falls back to full active LQT pool if no one is present today.';