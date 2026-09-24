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
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_tenant_id uuid;
  v_assigned uuid := p_assigned_sales_id;
  v_row public.customers;
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

  -- Clear assigned_sales_id if it doesn't belong to the same tenant
  IF v_assigned IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.tenant_users
      WHERE user_id = v_assigned AND tenant_id = v_tenant_id AND is_active = true
    ) THEN
      v_assigned := NULL;
    END IF;
  END IF;

  INSERT INTO public.customers (
    company_name, phone, contact_person, email, address, city, state, pincode,
    gst_number, is_b2b, assigned_sales_id, office_id, industry_tag, notes, tenant_id
  ) VALUES (
    p_company_name, p_phone, p_contact_person, p_email, p_address, p_city, p_state, p_pincode,
    p_gst_number, COALESCE(p_is_b2b, true), v_assigned, p_office_id, p_industry_tag, p_notes, v_tenant_id
  )
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_customer_safe(
  text, text, text, text, text, text, text, text, text, boolean, uuid, uuid, text, text
) TO authenticated;