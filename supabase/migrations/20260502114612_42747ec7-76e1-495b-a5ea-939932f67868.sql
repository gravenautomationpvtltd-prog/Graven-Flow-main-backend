-- 1) Update auto_assign_lead_on_insert to route SPT creators directly to themselves
CREATE OR REPLACE FUNCTION public.auto_assign_lead_on_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _loyal_sales uuid;
  _lqt_user uuid;
  _creator uuid := auth.uid();
  _creator_is_lqt boolean := false;
  _creator_is_sales boolean := false;
BEGIN
  -- Loyalty hint (always recorded if available)
  IF NEW.customer_id IS NOT NULL AND NEW.suggested_assignee_id IS NULL THEN
    SELECT assigned_sales_id INTO _loyal_sales
    FROM public.customers
    WHERE id = NEW.customer_id;

    IF _loyal_sales IS NOT NULL THEN
      NEW.suggested_assignee_id := _loyal_sales;
    END IF;
  END IF;

  -- Determine creator roles
  IF _creator IS NOT NULL THEN
    SELECT
      EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = _creator AND ur.role = 'cro'::public.app_role),
      EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = _creator AND ur.role = 'sales'::public.app_role)
    INTO _creator_is_lqt, _creator_is_sales;
  END IF;

  IF NEW.assigned_to IS NULL THEN
    IF _creator_is_lqt THEN
      -- LQT user creating a lead: keep it
      NEW.assigned_to := _creator;
    ELSIF _creator_is_sales THEN
      -- SPT user creating a lead: skip LQT, own it immediately
      NEW.assigned_to := _creator;
    ELSE
      -- Anyone else (webhooks, admins, integrations): fair LQT round-robin
      _lqt_user := public.pick_next_lqt_user(NEW.tenant_id);
      IF _lqt_user IS NOT NULL THEN
        NEW.assigned_to := _lqt_user;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

-- 2) AFTER INSERT trigger: auto-qualify SPT-originated leads so they land in SPT inbox
--    (and any enquiry_items they add fan out to Procurement automatically)
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

  -- Only auto-qualify pure SPT creators (not dual-role LQT/SPT, who use the LQT screen)
  IF _is_sales AND NOT _is_lqt THEN
    INSERT INTO public.lead_qualification (
      lead_id, tenant_id, qualification_type, routed_to,
      qualified_by, decision_reason
    ) VALUES (
      NEW.id, NEW.tenant_id, 'simple', 'spt',
      _creator, 'Auto-qualified: SPT-originated lead'
    )
    ON CONFLICT (lead_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_auto_qualify_spt_lead ON public.leads;
CREATE TRIGGER trg_auto_qualify_spt_lead
AFTER INSERT ON public.leads
FOR EACH ROW
EXECUTE FUNCTION public.auto_qualify_spt_lead();

COMMENT ON FUNCTION public.auto_qualify_spt_lead() IS
'When an SPT (sales-only) user creates a lead, auto-insert a lead_qualification row routed to SPT so the lead surfaces in get_spt_inbox immediately. Enquiry items added afterwards trigger auto_create_price_request_for_enquiry, populating the Procurement queue in real time. Dual-role LQT/SPT users skip auto-qualification so they can use the LQT qualification screen.';