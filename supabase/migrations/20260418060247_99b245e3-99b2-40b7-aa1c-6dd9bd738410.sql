-- A. assign_lead_to_spt function
CREATE OR REPLACE FUNCTION public.assign_lead_to_spt(p_lead_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_customer_id uuid;
  v_customer_state text;
  v_loyal_sales_id uuid;
  v_tenant_id uuid;
  v_current_assigned uuid;
  v_lucknow_office_id uuid;
  v_users uuid[];
  v_user_count integer;
  v_last_assigned_id uuid;
  v_index integer := 0;
  v_next_user_id uuid;
  v_rule record;
  v_rule_states text[];
  v_rule_user_opted_out boolean;
BEGIN
  SELECT customer_id, tenant_id, assigned_to
  INTO v_customer_id, v_tenant_id, v_current_assigned
  FROM public.leads WHERE id = p_lead_id;

  IF v_customer_id IS NOT NULL THEN
    SELECT assigned_sales_id, state INTO v_loyal_sales_id, v_customer_state
    FROM public.customers WHERE id = v_customer_id;

    IF v_loyal_sales_id IS NOT NULL THEN
      IF v_current_assigned IS DISTINCT FROM v_loyal_sales_id THEN
        UPDATE public.leads SET assigned_to = v_loyal_sales_id WHERE id = p_lead_id;
        INSERT INTO public.customer_assignment_history (customer_id, assigned_to, tenant_id)
        VALUES (v_customer_id, v_loyal_sales_id, v_tenant_id);
      END IF;
      RETURN v_loyal_sales_id;
    END IF;
  END IF;

  -- State-based rule
  IF v_customer_state IS NOT NULL THEN
    FOR v_rule IN
      SELECT * FROM public.lead_assignment_rules
      WHERE is_active = true AND state IS NOT NULL
      ORDER BY priority DESC
    LOOP
      v_rule_states := string_to_array(lower(trim(v_rule.state)), ',');
      FOR i IN 1..array_length(v_rule_states, 1) LOOP
        v_rule_states[i] := trim(v_rule_states[i]);
      END LOOP;
      IF lower(trim(v_customer_state)) = ANY(v_rule_states) THEN
        SELECT COALESCE(lead_assignment_opt_out, false) INTO v_rule_user_opted_out
        FROM public.profiles WHERE id = v_rule.assigned_user_id;
        IF v_rule_user_opted_out THEN CONTINUE; END IF;
        -- only if user has 'sales' role
        IF EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = v_rule.assigned_user_id AND role = 'sales') THEN
          UPDATE public.leads SET assigned_to = v_rule.assigned_user_id WHERE id = p_lead_id;
          IF v_customer_id IS NOT NULL THEN
            INSERT INTO public.customer_assignment_history (customer_id, assigned_to, tenant_id)
            VALUES (v_customer_id, v_rule.assigned_user_id, v_tenant_id);
          END IF;
          RETURN v_rule.assigned_user_id;
        END IF;
      END IF;
    END LOOP;
  END IF;

  -- Round-robin restricted strictly to 'sales' role
  SELECT id INTO v_lucknow_office_id FROM public.offices WHERE location = 'lucknow' LIMIT 1;
  IF v_lucknow_office_id IS NULL THEN RETURN NULL; END IF;

  SELECT array_agg(p.id ORDER BY p.id)
  INTO v_users
  FROM public.profiles p
  JOIN public.user_roles ur ON ur.user_id = p.id AND ur.role = 'sales'
  WHERE p.office_id = v_lucknow_office_id
    AND p.is_active = true
    AND COALESCE(p.lead_assignment_opt_out, false) = false
    AND NOT EXISTS (
      SELECT 1 FROM public.leave_requests lr
      WHERE lr.user_id = p.id AND lr.status = 'approved'
        AND CURRENT_DATE BETWEEN lr.start_date AND lr.end_date
    )
    -- Exclude users whose ONLY non-sales roles would mismatch (already filtered to sales)
    AND NOT EXISTS (
      SELECT 1 FROM public.user_roles ur2
      WHERE ur2.user_id = p.id AND ur2.role IN ('cro','tst','cst')
        AND NOT EXISTS (SELECT 1 FROM public.user_roles ur3 WHERE ur3.user_id = p.id AND ur3.role = 'sales')
    );

  v_user_count := COALESCE(array_length(v_users, 1), 0);
  IF v_user_count = 0 THEN RETURN NULL; END IF;

  SELECT last_assigned_user_id INTO v_last_assigned_id
  FROM public.round_robin_tracker WHERE office_id = v_lucknow_office_id;

  IF v_last_assigned_id IS NOT NULL THEN
    FOR i IN 1..v_user_count LOOP
      IF v_users[i] = v_last_assigned_id THEN v_index := i; EXIT; END IF;
    END LOOP;
  END IF;

  v_index := (v_index % v_user_count) + 1;
  v_next_user_id := v_users[v_index];

  UPDATE public.leads SET assigned_to = v_next_user_id WHERE id = p_lead_id;
  UPDATE public.round_robin_tracker
  SET last_assigned_user_id = v_next_user_id, updated_at = now()
  WHERE office_id = v_lucknow_office_id;

  IF v_customer_id IS NOT NULL THEN
    INSERT INTO public.customer_assignment_history (customer_id, assigned_to, tenant_id)
    VALUES (v_customer_id, v_next_user_id, v_tenant_id);
  END IF;

  RETURN v_next_user_id;
END;
$$;

