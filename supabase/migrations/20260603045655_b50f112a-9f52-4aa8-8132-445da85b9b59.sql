-- 1. Add a machine-readable source tag
ALTER TABLE public.lead_assignment_history
  ADD COLUMN IF NOT EXISTS assignment_source text;

CREATE INDEX IF NOT EXISTS idx_lead_assignment_history_lead_created
  ON public.lead_assignment_history (lead_id, created_at DESC);

-- 2. Replace enforce_lqt_landing_zone to stamp a reason via session GUC
CREATE OR REPLACE FUNCTION public.enforce_lqt_landing_zone()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  v_external_sources text[] := ARRAY['indiamart','tradeindia','whatsapp','email','website','webhook'];
  v_caller uuid := auth.uid();
  v_caller_is_lqt boolean := false;
  v_lqt_pick uuid;
  v_loyal uuid;
BEGIN
  NEW.has_enquiry := false;
  NEW.enquiry_status := NULL;

  IF NEW.customer_id IS NOT NULL AND NEW.suggested_assignee_id IS NULL THEN
    SELECT assigned_sales_id INTO v_loyal FROM public.customers WHERE id = NEW.customer_id;
    IF v_loyal IS NOT NULL THEN
      NEW.suggested_assignee_id := v_loyal;
    END IF;
  END IF;

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

  v_lqt_pick := public.pick_next_lqt_user(NEW.tenant_id, NEW.vertical_id);

  IF v_lqt_pick IS NULL THEN
    SELECT user_id INTO v_lqt_pick
    FROM (
      SELECT p.id AS user_id,
             COUNT(l.id) FILTER (
               WHERE l.assigned_to = p.id AND l.deleted_at IS NULL
                 AND l.created_at >= date_trunc('day', now() AT TIME ZONE 'Asia/Kolkata') AT TIME ZONE 'Asia/Kolkata'
             ) AS assigned_today,
             MAX(l.created_at) FILTER (WHERE l.assigned_to = p.id) AS last_assigned_at
      FROM public.profiles p
      JOIN public.user_roles ur ON ur.user_id = p.id AND ur.role = 'cro'::public.app_role
      JOIN public.tenant_users tu ON tu.user_id = p.id AND tu.is_active = true AND tu.tenant_id = NEW.tenant_id
      LEFT JOIN public.leads l ON l.assigned_to = p.id AND l.tenant_id = NEW.tenant_id
      WHERE COALESCE(p.is_active, true) = true
        AND COALESCE(p.lead_assignment_opt_out, false) = false
        AND COALESCE(p.round_robin_paused, false) = false
        AND (NEW.vertical_id IS NULL OR EXISTS (
          SELECT 1 FROM public.vertical_users vu
          WHERE vu.user_id = p.id AND vu.vertical_id = NEW.vertical_id AND vu.is_active = true
        ))
        AND NOT EXISTS (
          SELECT 1 FROM public.leave_requests lr
          WHERE lr.user_id = p.id AND lr.status = 'approved'
            AND CURRENT_DATE BETWEEN lr.start_date AND lr.end_date
        )
      GROUP BY p.id
    ) pool
    ORDER BY assigned_today ASC, last_assigned_at ASC NULLS FIRST, user_id ASC
    LIMIT 1;
  END IF;

  IF v_lqt_pick IS NULL AND NEW.vertical_id IS NOT NULL THEN
    SELECT user_id INTO v_lqt_pick
    FROM (
      SELECT p.id AS user_id,
             COUNT(l.id) FILTER (
               WHERE l.assigned_to = p.id AND l.deleted_at IS NULL
                 AND l.created_at >= date_trunc('day', now() AT TIME ZONE 'Asia/Kolkata') AT TIME ZONE 'Asia/Kolkata'
             ) AS assigned_today,
             MAX(l.created_at) FILTER (WHERE l.assigned_to = p.id) AS last_assigned_at
      FROM public.profiles p
      JOIN public.user_roles ur ON ur.user_id = p.id AND ur.role = 'cro'::public.app_role
      JOIN public.tenant_users tu ON tu.user_id = p.id AND tu.is_active = true AND tu.tenant_id = NEW.tenant_id
      LEFT JOIN public.leads l ON l.assigned_to = p.id AND l.tenant_id = NEW.tenant_id
      WHERE COALESCE(p.is_active, true) = true
        AND COALESCE(p.lead_assignment_opt_out, false) = false
        AND COALESCE(p.round_robin_paused, false) = false
      GROUP BY p.id
    ) pool
    ORDER BY assigned_today ASC, last_assigned_at ASC NULLS FIRST, user_id ASC
    LIMIT 1;
  END IF;

  IF v_lqt_pick IS NOT NULL THEN
    NEW.assigned_to := v_lqt_pick;
    PERFORM set_config('app.lead_assign_reason', 'webhook_round_robin', true);
  ELSE
    PERFORM set_config('app.lead_assign_reason', 'unassigned_no_cro_available', true);
  END IF;

  RETURN NEW;
END;
$function$;

-- 3. Patch auto_assign_lead_on_insert to also stamp reasons
CREATE OR REPLACE FUNCTION public.auto_assign_lead_on_insert()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _creator uuid := auth.uid();
  _creator_is_lqt boolean := false;
  _creator_is_sales boolean := false;
  _loyal_sales uuid;
  _loyal_active boolean := false;
  _lqt_user uuid;
