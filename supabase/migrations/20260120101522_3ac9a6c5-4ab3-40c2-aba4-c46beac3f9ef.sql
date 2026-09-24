-- Fix ambiguous column references in hard delete functions by fully qualifying column names

-- Update hard_delete_lead function
CREATE OR REPLACE FUNCTION public.hard_delete_lead(lead_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verify the lead exists and is soft-deleted
  IF NOT EXISTS (SELECT 1 FROM public.leads WHERE leads.id = hard_delete_lead.lead_id AND leads.deleted_at IS NOT NULL) THEN
    RAISE EXCEPTION 'Lead not found or not in trash';
  END IF;

  -- Unlink related records (set foreign keys to NULL)
  UPDATE public.quotations SET lead_id = NULL WHERE quotations.lead_id = hard_delete_lead.lead_id;
  UPDATE public.sales_orders SET lead_id = NULL WHERE sales_orders.lead_id = hard_delete_lead.lead_id;
  UPDATE public.purchase_orders SET lead_id = NULL WHERE purchase_orders.lead_id = hard_delete_lead.lead_id;
  UPDATE public.dispatches SET lead_id = NULL WHERE dispatches.lead_id = hard_delete_lead.lead_id;

  -- Delete child records
  DELETE FROM public.escalation_logs WHERE escalation_logs.lead_id = hard_delete_lead.lead_id;
  DELETE FROM public.customer_outreach WHERE customer_outreach.lead_id = hard_delete_lead.lead_id;
  DELETE FROM public.enquiry_item_attachments WHERE enquiry_item_attachments.enquiry_item_id IN (SELECT id FROM public.enquiry_items WHERE enquiry_items.lead_id = hard_delete_lead.lead_id);
  DELETE FROM public.enquiry_items WHERE enquiry_items.lead_id = hard_delete_lead.lead_id;
  DELETE FROM public.activities WHERE activities.lead_id = hard_delete_lead.lead_id;
  DELETE FROM public.tasks WHERE tasks.lead_id = hard_delete_lead.lead_id;

  -- Finally delete the lead
  DELETE FROM public.leads WHERE leads.id = hard_delete_lead.lead_id;
END;
$$;

-- Update hard_delete_customer function
CREATE OR REPLACE FUNCTION public.hard_delete_customer(customer_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verify the customer exists and is soft-deleted
  IF NOT EXISTS (SELECT 1 FROM public.customers WHERE customers.id = hard_delete_customer.customer_id AND customers.deleted_at IS NOT NULL) THEN
    RAISE EXCEPTION 'Customer not found or not in trash';
  END IF;

  -- Unlink related records (set foreign keys to NULL)
  UPDATE public.leads SET customer_id = NULL WHERE leads.customer_id = hard_delete_customer.customer_id;
  UPDATE public.quotations SET customer_id = NULL WHERE quotations.customer_id = hard_delete_customer.customer_id;
  UPDATE public.sales_orders SET customer_id = NULL WHERE sales_orders.customer_id = hard_delete_customer.customer_id;
  UPDATE public.invoices SET customer_id = NULL WHERE invoices.customer_id = hard_delete_customer.customer_id;
  UPDATE public.dispatches SET customer_id = NULL WHERE dispatches.customer_id = hard_delete_customer.customer_id;

  -- Delete child records
  DELETE FROM public.customer_payments WHERE customer_payments.customer_id = hard_delete_customer.customer_id;
  DELETE FROM public.customer_outreach WHERE customer_outreach.customer_id = hard_delete_customer.customer_id;

  -- Finally delete the customer
  DELETE FROM public.customers WHERE customers.id = hard_delete_customer.customer_id;
END;
$$;

-- Update hard_delete_quotation function
CREATE OR REPLACE FUNCTION public.hard_delete_quotation(quotation_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verify the quotation exists and is soft-deleted
  IF NOT EXISTS (SELECT 1 FROM public.quotations WHERE quotations.id = hard_delete_quotation.quotation_id AND quotations.deleted_at IS NOT NULL) THEN
    RAISE EXCEPTION 'Quotation not found or not in trash';
  END IF;

  -- Unlink related records (set foreign keys to NULL)
  UPDATE public.sales_orders SET quotation_id = NULL WHERE sales_orders.quotation_id = hard_delete_quotation.quotation_id;
  UPDATE public.invoices SET quotation_id = NULL WHERE invoices.quotation_id = hard_delete_quotation.quotation_id;
  UPDATE public.dispatches SET quotation_id = NULL WHERE dispatches.quotation_id = hard_delete_quotation.quotation_id;

  -- Delete child records
  DELETE FROM public.quotation_versions WHERE quotation_versions.quotation_id = hard_delete_quotation.quotation_id;
  DELETE FROM public.quotation_items WHERE quotation_items.quotation_id = hard_delete_quotation.quotation_id;
  DELETE FROM public.email_logs WHERE email_logs.quotation_id = hard_delete_quotation.quotation_id;

  -- Finally delete the quotation
  DELETE FROM public.quotations WHERE quotations.id = hard_delete_quotation.quotation_id;
END;
$$;