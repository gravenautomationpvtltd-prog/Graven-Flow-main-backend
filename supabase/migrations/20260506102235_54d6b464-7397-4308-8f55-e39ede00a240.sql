-- Fix SPT lead creation: auto_qualify_spt_lead() still used ON CONFLICT (lead_id),
-- but lead_qualification no longer has a plain unique constraint on lead_id.
-- It now has a partial unique index (lead_id WHERE is_active = true), so the
-- old ON CONFLICT target is invalid and Postgres throws 42P10, aborting the
-- entire create_lead_secure transaction.
--
-- Fix: replace ON CONFLICT with an explicit "skip if an active qualification
-- already exists" guard, which is valid under the new history model and
-- preserves idempotent behavior.

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

  SELECT
    EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = _creator AND ur.role = 'sales'::public.app_role),
    EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = _creator AND ur.role = 'cro'::public.app_role)
  INTO _is_sales, _is_lqt;

  -- Only auto-qualify pure SPT creators (sales without LQT/CRO role)
  IF _is_sales AND NOT _is_lqt THEN
    -- Idempotent guard compatible with the active/history model
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

COMMENT ON FUNCTION public.auto_qualify_spt_lead() IS
'Auto-creates an active SPT qualification when a pure-sales user creates a lead. Uses an explicit existence guard instead of ON CONFLICT because lead_qualification now uses a partial unique index (lead_id WHERE is_active = true).';