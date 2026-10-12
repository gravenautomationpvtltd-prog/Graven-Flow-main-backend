-- Fix enforce_lqt_landing_zone so sales reps, CST, and managers creating leads manually
-- never have their leads hijacked and reassigned away to CRO round-robin.

CREATE OR REPLACE FUNCTION public.enforce_lqt_landing_zone()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  v_external_sources text[] := ARRAY['indiamart','tradeindia','whatsapp','email','website','webhook'];
  v_caller uuid := auth.uid();
  v_caller_is_lqt boolean := false;
  v_caller_is_sales boolean := false;
  v_caller_is_manager boolean := false;
  v_lqt_pick uuid;
  v_loyal uuid;
BEGIN
  -- Preserve has_enquiry if explicitly provided (e.g. repeat enquiry, manual enquiry creation)
  IF NEW.has_enquiry IS NULL THEN
    NEW.has_enquiry := false;
  END IF;

  IF NEW.tenant_id IS NULL THEN
    NEW.tenant_id := '1a5184ef-5138-4327-8928-67bc4f229131'::uuid;
  END IF;

  IF NEW.customer_id IS NOT NULL AND NEW.suggested_assignee_id IS NULL THEN
    SELECT assigned_sales_id INTO v_loyal FROM public.customers WHERE id = NEW.customer_id;
    IF v_loyal IS NOT NULL THEN
      NEW.suggested_assignee_id := v_loyal;
    END IF;
  END IF;

  -- If created manually by an authenticated user in the UI:
  IF v_caller IS NOT NULL THEN
    SELECT 
      EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = v_caller AND role::text = 'cro'),
      EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = v_caller AND role::text = 'sales'),
      EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = v_caller AND role::text IN ('super_admin', 'platform_admin', 'manager', 'coo', 'cst'))
    INTO v_caller_is_lqt, v_caller_is_sales, v_caller_is_manager;

    -- CRO user inserting manually: stays with creator or designated assignee
    IF v_caller_is_lqt THEN
      NEW.assigned_to := COALESCE(NEW.assigned_to, v_caller);
      PERFORM set_config('app.lead_assign_reason', 'manual_by_cro', true);
      RETURN NEW;
    END IF;

    -- Sales rep inserting manually: stays with designated assignee or creator
    IF v_caller_is_sales THEN
      NEW.assigned_to := COALESCE(NEW.assigned_to, v_caller);
      PERFORM set_config('app.lead_assign_reason', 'manual_by_spt', true);
      RETURN NEW;
    END IF;

    -- Manager / Admin / CST inserting manually: keep designated assigned_to or customer loyal rep or creator
    IF v_caller_is_manager THEN
      NEW.assigned_to := COALESCE(NEW.assigned_to, v_loyal, v_caller);
      PERFORM set_config('app.lead_assign_reason', 'manual_by_manager', true);
      RETURN NEW;
    END IF;
  END IF;

  -- Only automated external sources (webhooks, sync daemons where v_caller is NULL) route through LQT
  IF NOT (NEW.source::text = ANY(v_external_sources)) THEN
    RETURN NEW;
  END IF;

  IF NEW.assigned_to IS NOT NULL AND NEW.suggested_assignee_id IS NULL THEN
    NEW.suggested_assignee_id := NEW.assigned_to;
  END IF;

  -- Centralized Round Robin assignment to CROs for automated ingestion
  v_lqt_pick := public.pick_next_lqt_user(NEW.tenant_id, NEW.vertical_id);

  IF v_lqt_pick IS NOT NULL THEN
    NEW.assigned_to := v_lqt_pick;
    PERFORM set_config('app.lead_assign_reason', 'webhook_round_robin', true);
  ELSE
    PERFORM set_config('app.lead_assign_reason', 'unassigned_no_cro_available', true);
  END IF;

  RETURN NEW;
END;
$function$;
