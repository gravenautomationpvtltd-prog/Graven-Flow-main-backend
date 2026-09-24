-- 1) Drop the duplicate trigger; keep the canonical one
DROP TRIGGER IF EXISTS trg_auto_create_price_request ON public.enquiry_items;

-- 2) Make auto_create_price_request_for_enquiry emit a NOTIFY so subscribed UIs
--    (and Postgres realtime listeners) can refresh instantly without polling.
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
  -- Resolve tenant from the parent lead
  SELECT l.tenant_id INTO _tenant_id
  FROM public.leads l WHERE l.id = NEW.lead_id;

  -- Insert a price_request, idempotent via the unique index on enquiry_item_id
  INSERT INTO public.price_requests (
    enquiry_item_id, lead_id, tenant_id, status, requested_at
  )
  VALUES (NEW.id, NEW.lead_id, _tenant_id, 'pending', now())
  ON CONFLICT (enquiry_item_id) DO NOTHING
  RETURNING id INTO _pr_id;

  -- Notify any listeners (procurement queue UI uses Supabase realtime on price_requests)
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

-- 3) Make sure price_requests is in the realtime publication so the
--    Procurement queue receives row-level INSERT events instantly.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'price_requests'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.price_requests';
  END IF;
END$$;

-- 4) Belt-and-braces: when an SPT lead is auto-qualified via trg_auto_qualify_spt_lead,
--    if any enquiry_items already exist for that lead (e.g. inserted in the same
--    transaction by an integration), backfill price_requests for them.
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
BEGIN
  IF _creator IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT
    EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = _creator AND ur.role = 'sales'::public.app_role),
    EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = _creator AND ur.role = 'cro'::public.app_role)
  INTO _is_sales, _is_lqt;

  -- Only auto-qualify pure SPT creators
  IF _is_sales AND NOT _is_lqt THEN
    INSERT INTO public.lead_qualification (
      lead_id, tenant_id, qualification_type, routed_to,
      qualified_by, decision_reason
    ) VALUES (
      NEW.id, NEW.tenant_id, 'simple', 'spt',
      _creator, 'Auto-qualified: SPT-originated lead'
    )
    ON CONFLICT (lead_id) DO NOTHING;

    -- Fan out price_requests for any enquiry_items already on this lead
    INSERT INTO public.price_requests (enquiry_item_id, lead_id, tenant_id, status, requested_at)
    SELECT ei.id, ei.lead_id, NEW.tenant_id, 'pending', now()
    FROM public.enquiry_items ei
    WHERE ei.lead_id = NEW.id
    ON CONFLICT (enquiry_item_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$function$;