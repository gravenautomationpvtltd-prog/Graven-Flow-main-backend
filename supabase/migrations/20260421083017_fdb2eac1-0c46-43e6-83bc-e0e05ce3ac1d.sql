-- 1) Repair the routing trigger: 'lqt' is NOT a valid app_role enum value.
-- The Lead Qualification Team role is actually 'cro' in this system.
CREATE OR REPLACE FUNCTION public.auto_assign_lead_on_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _loyal_sales uuid;
  _lqt_user uuid;
  _creator uuid := auth.uid();
  _creator_is_lqt boolean := false;
BEGIN
  -- Loyalty hint (unchanged)
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

  -- If creator has the LQT role (represented as 'cro' in app_role enum),
  -- the lead lands in their own LQT inbox.
  IF _creator IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = _creator
        AND ur.role = 'cro'::public.app_role
    ) INTO _creator_is_lqt;
  END IF;

  IF NEW.assigned_to IS NULL THEN
    IF _creator_is_lqt THEN
      NEW.assigned_to := _creator;
    ELSE
      _lqt_user := public.pick_next_lqt_user(NEW.tenant_id);
      IF _lqt_user IS NOT NULL THEN
        NEW.assigned_to := _lqt_user;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- 2) Self-test: dual-role (sales + cro/LQT) user → lead must route to creator.
DO $$
DECLARE
  v_creator uuid;
  v_tenant uuid;
  v_lead_id uuid := gen_random_uuid();
  v_assigned uuid;
BEGIN
  SELECT ur1.user_id, tu.tenant_id
    INTO v_creator, v_tenant
  FROM public.user_roles ur1
  JOIN public.user_roles ur2
    ON ur2.user_id = ur1.user_id AND ur2.role = 'cro'::public.app_role
  JOIN public.tenant_users tu
    ON tu.user_id = ur1.user_id AND tu.is_active = true
  WHERE ur1.role = 'sales'::public.app_role
  LIMIT 1;

  IF v_creator IS NULL THEN
    RAISE NOTICE 'ASSERT SKIPPED: no dual-role (sales + cro/LQT) user found.';
    RETURN;
  END IF;

  BEGIN
    PERFORM set_config('request.jwt.claim.sub', v_creator::text, true);

    INSERT INTO public.leads (
      id, tenant_id, title, source, status
    ) VALUES (
      v_lead_id, v_tenant, '__assert_dual_role_lqt__',
      'manual'::public.lead_source, 'new'::public.lead_status
    );

    SELECT assigned_to INTO v_assigned FROM public.leads WHERE id = v_lead_id;

    IF v_assigned IS DISTINCT FROM v_creator THEN
      DELETE FROM public.leads WHERE id = v_lead_id;
      RAISE EXCEPTION
        'ASSERT FAILED: dual-role LQT user % created lead but assigned_to=% (expected %).',
        v_creator, v_assigned, v_creator;
    END IF;

    RAISE NOTICE 'ASSERT PASSED: dual-role user % → lead routed to themselves.', v_creator;
    DELETE FROM public.leads WHERE id = v_lead_id;
  EXCEPTION WHEN OTHERS THEN
    DELETE FROM public.leads WHERE id = v_lead_id;
    RAISE;
  END;
END $$;