-- Fix SPT lead creation regression: distinguish auto-qualification (no items required)
-- from real LQT/CST handoffs (items required).
--
-- Root cause: trg_fn_reassign_on_qualification raises an exception whenever a
-- routed_to='spt' qualification row exists without any enquiry_items. But
-- trg_auto_qualify_spt_lead inserts that same row automatically when an SPT
-- user creates a fresh lead, so create_lead_secure aborts every time.
--
-- Fix: only enforce the "must have at least one enquiry item" guard when the
-- qualification represents a real handoff from LQT or CST (i.e. inserted by a
-- non-sales-only qualifier, or explicitly tagged as a handoff).
-- Auto-qualified SPT-originated leads (decision_reason starts with
-- 'Auto-qualified') are exempt because the sales user will add enquiry items
-- next from the lead detail screen.

CREATE OR REPLACE FUNCTION public.trg_fn_reassign_on_qualification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _enq_count int;
  _is_auto_spt boolean := false;
BEGIN
  IF NEW.routed_to = 'spt' THEN
    -- Auto-qualified SPT-originated leads (created by trg_auto_qualify_spt_lead)
    -- don't have enquiry items yet by design; sales adds them after creation.
    _is_auto_spt := COALESCE(NEW.decision_reason, '') LIKE 'Auto-qualified%';

    IF NOT _is_auto_spt THEN
      SELECT COUNT(*) INTO _enq_count
      FROM public.enquiry_items
      WHERE lead_id = NEW.lead_id;

      IF _enq_count = 0 THEN
        RAISE EXCEPTION 'Cannot route lead to SPT without at least one enquiry item. Please add the enquiry first.'
          USING ERRCODE = 'check_violation';
      END IF;
    END IF;

    PERFORM public.assign_lead_to_spt(NEW.lead_id);
  END IF;

  -- 'tst', 'discard', 'nurture' -> no Sales reassignment here.
  RETURN NEW;
END;
$function$;

COMMENT ON FUNCTION public.trg_fn_reassign_on_qualification() IS
'Reassigns leads when a qualification row is inserted/updated. SPT routing requires enquiry_items EXCEPT for auto-qualified SPT-originated leads (decision_reason LIKE ''Auto-qualified%''), which are sales-owned drafts and will receive enquiry items next.';