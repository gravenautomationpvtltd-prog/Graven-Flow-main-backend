-- 1) Repair create_lead_secure: safe enum defaults + invalid-value guards
CREATE OR REPLACE FUNCTION public.create_lead_secure(payload jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_tenant_id uuid;
  v_lead_id uuid;
  v_payload jsonb := COALESCE(payload, '{}'::jsonb);
  v_source_text text;
  v_source public.lead_source;
  v_status_text text;
  v_status public.lead_status;
  v_enq_text text;
  v_enq public.enquiry_status;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED';
  END IF;

  v_tenant_id := NULLIF(v_payload->>'tenant_id', '')::uuid;
  IF v_tenant_id IS NULL THEN
    SELECT tu.tenant_id INTO v_tenant_id
    FROM public.tenant_users tu
    WHERE tu.user_id = v_user_id AND tu.is_active = true
    LIMIT 1;
  END IF;

  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'NO_ORGANIZATION';
  END IF;

  v_lead_id := COALESCE(NULLIF(v_payload->>'id','')::uuid, gen_random_uuid());

  -- Safe source cast
  v_source_text := lower(NULLIF(v_payload->>'source',''));
  BEGIN
    IF v_source_text IS NULL THEN
      v_source := 'manual'::public.lead_source;
    ELSE
      v_source := v_source_text::public.lead_source;
    END IF;
  EXCEPTION WHEN invalid_text_representation OR others THEN
    v_source := 'manual'::public.lead_source;
  END;

  -- Safe status cast
  v_status_text := lower(NULLIF(v_payload->>'status',''));
  BEGIN
    IF v_status_text IS NULL THEN
      v_status := 'new'::public.lead_status;
    ELSE
      v_status := v_status_text::public.lead_status;
    END IF;
  EXCEPTION WHEN invalid_text_representation OR others THEN
    v_status := 'new'::public.lead_status;
  END;

  -- Safe enquiry_status cast (nullable)
  v_enq_text := lower(NULLIF(v_payload->>'enquiry_status',''));
  BEGIN
    IF v_enq_text IS NULL THEN
      v_enq := NULL;
    ELSE
      v_enq := v_enq_text::public.enquiry_status;
    END IF;
  EXCEPTION WHEN invalid_text_representation OR others THEN
    v_enq := NULL;
  END;

  INSERT INTO public.leads (
    id,
    tenant_id,
    title,
    customer_id,
    customer_query,
    source,
    source_reference,
    status,
    enquiry_status,
    has_enquiry,
    assigned_to,
    office_id,
    estimated_value,
    expected_close_date,
    suggested_assignee_id
  )
  VALUES (
    v_lead_id,
    v_tenant_id,
    COALESCE(NULLIF(v_payload->>'title',''), 'Untitled Lead'),
    NULLIF(v_payload->>'customer_id','')::uuid,
    NULLIF(v_payload->>'customer_query',''),
    v_source,
    NULLIF(v_payload->>'source_reference',''),
    v_status,
    v_enq,
    COALESCE((v_payload->>'has_enquiry')::boolean, false),
    NULLIF(v_payload->>'assigned_to','')::uuid,
    NULLIF(v_payload->>'office_id','')::uuid,
    NULLIF(v_payload->>'estimated_value','')::numeric,
    NULLIF(v_payload->>'expected_close_date','')::date,
    NULLIF(v_payload->>'suggested_assignee_id','')::uuid
  );

  RETURN v_lead_id;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.create_lead_secure(jsonb) TO authenticated;

-- 2) Update auto_assign_lead_on_insert to honour creator-is-LQT rule
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
  -- Loyalty hint
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

  -- If creator has the lqt role, the lead lands in their own LQT inbox
  IF _creator IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = _creator
        AND ur.role = 'lqt'::app_role
    ) INTO _creator_is_lqt;
  END IF;

  IF _creator_is_lqt THEN
    NEW.assigned_to := _creator;
  ELSE
    -- Default: round-robin within LQT
    _lqt_user := public.pick_next_lqt_user(NEW.tenant_id);
    IF _lqt_user IS NOT NULL THEN
      NEW.assigned_to := _lqt_user;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;