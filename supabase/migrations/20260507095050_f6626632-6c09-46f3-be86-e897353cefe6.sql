CREATE OR REPLACE FUNCTION public.enforce_lqt_landing_zone()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  v_sweta_id uuid := 'e292c56d-c021-4f33-82de-32794d7a4b59';
  v_lqt_user_ids uuid[];
  v_external_sources text[] := ARRAY['indiamart','tradeindia','whatsapp','email','website','webhook'];
BEGIN
  NEW.has_enquiry := false;
  NEW.enquiry_status := NULL;

  -- Only route AUTOMATIC (webhook/service-role) inserts through LQT.
  -- Manual UI inserts (any source) keep the creator's chosen assignee.
  IF auth.uid() IS NOT NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.source::text = ANY(v_external_sources) THEN
    SELECT array_agg(user_id) INTO v_lqt_user_ids
    FROM user_roles WHERE role::text = 'cro';

    IF NEW.assigned_to IS NULL
       OR NOT (NEW.assigned_to = ANY(COALESCE(v_lqt_user_ids, ARRAY[]::uuid[])))
    THEN
      IF NEW.assigned_to IS NOT NULL AND NEW.suggested_assignee_id IS NULL THEN
        NEW.suggested_assignee_id := NEW.assigned_to;
      END IF;
      NEW.assigned_to := v_sweta_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.auto_qualify_spt_lead()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _creator uuid := auth.uid();
  _is_sales boolean := false;
  _is_lqt boolean := false;
  _requested_by uuid;
  _has_active_qual boolean := false;
BEGIN
  IF _creator IS NULL THEN
    RETURN NEW;
  END IF;

  -- Source no longer matters: any UI-created lead by a pure sales user
  -- stays with the creator and is auto-qualified to SPT.
  SELECT
    EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = _creator AND ur.role = 'sales'::public.app_role),
    EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = _creator AND ur.role = 'cro'::public.app_role)
  INTO _is_sales, _is_lqt;

  IF _is_sales AND NOT _is_lqt THEN
    SELECT EXISTS (
      SELECT 1 FROM public.lead_qualification q
      WHERE q.lead_id = NEW.id AND q.is_active = true
    ) INTO _has_active_qual;

    IF NOT _has_active_qual THEN
      INSERT INTO public.lead_qualification (
        lead_id, tenant_id, qualification_type, routed_to,
        qualified_by, decision_reason, is_active
      ) VALUES (
        NEW.id, NEW.tenant_id, 'simple', 'spt',
        _creator, 'Auto-qualified: SPT-originated lead', true
      );
    END IF;

    _requested_by := COALESCE(NEW.assigned_to, _creator);

    INSERT INTO public.price_requests (
      enquiry_item_id, lead_id, tenant_id, requested_by, status, requested_at
    )
    SELECT ei.id, ei.lead_id, NEW.tenant_id, _requested_by, 'pending', now()
    FROM public.enquiry_items ei
    WHERE ei.lead_id = NEW.id
    ON CONFLICT (enquiry_item_id) WHERE enquiry_item_id IS NOT NULL DO NOTHING;
  END IF;

  RETURN NEW;
END;
$function$;