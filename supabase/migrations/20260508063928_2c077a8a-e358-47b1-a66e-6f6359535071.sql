-- 1. Source-driven LQT landing zone
CREATE OR REPLACE FUNCTION public.enforce_lqt_landing_zone()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  v_sweta_id uuid := 'e292c56d-c021-4f33-82de-32794d7a4b59';
  v_external_sources text[] := ARRAY['indiamart','tradeindia','whatsapp','email','website','webhook'];
  v_caller uuid := auth.uid();
  v_caller_is_lqt boolean := false;
  v_lqt_pick uuid;
BEGIN
  NEW.has_enquiry := false;
  NEW.enquiry_status := NULL;

  -- Only enforce LQT landing for external-source leads
  IF NOT (NEW.source::text = ANY(v_external_sources)) THEN
    RETURN NEW;
  END IF;

  -- Allow LQT/CRO users to self-create (e.g. logging a call themselves)
  IF v_caller IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = v_caller AND role = 'cro'::public.app_role
    ) INTO v_caller_is_lqt;

    IF v_caller_is_lqt AND NEW.assigned_to = v_caller THEN
      RETURN NEW;
    END IF;
  END IF;

  -- Preserve original target as loyalty/suggestion hint
  IF NEW.assigned_to IS NOT NULL AND NEW.suggested_assignee_id IS NULL THEN
    NEW.suggested_assignee_id := NEW.assigned_to;
  END IF;

  -- Round-robin to the next presence-aware LQT user
  v_lqt_pick := public.pick_next_lqt_user(NEW.tenant_id);
  IF v_lqt_pick IS NOT NULL THEN
    NEW.assigned_to := v_lqt_pick;
  ELSE
    -- Safety fallback so leads never get stuck
    NEW.assigned_to := v_sweta_id;
  END IF;

  RETURN NEW;
END;
$function$;


-- 2. Auto-assign: loyalty becomes hint-only for external sources
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
  _external_sources text[] := ARRAY['indiamart','tradeindia','whatsapp','email','website','webhook'];
  _is_external boolean := false;
BEGIN
  _is_external := NEW.source::text = ANY(_external_sources);

  -- Loyalty hint (always recorded if available)
  IF NEW.customer_id IS NOT NULL AND NEW.suggested_assignee_id IS NULL THEN
    SELECT assigned_sales_id INTO _loyal_sales
    FROM public.customers
    WHERE id = NEW.customer_id;

    IF _loyal_sales IS NOT NULL THEN
      NEW.suggested_assignee_id := _loyal_sales;
    END IF;
  ELSIF NEW.suggested_assignee_id IS NOT NULL THEN
    _loyal_sales := NEW.suggested_assignee_id;
  END IF;

  -- If something already set assigned_to (landing zone, explicit caller), respect it
  IF NEW.assigned_to IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Pass 1: customer loyalty wins ONLY for non-external-source leads.
  -- External leads must land in LQT first (loyalty stays as a hint only).
  IF NOT _is_external AND _loyal_sales IS NOT NULL THEN
    SELECT TRUE
      INTO _loyal_active
    FROM public.profiles p
    JOIN public.tenant_users tu
      ON tu.user_id = p.id
     AND tu.tenant_id = NEW.tenant_id
     AND tu.is_active = true
    WHERE p.id = _loyal_sales
      AND COALESCE(p.is_active, true) = true
      AND COALESCE(p.employment_status, 'active') = 'active'
      AND p.exit_date IS NULL
      AND COALESCE(p.lead_assignment_opt_out, false) = false
      AND EXISTS (
        SELECT 1 FROM public.user_roles ur
        WHERE ur.user_id = p.id AND ur.role = 'sales'::public.app_role
      );

    IF _loyal_active THEN
      NEW.assigned_to := _loyal_sales;
      RETURN NEW;
    END IF;
  END IF;

  -- Determine creator roles
  IF _creator IS NOT NULL THEN
    SELECT
      EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = _creator AND ur.role = 'cro'::public.app_role),
      EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = _creator AND ur.role = 'sales'::public.app_role)
    INTO _creator_is_lqt, _creator_is_sales;
  END IF;

  -- Pass 2: SPT self-create (sales user creating a lead for themselves) — only for non-external
  IF NOT _is_external AND _creator_is_sales THEN
    NEW.assigned_to := _creator;
    RETURN NEW;
  END IF;

  -- Pass 3: LQT/CRO self-create
  IF _creator_is_lqt THEN
    NEW.assigned_to := _creator;
    RETURN NEW;
  END IF;

  -- Pass 4: LQT round-robin safety net
  _lqt_user := public.pick_next_lqt_user(NEW.tenant_id);
  IF _lqt_user IS NOT NULL THEN
    NEW.assigned_to := _lqt_user;
  END IF;

  RETURN NEW;
END;
$function$;