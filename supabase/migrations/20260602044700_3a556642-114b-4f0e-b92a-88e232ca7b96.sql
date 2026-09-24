-- 1) Harden create_customer_safe: same-tenant phone/GST collisions return existing row
CREATE OR REPLACE FUNCTION public.create_customer_safe(
  p_company_name text,
  p_phone text,
  p_contact_person text DEFAULT NULL,
  p_email text DEFAULT NULL,
  p_address text DEFAULT NULL,
  p_city text DEFAULT NULL,
  p_state text DEFAULT NULL,
  p_pincode text DEFAULT NULL,
  p_gst_number text DEFAULT NULL,
  p_is_b2b boolean DEFAULT true,
  p_assigned_sales_id uuid DEFAULT NULL,
  p_office_id uuid DEFAULT NULL,
  p_industry_tag text DEFAULT NULL,
  p_notes text DEFAULT NULL
)
RETURNS public.customers
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_tenant_id uuid;
  v_assigned uuid := p_assigned_sales_id;
  v_row public.customers;
  v_phone_norm text;
  v_existing public.customers;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED' USING ERRCODE = '28000';
  END IF;

  SELECT tenant_id INTO v_tenant_id
  FROM public.tenant_users
  WHERE user_id = v_uid AND is_active = true
  LIMIT 1;

  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'NO_ORGANIZATION' USING ERRCODE = '42501';
  END IF;

  IF v_assigned IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.tenant_users
      WHERE user_id = v_assigned AND tenant_id = v_tenant_id AND is_active = true
    ) THEN
      v_assigned := NULL;
    END IF;
  END IF;

  -- Pre-check: same-tenant duplicate by last-10-digit phone => return existing row
  v_phone_norm := RIGHT(REGEXP_REPLACE(COALESCE(p_phone,''), '\D', '', 'g'), 10);
  IF length(v_phone_norm) = 10 THEN
    SELECT * INTO v_existing
    FROM public.customers
    WHERE tenant_id = v_tenant_id
      AND RIGHT(REGEXP_REPLACE(COALESCE(phone,''), '\D', '', 'g'), 10) = v_phone_norm
    ORDER BY created_at ASC
    LIMIT 1;
    IF v_existing.id IS NOT NULL THEN
      RETURN v_existing;
    END IF;
  END IF;

  -- Same-tenant duplicate by GST => return existing row
  IF p_gst_number IS NOT NULL AND length(trim(p_gst_number)) > 0 THEN
    SELECT * INTO v_existing
    FROM public.customers
    WHERE tenant_id = v_tenant_id
      AND upper(trim(gst_number)) = upper(trim(p_gst_number))
    ORDER BY created_at ASC
    LIMIT 1;
    IF v_existing.id IS NOT NULL THEN
      RETURN v_existing;
    END IF;
  END IF;

  BEGIN
    INSERT INTO public.customers (
      company_name, phone, contact_person, email, address, city, state, pincode,
      gst_number, is_b2b, assigned_sales_id, office_id, industry_tag, notes, tenant_id
    ) VALUES (
      p_company_name, p_phone, p_contact_person, p_email, p_address, p_city, p_state, p_pincode,
      p_gst_number, COALESCE(p_is_b2b, true), v_assigned, p_office_id, p_industry_tag, p_notes, v_tenant_id
    )
    RETURNING * INTO v_row;
  EXCEPTION WHEN unique_violation THEN
    -- Try once more to recover the same-tenant existing row before surfacing a cross-tenant error
    IF length(v_phone_norm) = 10 THEN
      SELECT * INTO v_existing
      FROM public.customers
      WHERE tenant_id = v_tenant_id
        AND RIGHT(REGEXP_REPLACE(COALESCE(phone,''), '\D', '', 'g'), 10) = v_phone_norm
      ORDER BY created_at ASC
      LIMIT 1;
      IF v_existing.id IS NOT NULL THEN
        RETURN v_existing;
      END IF;
    END IF;
    RAISE EXCEPTION 'DUPLICATE_PHONE_OTHER_TENANT: A customer with this phone or GST already exists in another organization.'
      USING ERRCODE = '23505';
  END;

  RETURN v_row;
END;
$function$;

-- 2) auto_assign_lead_on_insert: manual + LQT/CRO creator wins over loyalty
CREATE OR REPLACE FUNCTION public.auto_assign_lead_on_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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

  -- Determine creator roles up front
  IF _creator IS NOT NULL THEN
    SELECT
      EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = _creator AND ur.role = 'cro'::public.app_role),
      EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = _creator AND ur.role = 'sales'::public.app_role)
    INTO _creator_is_lqt, _creator_is_sales;
  END IF;

  -- NEW Pass 0: manual lead created by an LQT/CRO user stays with the creator.
  -- This overrides customer loyalty so LQT-typed leads do not get yanked to
  -- another salesperson by virtue of an existing customer owner.
  IF _creator_is_lqt AND NEW.source = 'manual'::public.lead_source THEN
    NEW.assigned_to := _creator;
    RETURN NEW;
  END IF;

  -- Pass 1: customer loyalty ALWAYS wins (for inbound / non-LQT-manual paths).
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

  -- Pass 2: SPT self-create
  IF _creator_is_sales THEN
    NEW.assigned_to := _creator;
    RETURN NEW;
  END IF;

  -- Pass 3: LQT/CRO self-create (non-manual fallback)
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
$function$;