-- B. Trigger on lead_qualification
CREATE OR REPLACE FUNCTION public.trg_fn_reassign_on_qualification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.routed_to IN ('spt','tst') THEN
    PERFORM public.assign_lead_to_spt(NEW.lead_id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_reassign_on_qualification ON public.lead_qualification;
CREATE TRIGGER trg_reassign_on_qualification
AFTER INSERT OR UPDATE ON public.lead_qualification
FOR EACH ROW EXECUTE FUNCTION public.trg_fn_reassign_on_qualification();

-- C. Trigger on boqs handoff
CREATE OR REPLACE FUNCTION public.trg_fn_reassign_on_boq_handoff()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.status = 'handed_off' AND (OLD.status IS DISTINCT FROM NEW.status) THEN
    PERFORM public.assign_lead_to_spt(NEW.lead_id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_reassign_on_boq_handoff ON public.boqs;
CREATE TRIGGER trg_reassign_on_boq_handoff
AFTER UPDATE ON public.boqs
FOR EACH ROW EXECUTE FUNCTION public.trg_fn_reassign_on_boq_handoff();

-- E. Harden auto_assign_lead_on_insert: exclude non-sales-only users from round-robin
CREATE OR REPLACE FUNCTION public.auto_assign_lead_on_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_sales_id uuid;
  v_lucknow_office_id uuid;
  v_last_assigned_id uuid;
  v_next_user_id uuid;
  v_users uuid[];
  v_user_count integer;
  v_index integer := 0;
  v_assignable_roles text[];
  v_customer_state text;
  v_rule record;
  v_rule_states text[];
  v_rule_user_opted_out boolean;
BEGIN
  IF NEW.assigned_to IS NOT NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.customer_id IS NOT NULL THEN
    SELECT assigned_sales_id INTO v_sales_id
    FROM customers WHERE id = NEW.customer_id;

    IF v_sales_id IS NOT NULL THEN
      NEW.assigned_to := v_sales_id;
      RETURN NEW;
    END IF;

    SELECT state INTO v_customer_state
    FROM customers WHERE id = NEW.customer_id;
  END IF;

  SELECT id INTO v_lucknow_office_id FROM offices WHERE location = 'lucknow' LIMIT 1;
  IF v_lucknow_office_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF v_customer_state IS NOT NULL THEN
    FOR v_rule IN
      SELECT * FROM lead_assignment_rules
      WHERE is_active = true AND state IS NOT NULL
      ORDER BY priority DESC
    LOOP
      v_rule_states := string_to_array(lower(trim(v_rule.state)), ',');
      FOR i IN 1..array_length(v_rule_states, 1) LOOP
        v_rule_states[i] := trim(v_rule_states[i]);
      END LOOP;

      IF lower(trim(v_customer_state)) = ANY(v_rule_states) THEN
        SELECT COALESCE(lead_assignment_opt_out, false) INTO v_rule_user_opted_out
        FROM profiles WHERE id = v_rule.assigned_user_id;

        IF v_rule_user_opted_out THEN
          CONTINUE;
        END IF;

        IF NOT EXISTS (
          SELECT 1 FROM leave_requests lr
          WHERE lr.user_id = v_rule.assigned_user_id
            AND lr.status = 'approved'
            AND CURRENT_DATE BETWEEN lr.start_date AND lr.end_date
        ) THEN
          NEW.assigned_to := v_rule.assigned_user_id;
          RETURN NEW;
        END IF;
      END IF;
    END LOOP;
  END IF;

  SELECT COALESCE(
    (SELECT array_agg(r)
     FROM jsonb_array_elements_text(
       (SELECT (config->>'assignable_roles')::jsonb
        FROM integration_settings
        WHERE integration_type = 'lead_config'
        LIMIT 1)
     ) AS r),
    ARRAY['sales']
  ) INTO v_assignable_roles;

  SELECT array_agg(p.id ORDER BY p.id)
  INTO v_users
  FROM profiles p
  JOIN user_roles ur ON ur.user_id = p.id AND ur.role::text = ANY(v_assignable_roles)
  WHERE p.office_id = v_lucknow_office_id
    AND p.is_active = true
    AND p.lead_assignment_opt_out IS NOT TRUE
    -- HARDENING: must have 'sales' role; never assign to users whose only roles are cro/tst/cst
    AND EXISTS (SELECT 1 FROM user_roles ur2 WHERE ur2.user_id = p.id AND ur2.role = 'sales')
    AND NOT EXISTS (
      SELECT 1 FROM leave_requests lr
      WHERE lr.user_id = p.id
        AND lr.status = 'approved'
        AND CURRENT_DATE BETWEEN lr.start_date AND lr.end_date
    );

  v_user_count := COALESCE(array_length(v_users, 1), 0);

  IF v_user_count = 0 THEN
    RETURN NEW;
  END IF;

  SELECT last_assigned_user_id INTO v_last_assigned_id
  FROM round_robin_tracker
  WHERE office_id = v_lucknow_office_id;

  IF v_last_assigned_id IS NOT NULL THEN
    FOR i IN 1..v_user_count LOOP
      IF v_users[i] = v_last_assigned_id THEN
        v_index := i;
        EXIT;
      END IF;
    END LOOP;
  END IF;

  v_index := (v_index % v_user_count) + 1;
  v_next_user_id := v_users[v_index];

  NEW.assigned_to := v_next_user_id;

  UPDATE round_robin_tracker
  SET last_assigned_user_id = v_next_user_id, updated_at = now()
  WHERE office_id = v_lucknow_office_id;

  RETURN NEW;
END;
$function$;