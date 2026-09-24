
-- 1. Add suggested_assignee_id column
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS suggested_assignee_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_leads_suggested_assignee_id ON public.leads(suggested_assignee_id);

-- 2. Helper: pick next LQT (cro) user round-robin scoped to tenant
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
    AND p.deleted_at IS NULL
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

-- 3. Rewrite auto-assign trigger: LQT first; loyalty stored as hint only.
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
        AND p.deleted_at IS NULL
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
  -- If no LQT user exists, leave assigned_to as-is (caller value or NULL).

  RETURN NEW;
END;
$$;

-- 4. Backfill last 24h orphans
DO $$
DECLARE
  r record;
  v_lqt uuid;
  v_loyal uuid;
BEGIN
  FOR r IN
    SELECT l.id, l.tenant_id, l.customer_id
    FROM public.leads l
    WHERE l.created_at >= now() - interval '24 hours'
      AND l.deleted_at IS NULL
      AND NOT EXISTS (SELECT 1 FROM public.lead_qualification q WHERE q.lead_id = l.id)
      AND NOT EXISTS (SELECT 1 FROM public.activities a WHERE a.lead_id = l.id)
      AND NOT EXISTS (SELECT 1 FROM public.quotations qq WHERE qq.lead_id = l.id AND qq.deleted_at IS NULL)
      AND (
        l.assigned_to IS NULL
        OR NOT EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = l.assigned_to AND ur.role = 'cro')
      )
  LOOP
    v_lqt := public.pick_next_lqt_user(r.tenant_id);
    IF v_lqt IS NULL THEN CONTINUE; END IF;

    IF r.customer_id IS NOT NULL THEN
      SELECT assigned_sales_id INTO v_loyal FROM public.customers WHERE id = r.customer_id;
    ELSE
      v_loyal := NULL;
    END IF;

    UPDATE public.leads
    SET assigned_to = v_lqt,
        suggested_assignee_id = COALESCE(suggested_assignee_id, v_loyal)
    WHERE id = r.id;
  END LOOP;
END $$;
