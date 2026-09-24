-- Backlog-aware fair LQT picker
CREATE OR REPLACE FUNCTION public.pick_next_lqt_user(p_tenant_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_pick uuid;
BEGIN
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

-- Universal LQT landing: every new lead lands in LQT pool; loyalty = hint only
CREATE OR REPLACE FUNCTION public.auto_assign_lead_on_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _loyal_sales uuid;
  _lqt_user uuid;
  _creator uuid := auth.uid();
  _creator_is_lqt boolean := false;
BEGIN
  -- Loyalty hint (always recorded if available)
  IF NEW.customer_id IS NOT NULL AND NEW.suggested_assignee_id IS NULL THEN
    SELECT assigned_sales_id INTO _loyal_sales
    FROM public.customers
    WHERE id = NEW.customer_id;

    IF _loyal_sales IS NOT NULL THEN
      NEW.suggested_assignee_id := _loyal_sales;
    END IF;
  END IF;

  -- Determine if creator is LQT (cro)
  IF _creator IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = _creator
        AND ur.role = 'cro'::public.app_role
    ) INTO _creator_is_lqt;
  END IF;

  -- Universal LQT landing for assignment
  IF NEW.assigned_to IS NULL THEN
    IF _creator_is_lqt THEN
      NEW.assigned_to := _creator;
    ELSE
      _lqt_user := public.pick_next_lqt_user(NEW.tenant_id);
      IF _lqt_user IS NOT NULL THEN
        NEW.assigned_to := _lqt_user;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;