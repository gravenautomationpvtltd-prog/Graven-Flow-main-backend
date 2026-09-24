CREATE OR REPLACE FUNCTION public.trg_fn_reassign_on_boq_handoff()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lead_tenant uuid;
BEGIN
  -- Only act when status transitions into handed_off
  IF NEW.status = 'handed_off' AND (OLD.status IS DISTINCT FROM 'handed_off') THEN
    -- Reassign the lead to its rightful sales owner (loyalty → state → round-robin)
    PERFORM public.assign_lead_to_spt(NEW.lead_id);

    -- Get tenant for the qualification row
    SELECT tenant_id INTO v_lead_tenant FROM public.leads WHERE id = NEW.lead_id;

    -- Ensure a lead_qualification handoff row exists so SPT inbox sees it
    INSERT INTO public.lead_qualification (
      lead_id, tenant_id, qualification_type, routed_to,
      qualified_by, qualified_at, decision_reason
    ) VALUES (
      NEW.lead_id, v_lead_tenant, 'technical', 'spt',
      COALESCE(NEW.handoff_by, NEW.assigned_to, NEW.created_by), now(),
      'TST handoff'
    )
    ON CONFLICT (lead_id) DO UPDATE
      SET qualification_type = 'technical',
          routed_to = 'spt',
          qualified_by = COALESCE(EXCLUDED.qualified_by, public.lead_qualification.qualified_by),
          qualified_at = now(),
          decision_reason = COALESCE(public.lead_qualification.decision_reason, 'TST handoff'),
          updated_at = now();
  END IF;

  RETURN NEW;
END;
$$;