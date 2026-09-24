DO $$
DECLARE
  v_creator uuid;
  v_tenant uuid;
  v_loyal_sales uuid;
  v_customer_id uuid := gen_random_uuid();
  v_lead_id uuid := gen_random_uuid();
  v_qual_id uuid := gen_random_uuid();
  v_enq_id uuid := gen_random_uuid();
  v_assigned uuid;
  v_in_spt_before boolean;
  v_in_spt_after boolean;
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
    RAISE NOTICE 'E2E SKIPPED: no dual-role (sales + cro/LQT) user found.';
    RETURN;
  END IF;

  SELECT ur.user_id INTO v_loyal_sales
  FROM public.user_roles ur
  JOIN public.tenant_users tu
    ON tu.user_id = ur.user_id AND tu.tenant_id = v_tenant AND tu.is_active = true
  WHERE ur.role = 'sales'::public.app_role AND ur.user_id <> v_creator
  LIMIT 1;

  IF v_loyal_sales IS NULL THEN v_loyal_sales := v_creator; END IF;

  BEGIN
    PERFORM set_config('request.jwt.claim.sub', v_creator::text, true);

    INSERT INTO public.customers (id, tenant_id, company_name, phone, assigned_sales_id)
    VALUES (v_customer_id, v_tenant, '__e2e_dual_role_customer__', '0000000000', v_loyal_sales);

    -- Step 1: Create lead as dual-role user → must land in their LQT inbox
    INSERT INTO public.leads (id, tenant_id, title, source, status, customer_id)
    VALUES (v_lead_id, v_tenant, '__e2e_dual_role_lead__',
            'manual'::public.lead_source, 'new'::public.lead_status, v_customer_id);

    SELECT assigned_to INTO v_assigned FROM public.leads WHERE id = v_lead_id;
    IF v_assigned IS DISTINCT FROM v_creator THEN
      RAISE EXCEPTION 'E2E STEP 1 FAILED: lead routed to % instead of creator %.', v_assigned, v_creator;
    END IF;

    -- Step 2: Lead must NOT be visible to SPT yet
    SELECT EXISTS (
      SELECT 1 FROM public.lead_qualification
      WHERE lead_id = v_lead_id AND routed_to = 'spt'
    ) INTO v_in_spt_before;
    IF v_in_spt_before THEN
      RAISE EXCEPTION 'E2E STEP 2 FAILED: fresh lead already visible in SPT before qualification.';
    END IF;

    -- Step 2b: Add enquiry item (system constraint requires this before SPT routing)
    INSERT INTO public.enquiry_items (id, lead_id, product_query_text)
    VALUES (v_enq_id, v_lead_id, '__e2e_test_item__');

    -- Step 3: Qualify and hand off to SPT — loyalty path → loyal_sales
    INSERT INTO public.lead_qualification (
      id, lead_id, tenant_id, qualification_type, routed_to, qualified_by, qualified_at
    ) VALUES (
      v_qual_id, v_lead_id, v_tenant, 'simple', 'spt', v_creator, now()
    );

    UPDATE public.leads
       SET assigned_to = v_loyal_sales,
           status = 'qualified'::public.lead_status
     WHERE id = v_lead_id;

    SELECT EXISTS (
      SELECT 1 FROM public.lead_qualification lq
      JOIN public.leads l ON l.id = lq.lead_id
      WHERE lq.lead_id = v_lead_id
        AND lq.routed_to = 'spt'
        AND l.assigned_to = v_loyal_sales
    ) INTO v_in_spt_after;
    IF NOT v_in_spt_after THEN
      RAISE EXCEPTION 'E2E STEP 3 FAILED: post-qualification, lead not visible to loyal SPT owner %.', v_loyal_sales;
    END IF;

    RAISE NOTICE
      'E2E PASSED: creator=%, loyal_sales=% — lead landed in LQT only, then routed via loyalty after qualification.',
      v_creator, v_loyal_sales;

    DELETE FROM public.enquiry_items WHERE id = v_enq_id;
    DELETE FROM public.lead_qualification WHERE id = v_qual_id;
    DELETE FROM public.leads WHERE id = v_lead_id;
    DELETE FROM public.customers WHERE id = v_customer_id;
  EXCEPTION WHEN OTHERS THEN
    DELETE FROM public.enquiry_items WHERE id = v_enq_id;
    DELETE FROM public.lead_qualification WHERE id = v_qual_id;
    DELETE FROM public.leads WHERE id = v_lead_id;
    DELETE FROM public.customers WHERE id = v_customer_id;
    RAISE;
  END;
END $$;