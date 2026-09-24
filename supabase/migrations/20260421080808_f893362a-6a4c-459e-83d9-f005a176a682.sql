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
    COALESCE(NULLIF(v_payload->>'source','')::lead_source, 'other'::lead_source),
    NULLIF(v_payload->>'source_reference',''),
    COALESCE(NULLIF(v_payload->>'status','')::lead_status, 'new'::lead_status),
    NULLIF(v_payload->>'enquiry_status','')::enquiry_status,
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