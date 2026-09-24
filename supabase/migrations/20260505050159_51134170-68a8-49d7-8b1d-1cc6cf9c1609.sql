CREATE OR REPLACE FUNCTION public.auto_create_price_request_for_enquiry()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _tenant_id uuid;
  _pr_id uuid;
BEGIN
  SELECT l.tenant_id INTO _tenant_id
  FROM public.leads l WHERE l.id = NEW.lead_id;

  INSERT INTO public.price_requests (
    enquiry_item_id, lead_id, tenant_id, status, requested_at
  )
  VALUES (NEW.id, NEW.lead_id, _tenant_id, 'pending', now())
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