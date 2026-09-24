CREATE OR REPLACE FUNCTION public.pick_next_procurement_user(_tenant_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_include_manager boolean := false;
  v_users uuid[];
  v_last  uuid;
  v_idx   int;
  v_next  uuid;
  v_count int;
BEGIN
  SELECT (setting_value = 'true') INTO v_include_manager
  FROM public.company_settings
  WHERE tenant_id = _tenant_id AND setting_key = 'include_manager_in_round_robin'
  LIMIT 1;

  -- 1) Presence-filtered pool: checked-in today and not on approved leave
  SELECT array_agg(p.id ORDER BY p.id) INTO v_users
  FROM public.profiles p
  JOIN public.tenant_users tu
    ON tu.user_id = p.id AND tu.tenant_id = _tenant_id AND tu.is_active = true
  JOIN public.user_roles ur
    ON ur.user_id = p.id AND ur.role = 'procurement'::public.app_role
  WHERE p.is_active = true
    AND COALESCE(p.round_robin_paused, false) = false
    AND (
      v_include_manager = true
      OR NOT EXISTS (
        SELECT 1 FROM public.user_roles ur2
        WHERE ur2.user_id = p.id
          AND ur2.role IN ('manager'::public.app_role,'coo'::public.app_role,'super_admin'::public.app_role)
      )
    )
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
        AND COALESCE(ar.status,'') NOT IN ('absent','on_leave')
    );

  v_count := COALESCE(array_length(v_users,1), 0);

  -- 2) Fallback to unfiltered pool (early morning, holiday, no check-ins yet)
  IF v_count = 0 THEN
    SELECT array_agg(p.id ORDER BY p.id) INTO v_users
    FROM public.profiles p
    JOIN public.tenant_users tu
      ON tu.user_id = p.id AND tu.tenant_id = _tenant_id AND tu.is_active = true
    JOIN public.user_roles ur
      ON ur.user_id = p.id AND ur.role = 'procurement'::public.app_role
    WHERE p.is_active = true
      AND COALESCE(p.round_robin_paused, false) = false
      AND (
        v_include_manager = true
        OR NOT EXISTS (
          SELECT 1 FROM public.user_roles ur2
          WHERE ur2.user_id = p.id
            AND ur2.role IN ('manager'::public.app_role,'coo'::public.app_role,'super_admin'::public.app_role)
        )
      );
    v_count := COALESCE(array_length(v_users,1), 0);
    IF v_count = 0 THEN
      RETURN NULL;
    END IF;
  END IF;

  SELECT last_assigned_user_id INTO v_last
  FROM public.procurement_assignment_state
  WHERE tenant_id = _tenant_id;

  v_idx := 0;
  IF v_last IS NOT NULL THEN
    FOR i IN 1..v_count LOOP
      IF v_users[i] = v_last THEN
        v_idx := i;
        EXIT;
      END IF;
    END LOOP;
  END IF;

  v_idx := (v_idx % v_count) + 1;
  v_next := v_users[v_idx];

  INSERT INTO public.procurement_assignment_state(tenant_id, last_assigned_user_id, updated_at)
  VALUES (_tenant_id, v_next, now())
  ON CONFLICT (tenant_id) DO UPDATE
    SET last_assigned_user_id = EXCLUDED.last_assigned_user_id,
        updated_at = now();

  RETURN v_next;
END;
$function$;