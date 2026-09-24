-- Make bootstrap_tenant_onboarding idempotent: return existing tenant_id instead of throwing
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
AS $function$
DECLARE
  v_user_id uuid;
  v_tenant_id uuid;
  v_trial_end timestamptz;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Idempotent: if user already has an active tenant, return it silently
  SELECT tu.tenant_id INTO v_tenant_id
  FROM public.tenant_users tu
  WHERE tu.user_id = v_user_id AND tu.is_active = true
  LIMIT 1;

  IF v_tenant_id IS NOT NULL THEN
    RETURN v_tenant_id;
  END IF;

  v_trial_end := now() + interval '30 days';

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

  INSERT INTO public.tenant_users (tenant_id, user_id, role)
  VALUES (v_tenant_id, v_user_id, 'owner');

  INSERT INTO public.user_roles (user_id, role)
  VALUES (v_user_id, 'super_admin')
  ON CONFLICT (user_id, role) DO NOTHING;

  UPDATE public.profiles
  SET tenant_id = v_tenant_id,
      phone = COALESCE(NULLIF(p_admin_phone, ''), phone)
  WHERE id = v_user_id;

  RETURN v_tenant_id;
END;
$function$;