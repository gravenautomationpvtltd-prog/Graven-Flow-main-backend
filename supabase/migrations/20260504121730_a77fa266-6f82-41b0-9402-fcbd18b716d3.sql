-- Drop old trigger (will recreate with new name so it fires before trg_auto_assign_lead alphabetically)
DROP TRIGGER IF EXISTS trg_enforce_lqt_landing_zone ON public.leads;

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
  -- Always force has_enquiry false so SPT inbox cannot see it until LQT routes it
  NEW.has_enquiry := false;
  NEW.enquiry_status := NULL;

  -- Only route external-source leads through LQT.
  -- Manual/referral leads keep whatever assigned_to was provided (rep ownership).
  IF NEW.source::text = ANY(v_external_sources) THEN
    -- If caller already targeted an LQT (cro) user, respect that
    SELECT array_agg(user_id) INTO v_lqt_user_ids
    FROM user_roles WHERE role::text = 'cro';

    IF NEW.assigned_to IS NULL
       OR NOT (NEW.assigned_to = ANY(COALESCE(v_lqt_user_ids, ARRAY[]::uuid[])))
    THEN
      -- Park loyalty hint (so LQT can suggest the right salesperson) but actually route to Sweta
      IF NEW.assigned_to IS NOT NULL AND NEW.suggested_assignee_id IS NULL THEN
        NEW.suggested_assignee_id := NEW.assigned_to;
      END IF;
      NEW.assigned_to := v_sweta_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

-- Recreate with "aaa_" prefix so it fires before trg_auto_assign_lead (alphabetical order)
CREATE TRIGGER aaa_enforce_lqt_landing_zone
BEFORE INSERT ON public.leads
FOR EACH ROW EXECUTE FUNCTION public.enforce_lqt_landing_zone();
