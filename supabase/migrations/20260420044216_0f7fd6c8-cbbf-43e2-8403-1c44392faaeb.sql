-- Fix: remove references to non-existent profiles.deleted_at column
-- which were breaking ALL lead inserts via the auto-assign trigger.

DROP FUNCTION IF EXISTS public.pick_next_lqt_user(uuid);

CREATE OR REPLACE FUNCTION public.pick_next_lqt_user(p_tenant_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_users uuid[];
  v_count int;
  v_last uuid;
  v_idx int := 0;
BEGIN
  SELECT array_agg(p.id ORDER BY p.id)
  INTO v_users
  FROM public.profiles p
  JOIN public.user_roles ur ON ur.user_id = p.id AND ur.role = 'cro'
  JOIN public.tenant_users tu ON tu.user_id = p.id AND tu.is_active = true
  WHERE (p_tenant_id IS NULL OR tu.tenant_id = p_tenant_id)
    AND p.is_active = true
    AND COALESCE(p.lead_assignment_opt_out, false) = false;

  v_count := COALESCE(array_length(v_users, 1), 0);
  IF v_count = 0 THEN RETURN NULL; END IF;

  SELECT l.assigned_to INTO v_last
  FROM public.leads l
  WHERE (p_tenant_id IS NULL OR l.tenant_id = p_tenant_id)
    AND l.assigned_to = ANY(v_users)
  ORDER BY l.created_at DESC
  LIMIT 1;

  IF v_last IS NOT NULL THEN
    FOR i IN 1..v_count LOOP
      IF v_users[i] = v_last THEN v_idx := i; EXIT; END IF;
    END LOOP;
  END IF;

  RETURN v_users[(v_idx % v_count) + 1];
END;
$$;

CREATE OR REPLACE FUNCTION public.auto_assign_lead_on_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _loyal_sales uuid;
  _lqt_user uuid;
BEGIN
  IF NEW.customer_id IS NOT NULL AND NEW.suggested_assignee_id IS NULL THEN
    SELECT assigned_sales_id INTO _loyal_sales
    FROM public.customers
    WHERE id = NEW.customer_id;

    IF _loyal_sales IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = _loyal_sales
        AND COALESCE(p.is_active, true) = true
        AND COALESCE(p.lead_assignment_opt_out, false) = false
    ) THEN
      NEW.suggested_assignee_id := _loyal_sales;
    END IF;
  END IF;

  -- Every new lead lands in LQT regardless of source.
  _lqt_user := public.pick_next_lqt_user(NEW.tenant_id);
  IF _lqt_user IS NOT NULL THEN
    NEW.assigned_to := _lqt_user;
  END IF;

  RETURN NEW;
END;
$$;