BEGIN
  IF NEW.customer_id IS NOT NULL AND NEW.suggested_assignee_id IS NULL THEN
    SELECT assigned_sales_id INTO _loyal_sales FROM public.customers WHERE id = NEW.customer_id;
    IF _loyal_sales IS NOT NULL THEN
      NEW.suggested_assignee_id := _loyal_sales;
    END IF;
  ELSIF NEW.suggested_assignee_id IS NOT NULL THEN
    _loyal_sales := NEW.suggested_assignee_id;
  END IF;

  IF NEW.assigned_to IS NOT NULL THEN
    -- Reason already set upstream (or external system specified it)
    IF current_setting('app.lead_assign_reason', true) IS NULL
       OR current_setting('app.lead_assign_reason', true) = '' THEN
      PERFORM set_config('app.lead_assign_reason', 'preset_by_creator', true);
    END IF;
    RETURN NEW;
  END IF;

  IF _creator IS NOT NULL THEN
    SELECT
      EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = _creator AND ur.role = 'cro'::public.app_role),
      EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = _creator AND ur.role = 'sales'::public.app_role)
    INTO _creator_is_lqt, _creator_is_sales;
  END IF;

  IF _creator_is_lqt AND NEW.source = 'manual'::public.lead_source THEN
    NEW.assigned_to := _creator;
    PERFORM set_config('app.lead_assign_reason', 'manual_by_cro', true);
    RETURN NEW;
  END IF;

  IF _loyal_sales IS NOT NULL THEN
    SELECT TRUE INTO _loyal_active
    FROM public.profiles p
    JOIN public.tenant_users tu ON tu.user_id = p.id AND tu.tenant_id = NEW.tenant_id AND tu.is_active = true
    WHERE p.id = _loyal_sales
      AND COALESCE(p.is_active, true) = true
      AND COALESCE(p.employment_status, 'active') = 'active'
      AND p.exit_date IS NULL
      AND COALESCE(p.lead_assignment_opt_out, false) = false
      AND EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = p.id AND ur.role = 'sales'::public.app_role);

    IF _loyal_active THEN
      NEW.assigned_to := _loyal_sales;
      PERFORM set_config('app.lead_assign_reason', 'customer_loyalty', true);
      RETURN NEW;
    END IF;
  END IF;

  IF _creator_is_sales THEN
    NEW.assigned_to := _creator;
    PERFORM set_config('app.lead_assign_reason', 'manual_by_spt', true);
    RETURN NEW;
  END IF;

  IF _creator_is_lqt THEN
    NEW.assigned_to := _creator;
    PERFORM set_config('app.lead_assign_reason', 'manual_by_cro', true);
    RETURN NEW;
  END IF;

  _lqt_user := public.pick_next_lqt_user(NEW.tenant_id);
  IF _lqt_user IS NOT NULL THEN
    NEW.assigned_to := _lqt_user;
    PERFORM set_config('app.lead_assign_reason', 'lqt_round_robin', true);
  END IF;

  RETURN NEW;
END;
$function$;

-- 4. AFTER INSERT trigger: log the initial assignment with the stamped reason
CREATE OR REPLACE FUNCTION public.log_initial_lead_assignment()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_reason text;
  v_human text;
BEGIN
  v_reason := COALESCE(NULLIF(current_setting('app.lead_assign_reason', true), ''), 'initial_creation');

  v_human := CASE v_reason
    WHEN 'manual_by_cro'              THEN 'Manually added by LQT/CRO user'
    WHEN 'manual_by_spt'              THEN 'Manually added by salesperson'
    WHEN 'customer_loyalty'           THEN 'Routed via customer loyalty'
    WHEN 'lqt_round_robin'            THEN 'LQT round-robin'
    WHEN 'webhook_round_robin'        THEN 'API/webhook lead, CRO round-robin'
    WHEN 'preset_by_creator'          THEN 'Pre-assigned at creation'
    WHEN 'unassigned_no_cro_available' THEN 'No CRO available, left unassigned'
    ELSE 'Initial assignment'
  END;

  INSERT INTO public.lead_assignment_history
    (lead_id, tenant_id, assigned_from, assigned_to, changed_by, reason, assignment_source)
  VALUES
    (NEW.id, NEW.tenant_id, NULL, NEW.assigned_to, auth.uid(), v_human, v_reason);

  -- Clear so the GUC doesn't bleed into the next insert in the same session
  PERFORM set_config('app.lead_assign_reason', '', true);

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_log_initial_lead_assignment ON public.leads;
CREATE TRIGGER trg_log_initial_lead_assignment
AFTER INSERT ON public.leads
FOR EACH ROW EXECUTE FUNCTION public.log_initial_lead_assignment();

-- 5. Update reassignment logger to also record source tag
CREATE OR REPLACE FUNCTION public.log_lead_assignment_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_reason_tag text;
  v_human text;
BEGIN
  IF (NEW.assigned_to IS DISTINCT FROM OLD.assigned_to) THEN
    v_reason_tag := COALESCE(NULLIF(current_setting('app.lead_assign_reason', true), ''), 'manual_reassignment');
    v_human := CASE v_reason_tag
      WHEN 'manual_reassignment' THEN 'Manually reassigned'
      WHEN 'customer_loyalty'    THEN 'Reassigned via customer loyalty'
      WHEN 'redistribution'      THEN 'Bulk redistribution'
      WHEN 'loyalty_reassignment_2026_06_03' THEN 'Loyalty rebalance'
      ELSE initcap(replace(v_reason_tag, '_', ' '))
    END;

    INSERT INTO public.lead_assignment_history
      (lead_id, tenant_id, assigned_from, assigned_to, changed_by, reason, assignment_source)
    VALUES
      (NEW.id, NEW.tenant_id, OLD.assigned_to, NEW.assigned_to, auth.uid(), v_human, v_reason_tag);

    PERFORM set_config('app.lead_assign_reason', '', true);
  END IF;
  RETURN NEW;
END;
$function$;