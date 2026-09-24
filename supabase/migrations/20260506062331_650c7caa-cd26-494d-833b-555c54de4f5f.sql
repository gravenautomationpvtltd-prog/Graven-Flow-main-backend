-- Realign live auto_assign_lead_on_insert with the intended SPT/LQT logic.
-- Order of precedence inside this BEFORE INSERT trigger:
--   1) If assigned_to already set, respect it (SPT self-create / explicit assign).
--   2) Customer loyalty wins: if customer has an active in-tenant owner, route to them.
--   3) Creator is sales-only -> own it themselves.
--   4) Creator is LQT/CRO -> own it themselves.
--   5) Otherwise -> fair LQT round-robin via pick_next_lqt_user(tenant_id).
--
-- enforce_lqt_landing_zone() (the aaa_ trigger) still runs FIRST and only
-- overrides assigned_to for true external sources (indiamart/tradeindia/
-- whatsapp/email/website/webhook), so manual/referral leads keep ownership.

CREATE OR REPLACE FUNCTION public.auto_assign_lead_on_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _creator uuid := auth.uid();
  _creator_is_lqt boolean := false;
  _creator_is_sales boolean := false;
  _loyal_sales uuid;
  _loyal_active boolean := false;
  _lqt_user uuid;
BEGIN
  -- Loyalty hint (always recorded if available, regardless of routing outcome)
  IF NEW.customer_id IS NOT NULL AND NEW.suggested_assignee_id IS NULL THEN
    SELECT assigned_sales_id INTO _loyal_sales
    FROM public.customers
    WHERE id = NEW.customer_id;

    IF _loyal_sales IS NOT NULL THEN
      NEW.suggested_assignee_id := _loyal_sales;
    END IF;
  ELSIF NEW.suggested_assignee_id IS NOT NULL THEN
    _loyal_sales := NEW.suggested_assignee_id;
  END IF;

  -- If something already set assigned_to (e.g. enforce_lqt_landing_zone or
  -- explicit caller payload), respect it.
  IF NEW.assigned_to IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Pass 1: customer loyalty wins for pre-LQT-owned customers.
  -- Only route to the loyal owner if they are still an active in-tenant
  -- salesperson and not opted out of lead assignment.
  IF _loyal_sales IS NOT NULL THEN
    SELECT TRUE
      INTO _loyal_active
    FROM public.profiles p
    JOIN public.tenant_users tu
      ON tu.user_id = p.id
     AND tu.tenant_id = NEW.tenant_id
     AND tu.is_active = true
    WHERE p.id = _loyal_sales
      AND COALESCE(p.is_active, true) = true
      AND COALESCE(p.employment_status, 'active') = 'active'
      AND p.exit_date IS NULL
      AND COALESCE(p.lead_assignment_opt_out, false) = false
      AND EXISTS (
        SELECT 1 FROM public.user_roles ur
        WHERE ur.user_id = p.id AND ur.role = 'sales'::public.app_role
      );

    IF _loyal_active THEN
      NEW.assigned_to := _loyal_sales;
      RETURN NEW;
    END IF;
  END IF;

  -- Determine creator roles for the SPT / LQT branches.
  IF _creator IS NOT NULL THEN
    SELECT
      EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = _creator AND ur.role = 'cro'::public.app_role),
      EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = _creator AND ur.role = 'sales'::public.app_role)
    INTO _creator_is_lqt, _creator_is_sales;
  END IF;

  -- Pass 2: SPT self-create (sales user creating a lead for themselves).
  IF _creator_is_sales THEN
    NEW.assigned_to := _creator;
    RETURN NEW;
  END IF;

  -- Pass 3: LQT/CRO self-create.
  IF _creator_is_lqt THEN
    NEW.assigned_to := _creator;
    RETURN NEW;
  END IF;

  -- Pass 4: fair LQT round-robin for everyone else (webhooks, admins, etc.).
  _lqt_user := public.pick_next_lqt_user(NEW.tenant_id);
  IF _lqt_user IS NOT NULL THEN
    NEW.assigned_to := _lqt_user;
  END IF;

  RETURN NEW;
END;
$function$;

COMMENT ON FUNCTION public.auto_assign_lead_on_insert() IS
'BEFORE INSERT routing for public.leads. Order: explicit assigned_to wins -> customer loyalty (pre-LQT owner) -> SPT self-create -> LQT self-create -> LQT round-robin fallback. Always records suggested_assignee_id from customer ownership when available.';
