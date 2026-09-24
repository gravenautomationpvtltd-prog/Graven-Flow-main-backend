CREATE OR REPLACE FUNCTION public.enforce_owner_lock_on_customers()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_privileged boolean := false;
BEGIN
  IF OLD.owner_locked = true
     AND NEW.assigned_sales_id IS DISTINCT FROM OLD.assigned_sales_id THEN

    IF v_uid IS NOT NULL AND (
      public.has_role(v_uid, 'super_admin') OR
      public.has_role(v_uid, 'coo') OR
      public.has_role(v_uid, 'manager') OR
      public.has_role(v_uid, 'platform_admin')
    ) THEN
      v_privileged := true;
    END IF;

    IF NOT v_privileged THEN
      RAISE EXCEPTION 'Customer % is locked to a protected owner and cannot be reassigned. Unlock owner_locked first.', OLD.id
        USING ERRCODE = 'check_violation';
    END IF;

    -- Privileged reassign: auto-unlock so future automations don't fight the manual choice
    NEW.owner_locked := false;
  END IF;
  RETURN NEW;
END;
$function$;