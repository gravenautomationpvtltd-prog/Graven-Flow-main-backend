-- Migration: Fully Functional Delete Lead for LQT Dashboard / OneDesk
CREATE OR REPLACE FUNCTION public.delete_lqt_lead(p_lead_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user uuid := auth.uid();
  v_lead record;
  v_is_admin boolean := false;
  v_is_manager boolean := false;
  v_is_assigned boolean := false;
  v_can_delete boolean := false;
BEGIN
  -- 1. Ensure authenticated caller
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED: Authentication required to delete leads.';
  END IF;

  -- 2. Find target lead
  SELECT id, title, source, customer_id, tenant_id, assigned_to
  INTO v_lead
  FROM public.leads
  WHERE id = p_lead_id;

  IF v_lead.id IS NULL THEN
    RAISE EXCEPTION 'LEAD_NOT_FOUND: Lead % does not exist or was already deleted.', p_lead_id;
  END IF;

  -- 3. Authorization check
  v_is_admin := public.is_admin_or_above(v_user);
  v_is_manager := public.is_manager_or_above(v_user);
  v_is_assigned := (v_lead.assigned_to = v_user);

  v_can_delete := (v_is_admin OR v_is_manager OR v_is_assigned);

  IF NOT v_can_delete THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: You are not authorized to delete this lead.';
  END IF;

  -- 4. Safely clean up / unlink related records according to foreign keys
  DELETE FROM public.webhook_events WHERE lead_id = p_lead_id;

  -- Unlink major parent documents
  UPDATE public.quotations SET lead_id = NULL WHERE lead_id = p_lead_id;
  UPDATE public.sales_orders SET lead_id = NULL WHERE lead_id = p_lead_id;
  UPDATE public.purchase_orders SET lead_id = NULL WHERE lead_id = p_lead_id;
  UPDATE public.dispatches SET lead_id = NULL WHERE lead_id = p_lead_id;
  UPDATE public.customer_forms SET lead_id = NULL WHERE lead_id = p_lead_id;
  UPDATE public.payment_requests SET lead_id = NULL WHERE lead_id = p_lead_id;
  UPDATE public.tst_cases SET lead_id = NULL WHERE lead_id = p_lead_id;
  UPDATE public.tst_interactions SET lead_id = NULL WHERE lead_id = p_lead_id;
  UPDATE public.feedback_tokens SET lead_id = NULL WHERE lead_id = p_lead_id;
  UPDATE public.customer_feedback SET lead_id = NULL WHERE lead_id = p_lead_id;

  -- Delete child operational records
  DELETE FROM public.quotation_item_negotiations WHERE lead_id = p_lead_id;
  DELETE FROM public.price_requests WHERE lead_id = p_lead_id;
  DELETE FROM public.escalation_logs WHERE lead_id = p_lead_id;
  DELETE FROM public.customer_outreach WHERE lead_id = p_lead_id;
  DELETE FROM public.enquiry_item_attachments WHERE enquiry_item_id IN (SELECT id FROM public.enquiry_items WHERE lead_id = p_lead_id);
  DELETE FROM public.enquiry_items WHERE lead_id = p_lead_id;
  DELETE FROM public.activities WHERE lead_id = p_lead_id;
  DELETE FROM public.tasks WHERE lead_id = p_lead_id;
  DELETE FROM public.lead_qualification WHERE lead_id = p_lead_id;
  DELETE FROM public.lead_assignment_history WHERE lead_id = p_lead_id;

  -- 5. Delete the lead record
  DELETE FROM public.leads WHERE id = p_lead_id;

  -- Return success payload
  RETURN jsonb_build_object(
    'success', true,
    'deleted_lead_id', p_lead_id,
    'deleted_by', v_user,
    'deleted_at', now()
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.delete_lqt_lead(uuid) TO authenticated;
