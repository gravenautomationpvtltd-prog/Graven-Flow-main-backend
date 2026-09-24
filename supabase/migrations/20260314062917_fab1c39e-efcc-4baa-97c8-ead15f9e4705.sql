
CREATE OR REPLACE FUNCTION public.bootstrap_tenant_onboarding(
  p_company_name text,
  p_logo_url text DEFAULT NULL,
  p_address text DEFAULT '',
  p_city text DEFAULT '',
  p_state text DEFAULT '',
  p_country text DEFAULT 'India',
  p_phone text DEFAULT '',
  p_email text DEFAULT '',
  p_website text DEFAULT '',
  p_gst_number text DEFAULT NULL,
  p_industry text DEFAULT NULL,
  p_admin_phone text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id uuid;
  v_tenant_id uuid;
  v_trial_end timestamptz;
BEGIN
  -- 1. Verify caller is authenticated
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- 2. Prevent duplicate: check if user already has an active tenant
  IF EXISTS (
    SELECT 1 FROM public.tenant_users
    WHERE user_id = v_user_id AND is_active = true
  ) THEN
    RAISE EXCEPTION 'You already belong to an organization';
  END IF;

  -- 3. Calculate trial end
  v_trial_end := now() + interval '30 days';

  -- 4. Insert tenant
  INSERT INTO public.tenants (
    company_name, logo_url, address, city, state, country,
    phone, email, website, gst_number, industry,
    subscription_status, trial_start_date, trial_end_date
  ) VALUES (
    p_company_name, p_logo_url, p_address, p_city, p_state, p_country,
    p_phone, p_email, p_website, p_gst_number, p_industry,
    'trial', now(), v_trial_end
  )
  RETURNING id INTO v_tenant_id;

  -- 5. Add caller as tenant owner
  INSERT INTO public.tenant_users (tenant_id, user_id, role)
  VALUES (v_tenant_id, v_user_id, 'owner');

  -- 6. Assign super_admin role (idempotent)
  INSERT INTO public.user_roles (user_id, role)
  VALUES (v_user_id, 'super_admin')
  ON CONFLICT (user_id, role) DO NOTHING;

  -- 7. Update profile with tenant_id and optional phone
  UPDATE public.profiles
  SET tenant_id = v_tenant_id,
      phone = COALESCE(NULLIF(p_admin_phone, ''), phone)
  WHERE id = v_user_id;

  RETURN v_tenant_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.bootstrap_tenant_onboarding TO authenticated;
