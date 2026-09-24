-- Fix LQT/SPT qualification failure: price_requests.requested_by must be populated.

CREATE OR REPLACE FUNCTION public.auto_create_price_request_for_enquiry()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _tenant_id uuid;
  _requested_by uuid;
  _pr_id uuid;
BEGIN
  -- Skip if a price request already exists for this enquiry item
  IF EXISTS (SELECT 1 FROM public.price_requests WHERE enquiry_item_id = NEW.id) THEN
    RETURN NEW;
  END IF;

  -- Skip already-priced (verified_auto) catalog items
  IF COALESCE(NEW.pricing_status::text, '') = 'verified_auto' THEN
    RETURN NEW;
  END IF;

  SELECT l.tenant_id, l.assigned_to
    INTO _tenant_id, _requested_by
  FROM public.leads l WHERE l.id = NEW.lead_id;

  IF _tenant_id IS NULL THEN
    RAISE LOG 'auto_create_price_request_for_enquiry: tenant_id NULL for lead %', NEW.lead_id;
    RETURN NEW;
  END IF;

  -- Resolve requester: lead owner > current auth user > price flagger
  IF _requested_by IS NULL THEN
    _requested_by := COALESCE(auth.uid(), NEW.price_flagged_by);
  END IF;

  IF _requested_by IS NULL THEN
    RAISE LOG 'auto_create_price_request_for_enquiry: requested_by NULL for enquiry_item %', NEW.id;
    RETURN NEW;
  END IF;

  INSERT INTO public.price_requests (
    lead_id, enquiry_item_id, tenant_id, requested_by,
    status, priority, target_rate, assigned_to, requested_at
  )
  VALUES (
    NEW.lead_id, NEW.id, _tenant_id, _requested_by,
    'pending', 'normal', NEW.target_rate, NEW.assigned_procurement_user_id, now()
  )
  ON CONFLICT (enquiry_item_id) WHERE enquiry_item_id IS NOT NULL
  DO NOTHING
  RETURNING id INTO _pr_id;

  IF _pr_id IS NOT NULL THEN
    PERFORM pg_notify(
      'procurement_price_request_new',
      json_build_object(
        'price_request_id', _pr_id,
        'enquiry_item_id', NEW.id,
        'lead_id', NEW.lead_id,
        'tenant_id', _tenant_id
      )::text
    );
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
BEGIN
  IF _creator IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT
    EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = _creator AND ur.role = 'sales'::public.app_role),
    EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = _creator AND ur.role = 'cro'::public.app_role)
  INTO _is_sales, _is_lqt;

  IF _is_sales AND NOT _is_lqt THEN
    INSERT INTO public.lead_qualification (
      lead_id, tenant_id, qualification_type, routed_to,
      qualified_by, decision_reason
    ) VALUES (
      NEW.id, NEW.tenant_id, 'simple', 'spt',
      _creator, 'Auto-qualified: SPT-originated lead'
    )
    ON CONFLICT (lead_id) DO NOTHING;

    _requested_by := COALESCE(NEW.assigned_to, _creator);

    -- Backfill price_requests for any pre-existing enquiry items on this lead
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