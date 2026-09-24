CREATE OR REPLACE FUNCTION public.cct_handoff_create_price_request()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_requested_by uuid;
  v_assigned_to uuid;
  v_existing uuid;
  v_priority text;
  v_tat timestamptz;
BEGIN
  IF NEW.status <> 'handed_off' OR (OLD.status IS NOT DISTINCT FROM 'handed_off') THEN
    RETURN NEW;
  END IF;

  IF NEW.lead_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.order_item_id IS NOT NULL THEN
    SELECT id INTO v_existing FROM public.price_requests
      WHERE enquiry_item_id = NEW.order_item_id LIMIT 1;
    IF v_existing IS NOT NULL THEN
      RETURN NEW;
    END IF;
  END IF;

  v_requested_by := COALESCE(NEW.decided_by, NEW.assigned_to);
  IF v_requested_by IS NULL THEN
    SELECT assigned_to INTO v_requested_by FROM public.leads WHERE id = NEW.lead_id;
  END IF;
  IF v_requested_by IS NULL THEN
    RETURN NEW;
  END IF;

  -- Route by sourcing_type to the right Procurement Manager
  v_assigned_to := NEW.assigned_to;
  IF v_assigned_to IS NULL THEN
    IF NEW.sourcing_type::text = 'import' THEN
      SELECT ur.user_id INTO v_assigned_to
      FROM public.user_roles ur
      JOIN public.profiles p ON p.id = ur.user_id
      WHERE p.tenant_id = NEW.tenant_id
        AND ur.role = 'import_procurement'::app_role
      LIMIT 1;
    END IF;
    IF v_assigned_to IS NULL THEN
      SELECT ur.user_id INTO v_assigned_to
      FROM public.user_roles ur
      JOIN public.profiles p ON p.id = ur.user_id
      WHERE p.tenant_id = NEW.tenant_id
        AND ur.role = 'procurement_manager'::app_role
      LIMIT 1;
    END IF;
  END IF;

  v_priority := CASE NEW.priority::text
    WHEN 'urgent' THEN 'urgent'
    WHEN 'high'   THEN 'high'
    WHEN 'low'    THEN 'low'
    ELSE 'normal'
  END;

  v_tat := now() + (CASE WHEN NEW.priority::text = 'urgent' THEN interval '24 hours' ELSE interval '48 hours' END);

  INSERT INTO public.price_requests (
    tenant_id, lead_id, enquiry_item_id, requested_by, assigned_to,
    status, priority, target_rate, notes, tat_deadline
  ) VALUES (
    NEW.tenant_id, NEW.lead_id, NEW.order_item_id, v_requested_by, v_assigned_to,
    'pending', v_priority, NEW.target_price,
    COALESCE(NEW.notes, '') || CASE WHEN NEW.notes IS NOT NULL THEN E'\n' ELSE '' END
      || '[CCT handoff] Sourcing: ' || NEW.sourcing_type::text
      || COALESCE(' • Team: ' || NEW.assigned_team::text, '')
      || COALESCE(' • Need by: ' || NEW.timeline_date::text, ''),
    v_tat
  );

  RETURN NEW;
END;
$function$;