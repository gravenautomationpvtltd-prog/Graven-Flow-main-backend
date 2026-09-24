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