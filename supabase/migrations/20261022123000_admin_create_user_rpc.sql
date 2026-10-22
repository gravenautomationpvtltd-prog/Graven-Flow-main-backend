-- Migration: Secure, hardened admin_create_user RPC for User Management
CREATE OR REPLACE FUNCTION public.admin_create_user(
  p_email text,
  p_password text,
  p_full_name text,
  p_role text,
  p_office_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $func$
DECLARE
  v_caller_id uuid;
  v_is_admin boolean := false;
  v_tenant_id uuid;
  v_new_user_id uuid;
  v_existing_user_id uuid;
  v_existing_membership_id uuid;
  v_clean_email text;
  v_valid_role public.app_role;
BEGIN
  -- 1. Input sanitization and validation
  v_clean_email := lower(trim(coalesce(p_email, '')));
  IF v_clean_email = '' OR position('@' in v_clean_email) = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'A valid email address is required');
  END IF;

  IF p_password IS NULL OR length(p_password) < 6 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Password must be at least 6 characters');
  END IF;

  IF p_full_name IS NULL OR trim(p_full_name) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Full name is required');
  END IF;

  -- Map role input to app_role enum securely
  BEGIN
    v_valid_role := lower(trim(p_role))::public.app_role;
  EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid role specified');
  END;

  -- 2. Caller Authentication & Authorization
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Authentication required');
  END IF;

  -- Verify caller has super_admin or coo role
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = v_caller_id AND role IN ('super_admin', 'coo')
  ) INTO v_is_admin;

  IF NOT v_is_admin THEN
    SELECT EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = v_caller_id AND role IN ('super_admin', 'coo')
    ) INTO v_is_admin;
  END IF;

  IF NOT v_is_admin THEN
    RETURN jsonb_build_object('success', false, 'error', 'Permission denied: Only super admins and COOs can create users');
  END IF;

  -- 3. Tenant Isolation: Resolve caller's active tenant
  SELECT tenant_id INTO v_tenant_id
  FROM public.tenant_users
  WHERE user_id = v_caller_id AND is_active = true
  LIMIT 1;

  IF v_tenant_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Organization tenant could not be determined for caller');
  END IF;

  -- 4. Office Validation: Ensure office belongs to valid registered offices if provided
  IF p_office_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.offices WHERE id = p_office_id) THEN
      RETURN jsonb_build_object('success', false, 'error', 'Specified office not found');
    END IF;
  END IF;

  -- 5. Duplicate-Email Handling
  SELECT id INTO v_existing_user_id
  FROM auth.users
  WHERE lower(email) = v_clean_email;

  IF v_existing_user_id IS NOT NULL THEN
    -- Check if user is already a member of this tenant
    SELECT id INTO v_existing_membership_id
    FROM public.tenant_users
    WHERE user_id = v_existing_user_id AND tenant_id = v_tenant_id
    LIMIT 1;

    IF v_existing_membership_id IS NOT NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'A user with this email already exists in your organization');
    ELSE
      RETURN jsonb_build_object('success', false, 'error', 'A user with this email is already registered in the system');
    END IF;
  END IF;

  -- 6. Atomic User Creation
  v_new_user_id := gen_random_uuid();

  -- Insert into auth.users (bcrypt salt 10, confirmed, no default token bypass)
  INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    confirmation_token,
    recovery_token,
    email_change_token_new,
    email_change,
    phone_change,
    phone_change_token,
    email_change_token_current,
    email_change_confirm_status,
    is_sso_user,
    is_anonymous,
    created_at,
    updated_at
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    v_new_user_id,
    'authenticated',
    'authenticated',
    v_clean_email,
    extensions.crypt(p_password, extensions.gen_salt('bf', 10)),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('full_name', p_full_name, 'email_verified', true),
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    0,
    false,
    false,
    now(),
    now()
  );

  -- Insert into auth.identities for GoTrue auth compatibility
  INSERT INTO auth.identities (
    id,
    user_id,
    identity_data,
    provider,
    provider_id,
    last_sign_in_at,
    created_at,
    updated_at
  ) VALUES (
    gen_random_uuid(),
    v_new_user_id,
    jsonb_build_object(
      'sub', v_new_user_id::text,
      'email', v_clean_email,
      'email_verified', true,
      'phone_verified', false
    ),
    'email',
    v_new_user_id::text,
    now(),
    now(),
    now()
  );

  -- Insert into public.profiles with tenant and office mapping
  INSERT INTO public.profiles (
    id,
    email,
    full_name,
    office_id,
    tenant_id,
    is_active,
    employment_status,
    created_at,
    updated_at
  ) VALUES (
    v_new_user_id,
    v_clean_email,
    p_full_name,
    p_office_id,
    v_tenant_id,
    true,
    'active',
    now(),
    now()
  );

  -- Assign role in public.user_roles
  INSERT INTO public.user_roles (user_id, role)
  VALUES (v_new_user_id, v_valid_role);

  -- Assign to public.tenant_users under caller's tenant
  INSERT INTO public.tenant_users (user_id, tenant_id, role, is_active)
  VALUES (v_new_user_id, v_tenant_id, 'member', true);

  RETURN jsonb_build_object(
    'success', true,
    'user', jsonb_build_object(
      'id', v_new_user_id,
      'email', v_clean_email,
      'fullName', p_full_name,
      'role', v_valid_role
    )
  );
END;
$func$;

-- 7. Strict Permission Model: REVOKE from public and anon, GRANT ONLY to authenticated & service_role
REVOKE ALL ON FUNCTION public.admin_create_user(text, text, text, text, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_create_user(text, text, text, text, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_create_user(text, text, text, text, uuid) TO authenticated, service_role;
