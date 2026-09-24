-- Create hard_delete_lead function for permanent deletion
CREATE OR REPLACE FUNCTION public.hard_delete_lead(lead_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rows_affected INTEGER;
BEGIN
  -- Unlink quotations
  UPDATE public.quotations SET lead_id = NULL WHERE lead_id = hard_delete_lead.lead_id;
  
  -- Unlink sales_orders
  UPDATE public.sales_orders SET lead_id = NULL WHERE lead_id = hard_delete_lead.lead_id;
  
  -- Unlink purchase_orders
  UPDATE public.purchase_orders SET lead_id = NULL WHERE lead_id = hard_delete_lead.lead_id;
  
  -- Unlink dispatches
  UPDATE public.dispatches SET lead_id = NULL WHERE lead_id = hard_delete_lead.lead_id;
  
  -- Delete escalation_logs
  DELETE FROM public.escalation_logs WHERE escalation_logs.lead_id = hard_delete_lead.lead_id;
  
  -- Delete customer_outreach
  DELETE FROM public.customer_outreach WHERE customer_outreach.lead_id = hard_delete_lead.lead_id;
  
  -- Delete enquiry_item_attachments for enquiry_items of this lead
  DELETE FROM public.enquiry_item_attachments 
  WHERE enquiry_item_id IN (SELECT id FROM public.enquiry_items WHERE enquiry_items.lead_id = hard_delete_lead.lead_id);
  
  -- Delete price_requests for enquiry_items of this lead
  DELETE FROM public.price_requests 
  WHERE enquiry_item_id IN (SELECT id FROM public.enquiry_items WHERE enquiry_items.lead_id = hard_delete_lead.lead_id);
  
  -- Delete enquiry_items
  DELETE FROM public.enquiry_items WHERE enquiry_items.lead_id = hard_delete_lead.lead_id;
  
  -- Delete activities
  DELETE FROM public.activities WHERE activities.lead_id = hard_delete_lead.lead_id;
  
  -- Delete tasks
  DELETE FROM public.tasks WHERE tasks.lead_id = hard_delete_lead.lead_id;
  
  -- Finally delete the lead
  DELETE FROM public.leads WHERE id = hard_delete_lead.lead_id;
  
  GET DIAGNOSTICS rows_affected = ROW_COUNT;
  
  IF rows_affected = 0 THEN
    RAISE EXCEPTION 'Lead not found';
  END IF;
END;
$$;

-- Create hard_delete_customer function for permanent deletion
CREATE OR REPLACE FUNCTION public.hard_delete_customer(customer_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rows_affected INTEGER;
BEGIN
  -- Unlink leads
  UPDATE public.leads SET customer_id = NULL WHERE customer_id = hard_delete_customer.customer_id;
  
  -- Unlink quotations
  UPDATE public.quotations SET customer_id = NULL WHERE customer_id = hard_delete_customer.customer_id;
  
  -- Unlink sales_orders
  UPDATE public.sales_orders SET customer_id = NULL WHERE customer_id = hard_delete_customer.customer_id;
  
  -- Unlink invoices
  UPDATE public.invoices SET customer_id = NULL WHERE customer_id = hard_delete_customer.customer_id;
  
  -- Unlink dispatches
  UPDATE public.dispatches SET customer_id = NULL WHERE customer_id = hard_delete_customer.customer_id;
  
  -- Delete customer_payments
  DELETE FROM public.customer_payments WHERE customer_payments.customer_id = hard_delete_customer.customer_id;
  
  -- Delete customer_outreach
  DELETE FROM public.customer_outreach WHERE customer_outreach.customer_id = hard_delete_customer.customer_id;
  
  -- Finally delete the customer
  DELETE FROM public.customers WHERE id = hard_delete_customer.customer_id;
  
  GET DIAGNOSTICS rows_affected = ROW_COUNT;
  
  IF rows_affected = 0 THEN
    RAISE EXCEPTION 'Customer not found';
  END IF;
END;
$$;

-- Create hard_delete_quotation function for permanent deletion
CREATE OR REPLACE FUNCTION public.hard_delete_quotation(quotation_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rows_affected INTEGER;
BEGIN
  -- Unlink sales_orders
  UPDATE public.sales_orders SET quotation_id = NULL WHERE quotation_id = hard_delete_quotation.quotation_id;
  
  -- Unlink invoices
  UPDATE public.invoices SET quotation_id = NULL WHERE quotation_id = hard_delete_quotation.quotation_id;
  
  -- Unlink dispatches
  UPDATE public.dispatches SET quotation_id = NULL WHERE quotation_id = hard_delete_quotation.quotation_id;
  
  -- Delete email_logs
  DELETE FROM public.email_logs WHERE email_logs.quotation_id = hard_delete_quotation.quotation_id;
  
  -- Delete quotation_versions
  DELETE FROM public.quotation_versions WHERE quotation_versions.quotation_id = hard_delete_quotation.quotation_id;
  
  -- Delete quotation_items
  DELETE FROM public.quotation_items WHERE quotation_items.quotation_id = hard_delete_quotation.quotation_id;
  
  -- Finally delete the quotation
  DELETE FROM public.quotations WHERE id = hard_delete_quotation.quotation_id;
  
  GET DIAGNOSTICS rows_affected = ROW_COUNT;
  
  IF rows_affected = 0 THEN
    RAISE EXCEPTION 'Quotation not found';
  END IF;
END;
$$;