-- 1. Routing rules table
CREATE TABLE public.lead_routing_splits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  rule_name text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  applies_to text NOT NULL DEFAULT 'new_customers' CHECK (applies_to IN ('new_customers','all')),
  source_filter text[] DEFAULT NULL, -- optional lead_source values; NULL = any
  splits jsonb NOT NULL,             -- [{"office_id":"...","percentage":25}, ...]  must sum to 100
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lead_routing_splits TO authenticated;
GRANT ALL ON public.lead_routing_splits TO service_role;
ALTER TABLE public.lead_routing_splits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view routing rules" ON public.lead_routing_splits
FOR SELECT USING (is_my_tenant(tenant_id) AND is_admin_or_above(auth.uid()));
CREATE POLICY "Admins can insert routing rules" ON public.lead_routing_splits
FOR INSERT WITH CHECK (is_my_tenant(tenant_id) AND is_admin_or_above(auth.uid()));
CREATE POLICY "Admins can update routing rules" ON public.lead_routing_splits
FOR UPDATE USING (is_my_tenant(tenant_id) AND is_admin_or_above(auth.uid()))
WITH CHECK (is_my_tenant(tenant_id) AND is_admin_or_above(auth.uid()));
CREATE POLICY "Admins can delete routing rules" ON public.lead_routing_splits
FOR DELETE USING (is_my_tenant(tenant_id) AND is_admin_or_above(auth.uid()));

