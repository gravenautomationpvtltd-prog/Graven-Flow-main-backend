
-- 1. LQT round-robin tracker
CREATE TABLE IF NOT EXISTS public.lqt_round_robin_tracker (
  tenant_id uuid PRIMARY KEY REFERENCES public.tenants(id) ON DELETE CASCADE,
  last_assigned_lqt_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.lqt_round_robin_tracker ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant members can view lqt rr tracker" ON public.lqt_round_robin_tracker;
CREATE POLICY "Tenant members can view lqt rr tracker"
  ON public.lqt_round_robin_tracker FOR SELECT
  USING (tenant_id = public.get_user_tenant_id(auth.uid()));

DROP POLICY IF EXISTS "System can manage lqt rr tracker" ON public.lqt_round_robin_tracker;
CREATE POLICY "System can manage lqt rr tracker"
  ON public.lqt_round_robin_tracker FOR ALL
  USING (true) WITH CHECK (true);

-- 2. Helper: pick next LQT user (round-robin) for a tenant
CREATE OR REPLACE FUNCTION public.pick_next_lqt_user(_tenant_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _last_id uuid;
  _next_id uuid;
  _candidates uuid[];
  _idx int;
BEGIN
  -- collect active LQT (cro role) users in tenant who are not opted out and not deleted
  SELECT array_agg(p.id ORDER BY p.id)
    INTO _candidates
  FROM public.profiles p
  JOIN public.user_roles ur ON ur.user_id = p.id AND ur.role = 'cro'::app_role
  WHERE p.tenant_id = _tenant_id
    AND COALESCE(p.lead_assignment_opt_out, false) = false
    AND p.deleted_at IS NULL
    AND COALESCE(p.is_active, true) = true;

  IF _candidates IS NULL OR array_length(_candidates, 1) = 0 THEN
    RETURN NULL;
  END IF;

  SELECT last_assigned_lqt_id INTO _last_id
  FROM public.lqt_round_robin_tracker
  WHERE tenant_id = _tenant_id;

  IF _last_id IS NULL THEN
    _next_id := _candidates[1];
  ELSE
    _idx := array_position(_candidates, _last_id);
    IF _idx IS NULL OR _idx >= array_length(_candidates, 1) THEN
      _next_id := _candidates[1];
    ELSE
      _next_id := _candidates[_idx + 1];
    END IF;
  END IF;

  INSERT INTO public.lqt_round_robin_tracker (tenant_id, last_assigned_lqt_id, updated_at)
  VALUES (_tenant_id, _next_id, now())
  ON CONFLICT (tenant_id) DO UPDATE
    SET last_assigned_lqt_id = EXCLUDED.last_assigned_lqt_id,
        updated_at = now();

  RETURN _next_id;
END;
$$;

-- 3. Rewrite auto_assign_lead_on_insert: loyalty -> LQT round-robin -> SPT fallback
CREATE OR REPLACE FUNCTION public.auto_assign_lead_on_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _loyal_sales uuid;
  _lqt_user uuid;
  _spt_user uuid;
BEGIN
  -- Skip if already assigned (e.g., manual creation with assignee)
  IF NEW.assigned_to IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Step A: Customer loyalty short-circuit
  IF NEW.customer_id IS NOT NULL THEN
    SELECT assigned_sales_id INTO _loyal_sales
    FROM public.customers
    WHERE id = NEW.customer_id;

    IF _loyal_sales IS NOT NULL THEN
      -- ensure user is still active & not opted out
      IF EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = _loyal_sales
          AND p.deleted_at IS NULL
          AND COALESCE(p.is_active, true) = true
          AND COALESCE(p.lead_assignment_opt_out, false) = false
      ) THEN
        NEW.assigned_to := _loyal_sales;
        RETURN NEW;
      END IF;
    END IF;
  END IF;

  -- Step B: LQT round-robin
  _lqt_user := public.pick_next_lqt_user(NEW.tenant_id);
  IF _lqt_user IS NOT NULL THEN
    NEW.assigned_to := _lqt_user;
    RETURN NEW;
  END IF;

  -- Step C: SPT round-robin fallback (lead never unassigned)
  BEGIN
    _spt_user := public.pick_next_spt_user(NEW.tenant_id);
  EXCEPTION WHEN undefined_function THEN
    _spt_user := NULL;
  END;

  IF _spt_user IS NOT NULL THEN
    NEW.assigned_to := _spt_user;
  END IF;

  RETURN NEW;
END;
$$;

-- 4. Harden qualification reassignment: require enquiry items for SPT route
CREATE OR REPLACE FUNCTION public.trg_fn_reassign_on_qualification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _enq_count int;
BEGIN
  IF NEW.routed_to IN ('spt', 'tst') THEN
    IF NEW.routed_to = 'spt' THEN
      SELECT COUNT(*) INTO _enq_count
      FROM public.enquiry_items
      WHERE lead_id = NEW.lead_id;

      IF _enq_count = 0 THEN
        RAISE EXCEPTION 'Cannot route lead to SPT without at least one enquiry item. Please add the enquiry first.'
          USING ERRCODE = 'check_violation';
      END IF;
    END IF;

    PERFORM public.assign_lead_to_spt(NEW.lead_id);
  END IF;

  RETURN NEW;
END;
$$;
