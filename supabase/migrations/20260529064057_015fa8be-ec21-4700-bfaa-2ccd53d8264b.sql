
-- A. auto_assign_lead_on_insert: external leads must also respect customer loyalty
CREATE OR REPLACE FUNCTION public.auto_assign_lead_on_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _creator uuid := auth.uid();
  _creator_is_lqt boolean := false;
  _creator_is_sales boolean := false;
  _loyal_sales uuid;
  _loyal_active boolean := false;
  _lqt_user uuid;
BEGIN
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

  -- If something already set assigned_to, respect it
  IF NEW.assigned_to IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Pass 1: customer loyalty ALWAYS wins (external + internal).
  -- Once a customer has an owner, every future lead routes there.
  IF _loyal_sales IS NOT NULL THEN
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

  -- Pass 2: SPT self-create
  IF _creator_is_sales THEN
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
$$;

-- B/C. assign_lead_to_spt: write picked sales rep back to customers.assigned_sales_id
-- when NULL (lock ownership), and stop writing to customer_assignment_history
-- (that table is now maintained only by track_customer_assignment_change).
CREATE OR REPLACE FUNCTION public.assign_lead_to_spt(p_lead_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

  -- 1) Customer loyalty wins
  IF v_customer_id IS NOT NULL THEN
    SELECT assigned_sales_id, state INTO v_loyal_sales_id, v_customer_state
    FROM public.customers WHERE id = v_customer_id;

    IF v_loyal_sales_id IS NOT NULL THEN
      IF v_current_assigned IS DISTINCT FROM v_loyal_sales_id THEN
        UPDATE public.leads SET assigned_to = v_loyal_sales_id WHERE id = p_lead_id;
      END IF;
      RETURN v_loyal_sales_id;
    END IF;
  END IF;

  -- 2) State-based assignment rules
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
        IF EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = v_rule.assigned_user_id AND role = 'sales') THEN
          UPDATE public.leads SET assigned_to = v_rule.assigned_user_id WHERE id = p_lead_id;
          -- Lock customer ownership if not already set
          IF v_customer_id IS NOT NULL THEN
            UPDATE public.customers
              SET assigned_sales_id = v_rule.assigned_user_id
              WHERE id = v_customer_id AND assigned_sales_id IS NULL;
          END IF;
          RETURN v_rule.assigned_user_id;
        END IF;
      END IF;
    END LOOP;
  END IF;

  -- 3) Round-robin restricted to 'sales' role
  SELECT id INTO v_lucknow_office_id FROM public.offices WHERE location = 'lucknow' LIMIT 1;
  IF v_lucknow_office_id IS NULL THEN RETURN NULL; END IF;

  -- 3a) Presence-filtered primary pool
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
    AND NOT EXISTS (
      SELECT 1 FROM public.user_roles ur2
      WHERE ur2.user_id = p.id AND ur2.role IN ('cro','tst','cst')
        AND NOT EXISTS (SELECT 1 FROM public.user_roles ur3 WHERE ur3.user_id = p.id AND ur3.role = 'sales')
    )
    AND EXISTS (
      SELECT 1 FROM public.attendance_records ar
      WHERE ar.user_id = p.id AND ar.date = CURRENT_DATE
        AND ar.check_in_time IS NOT NULL
        AND COALESCE(ar.status,'') NOT IN ('absent','on_leave')
    );

  v_user_count := COALESCE(array_length(v_users, 1), 0);

  -- 3b) Safe fallback
  IF v_user_count = 0 THEN
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
      AND NOT EXISTS (
        SELECT 1 FROM public.user_roles ur2
        WHERE ur2.user_id = p.id AND ur2.role IN ('cro','tst','cst')
          AND NOT EXISTS (SELECT 1 FROM public.user_roles ur3 WHERE ur3.user_id = p.id AND ur3.role = 'sales')
      );
    v_user_count := COALESCE(array_length(v_users, 1), 0);
    IF v_user_count = 0 THEN RETURN NULL; END IF;
  END IF;

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

  INSERT INTO public.round_robin_tracker (office_id, last_assigned_user_id, updated_at)
  VALUES (v_lucknow_office_id, v_next_user_id, now())
  ON CONFLICT (office_id) DO UPDATE
    SET last_assigned_user_id = EXCLUDED.last_assigned_user_id, updated_at = now();

  -- Lock customer ownership to first assignee
  IF v_customer_id IS NOT NULL THEN
    UPDATE public.customers
      SET assigned_sales_id = v_next_user_id
      WHERE id = v_customer_id AND assigned_sales_id IS NULL;
  END IF;

  RETURN v_next_user_id;
END;
$$;

-- D. One-shot cleanup.
-- D1: Backfill customers.assigned_sales_id from the EARLIEST history row
--     when current owner is NULL. Trigger will close history rows correctly.
DO $cleanup$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT DISTINCT ON (h.customer_id)
      h.customer_id, h.assigned_to
    FROM public.customer_assignment_history h
    JOIN public.customers c ON c.id = h.customer_id
    WHERE c.assigned_sales_id IS NULL
      AND h.assigned_to IS NOT NULL
    ORDER BY h.customer_id, h.assigned_from ASC
  LOOP
    UPDATE public.customers
      SET assigned_sales_id = r.assigned_to
      WHERE id = r.customer_id AND assigned_sales_id IS NULL;
  END LOOP;
END;
$cleanup$;

-- D2: Close every stale open history row except the single most-recent one
--     per customer (which will reflect the current owner after D1).
UPDATE public.customer_assignment_history h
SET assigned_until = now()
WHERE h.assigned_until IS NULL
  AND h.id NOT IN (
    SELECT DISTINCT ON (customer_id) id
    FROM public.customer_assignment_history
    WHERE assigned_until IS NULL
    ORDER BY customer_id, assigned_from DESC
  );