CREATE TRIGGER trg_lead_routing_splits_updated_at
BEFORE UPDATE ON public.lead_routing_splits
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Per-office counter table
CREATE TABLE public.lead_routing_counters (
  rule_id uuid NOT NULL REFERENCES public.lead_routing_splits(id) ON DELETE CASCADE,
  office_id uuid NOT NULL,
  assigned_count bigint NOT NULL DEFAULT 0,
  PRIMARY KEY (rule_id, office_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lead_routing_counters TO authenticated;
GRANT ALL ON public.lead_routing_counters TO service_role;
ALTER TABLE public.lead_routing_counters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can read counters" ON public.lead_routing_counters
FOR SELECT USING (EXISTS (SELECT 1 FROM public.lead_routing_splits r WHERE r.id = rule_id AND is_my_tenant(r.tenant_id) AND is_admin_or_above(auth.uid())));

-- 3. Pick next CRO within a given office
CREATE OR REPLACE FUNCTION public.pick_next_lqt_user_in_office(p_tenant_id uuid, p_office_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_pick uuid;
BEGIN
  IF p_office_id IS NULL THEN
    RETURN public.pick_next_lqt_user(p_tenant_id, NULL);
  END IF;

  SELECT user_id INTO v_pick FROM (
    SELECT p.id AS user_id,
      COUNT(l.id) FILTER (
        WHERE l.assigned_to = p.id AND l.deleted_at IS NULL
          AND l.created_at >= date_trunc('day', now() AT TIME ZONE 'Asia/Kolkata') AT TIME ZONE 'Asia/Kolkata'
      ) AS assigned_today,
      MAX(l.created_at) FILTER (WHERE l.assigned_to = p.id) AS last_assigned_at
    FROM public.profiles p
    JOIN public.user_roles ur ON ur.user_id = p.id AND ur.role = 'cro'::public.app_role
    JOIN public.tenant_users tu ON tu.user_id = p.id AND tu.is_active = true AND tu.tenant_id = p_tenant_id
    LEFT JOIN public.leads l ON l.assigned_to = p.id AND l.tenant_id = p_tenant_id
    WHERE p.office_id = p_office_id
      AND COALESCE(p.is_active, true) = true
      AND COALESCE(p.lead_assignment_opt_out, false) = false
      AND COALESCE(p.round_robin_paused, false) = false
      AND COALESCE(p.employment_status, 'active') = 'active'
      AND p.exit_date IS NULL
    GROUP BY p.id
  ) backlog
  ORDER BY assigned_today ASC, last_assigned_at ASC NULLS FIRST, user_id ASC
  LIMIT 1;

  -- Fallback to normal picker if no CRO in that office
  IF v_pick IS NULL THEN
    RETURN public.pick_next_lqt_user(p_tenant_id, NULL);
  END IF;
  RETURN v_pick;
END;
$$;

-- 4. Route by rule: returns office_id (or NULL if no active rule / no valid split)
CREATE OR REPLACE FUNCTION public.route_new_lead_to_office(p_tenant_id uuid, p_source text)
RETURNS TABLE(rule_id uuid, office_id uuid)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r RECORD;
  split RECORD;
  v_totals bigint;
  v_best_office uuid;
  v_best_deficit numeric := -1e18;
  v_deficit numeric;
  v_target_pct numeric;
  v_current bigint;
BEGIN
  SELECT * INTO r FROM public.lead_routing_splits
   WHERE tenant_id = p_tenant_id AND is_active = true
     AND (source_filter IS NULL OR p_source = ANY(source_filter))
   ORDER BY updated_at DESC LIMIT 1;
  IF NOT FOUND THEN RETURN; END IF;

  -- Total assigned for this rule
  SELECT COALESCE(SUM(assigned_count),0) INTO v_totals
  FROM public.lead_routing_counters WHERE lead_routing_counters.rule_id = r.id;

  -- Pick office with largest deficit (target% - actual%)
  FOR split IN
    SELECT (e->>'office_id')::uuid AS office_id, (e->>'percentage')::numeric AS pct
    FROM jsonb_array_elements(r.splits) e
  LOOP
    SELECT COALESCE(assigned_count,0) INTO v_current
    FROM public.lead_routing_counters
    WHERE lead_routing_counters.rule_id = r.id AND lead_routing_counters.office_id = split.office_id;
    v_current := COALESCE(v_current, 0);
    v_target_pct := split.pct;
    v_deficit := v_target_pct - CASE WHEN v_totals = 0 THEN 0 ELSE (v_current::numeric * 100.0 / v_totals) END;
    IF v_deficit > v_best_deficit THEN
      v_best_deficit := v_deficit;
      v_best_office := split.office_id;
    END IF;
  END LOOP;

  rule_id := r.id;
  office_id := v_best_office;
  RETURN NEXT;
END;
$$;

-- 5. Extend auto_assign_lead_on_insert to consult the routing rule for NEW customers
CREATE OR REPLACE FUNCTION public.auto_assign_lead_on_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _creator uuid := auth.uid();
  _creator_is_lqt boolean := false;
  _creator_is_sales boolean := false;
  _loyal_sales uuid;
  _loyal_active boolean := false;
  _lqt_user uuid;
  _route RECORD;
  _is_existing_customer boolean := false;
BEGIN
  IF NEW.customer_id IS NOT NULL AND NEW.suggested_assignee_id IS NULL THEN
    SELECT assigned_sales_id INTO _loyal_sales FROM public.customers WHERE id = NEW.customer_id;
    IF _loyal_sales IS NOT NULL THEN
      NEW.suggested_assignee_id := _loyal_sales;
    END IF;
    -- Existing = customer already has any prior leads
    SELECT EXISTS(SELECT 1 FROM public.leads l WHERE l.customer_id = NEW.customer_id AND l.deleted_at IS NULL)
      INTO _is_existing_customer;
  ELSIF NEW.suggested_assignee_id IS NOT NULL THEN
    _loyal_sales := NEW.suggested_assignee_id;
  END IF;

  IF NEW.assigned_to IS NOT NULL THEN
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

  -- NEW-customer branch routing rule
  IF NOT _is_existing_customer THEN
    SELECT * INTO _route FROM public.route_new_lead_to_office(NEW.tenant_id, NEW.source::text);
    IF _route.office_id IS NOT NULL THEN
      _lqt_user := public.pick_next_lqt_user_in_office(NEW.tenant_id, _route.office_id);
      IF _lqt_user IS NOT NULL THEN
        NEW.assigned_to := _lqt_user;
        NEW.office_id := COALESCE(NEW.office_id, _route.office_id);
        PERFORM set_config('app.lead_assign_reason', 'branch_percentage_split', true);
        INSERT INTO public.lead_routing_counters(rule_id, office_id, assigned_count)
        VALUES (_route.rule_id, _route.office_id, 1)
        ON CONFLICT (rule_id, office_id)
        DO UPDATE SET assigned_count = lead_routing_counters.assigned_count + 1;
        RETURN NEW;
      END IF;
    END IF;
  END IF;

  _lqt_user := public.pick_next_lqt_user(NEW.tenant_id);
  IF _lqt_user IS NOT NULL THEN
    NEW.assigned_to := _lqt_user;
    PERFORM set_config('app.lead_assign_reason', 'lqt_round_robin', true);
  END IF;

  RETURN NEW;
END;
$$;