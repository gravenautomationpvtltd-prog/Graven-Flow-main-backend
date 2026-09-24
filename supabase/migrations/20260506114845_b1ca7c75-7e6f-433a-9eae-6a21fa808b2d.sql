CREATE OR REPLACE FUNCTION public.get_lead_detail(
  p_lead_id uuid,
  p_include_deleted boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _tenant uuid;
  _lead public.leads%ROWTYPE;
  _can_see boolean := false;
  _result jsonb;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;

  SELECT tenant_id INTO _tenant
  FROM public.tenant_users
  WHERE user_id = _uid AND is_active = true
  LIMIT 1;

  IF _tenant IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT * INTO _lead
  FROM public.leads
  WHERE id = p_lead_id
    AND tenant_id = _tenant
    AND (p_include_deleted OR deleted_at IS NULL)
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  -- Visibility check (mirrors the leads SELECT RLS policy, evaluated once)
  SELECT (
    public.is_admin_or_above(_uid)
    OR _lead.assigned_to = _uid
    OR (public.is_manager_or_above(_uid) AND _lead.assigned_to = ANY(public.get_subordinate_ids(_uid)))
    OR (_lead.customer_id IS NOT NULL AND _lead.customer_id = ANY(public.get_user_cro_customer_ids(_uid)))
    OR _lead.id = ANY(public.get_user_quotation_lead_ids(_uid))
    OR _lead.id = ANY(public.get_user_qualified_lead_ids(_uid))
  ) INTO _can_see;

  IF NOT _can_see THEN
    RETURN NULL;
  END IF;

  SELECT to_jsonb(l.*)
    || jsonb_build_object(
         'customer', (SELECT to_jsonb(c.*) FROM public.customers c WHERE c.id = l.customer_id),
         'assigned_user', (SELECT to_jsonb(p.*) FROM public.profiles p WHERE p.id = l.assigned_to)
       )
  INTO _result
  FROM public.leads l
  WHERE l.id = p_lead_id;

  RETURN _result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_lead_detail(uuid, boolean) TO authenticated;