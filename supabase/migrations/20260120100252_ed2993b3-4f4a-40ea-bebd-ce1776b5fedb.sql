-- Create function to empty all trash items at once (admin only)
CREATE OR REPLACE FUNCTION public.empty_all_trash()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Delete all soft-deleted leads using the hard_delete_lead function logic
  -- First handle leads
  UPDATE public.quotations SET lead_id = NULL WHERE lead_id IN (SELECT id FROM public.leads WHERE deleted_at IS NOT NULL);
  UPDATE public.sales_orders SET lead_id = NULL WHERE lead_id IN (SELECT id FROM public.leads WHERE deleted_at IS NOT NULL);
  UPDATE public.purchase_orders SET lead_id = NULL WHERE lead_id IN (SELECT id FROM public.leads WHERE deleted_at IS NOT NULL);
  UPDATE public.dispatches SET lead_id = NULL WHERE lead_id IN (SELECT id FROM public.leads WHERE deleted_at IS NOT NULL);
  DELETE FROM public.escalation_logs WHERE lead_id IN (SELECT id FROM public.leads WHERE deleted_at IS NOT NULL);
  DELETE FROM public.customer_outreach WHERE lead_id IN (SELECT id FROM public.leads WHERE deleted_at IS NOT NULL);
  DELETE FROM public.enquiry_item_attachments WHERE enquiry_item_id IN (SELECT id FROM public.enquiry_items WHERE lead_id IN (SELECT id FROM public.leads WHERE deleted_at IS NOT NULL));
  DELETE FROM public.price_requests WHERE enquiry_item_id IN (SELECT id FROM public.enquiry_items WHERE lead_id IN (SELECT id FROM public.leads WHERE deleted_at IS NOT NULL));
  DELETE FROM public.enquiry_items WHERE lead_id IN (SELECT id FROM public.leads WHERE deleted_at IS NOT NULL);
  DELETE FROM public.activities WHERE lead_id IN (SELECT id FROM public.leads WHERE deleted_at IS NOT NULL);
  DELETE FROM public.tasks WHERE lead_id IN (SELECT id FROM public.leads WHERE deleted_at IS NOT NULL);
  DELETE FROM public.leads WHERE deleted_at IS NOT NULL;

  -- Handle customers
  UPDATE public.leads SET customer_id = NULL WHERE customer_id IN (SELECT id FROM public.customers WHERE deleted_at IS NOT NULL);
  UPDATE public.quotations SET customer_id = NULL WHERE customer_id IN (SELECT id FROM public.customers WHERE deleted_at IS NOT NULL);
  UPDATE public.sales_orders SET customer_id = NULL WHERE customer_id IN (SELECT id FROM public.customers WHERE deleted_at IS NOT NULL);
  UPDATE public.invoices SET customer_id = NULL WHERE customer_id IN (SELECT id FROM public.customers WHERE deleted_at IS NOT NULL);
  UPDATE public.dispatches SET customer_id = NULL WHERE customer_id IN (SELECT id FROM public.customers WHERE deleted_at IS NOT NULL);
  DELETE FROM public.customer_payments WHERE customer_id IN (SELECT id FROM public.customers WHERE deleted_at IS NOT NULL);
  DELETE FROM public.customer_outreach WHERE customer_id IN (SELECT id FROM public.customers WHERE deleted_at IS NOT NULL);
  DELETE FROM public.customers WHERE deleted_at IS NOT NULL;

  -- Handle quotations
  UPDATE public.sales_orders SET quotation_id = NULL WHERE quotation_id IN (SELECT id FROM public.quotations WHERE deleted_at IS NOT NULL);
  UPDATE public.invoices SET quotation_id = NULL WHERE quotation_id IN (SELECT id FROM public.quotations WHERE deleted_at IS NOT NULL);
  UPDATE public.dispatches SET quotation_id = NULL WHERE quotation_id IN (SELECT id FROM public.quotations WHERE deleted_at IS NOT NULL);
  DELETE FROM public.email_logs WHERE quotation_id IN (SELECT id FROM public.quotations WHERE deleted_at IS NOT NULL);
  DELETE FROM public.quotation_versions WHERE quotation_id IN (SELECT id FROM public.quotations WHERE deleted_at IS NOT NULL);
  DELETE FROM public.quotation_items WHERE quotation_id IN (SELECT id FROM public.quotations WHERE deleted_at IS NOT NULL);
  DELETE FROM public.quotations WHERE deleted_at IS NOT NULL;
END;
$$;