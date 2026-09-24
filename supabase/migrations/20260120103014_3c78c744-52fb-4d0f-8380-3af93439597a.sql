-- Fix foreign key constraint errors by cleaning up all references before deletion

-- Update hard_delete_lead function to handle webhook_events
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

  -- Delete webhook_events referencing this lead
  DELETE FROM public.webhook_events WHERE webhook_events.lead_id = hard_delete_lead.lead_id;

  -- Unlink related records (set foreign keys to NULL)
  UPDATE public.quotations SET lead_id = NULL WHERE quotations.lead_id = hard_delete_lead.lead_id;
  UPDATE public.sales_orders SET lead_id = NULL WHERE sales_orders.lead_id = hard_delete_lead.lead_id;
  UPDATE public.purchase_orders SET lead_id = NULL WHERE purchase_orders.lead_id = hard_delete_lead.lead_id;
  UPDATE public.dispatches SET lead_id = NULL WHERE dispatches.lead_id = hard_delete_lead.lead_id;

  -- Delete from quotation_item_negotiations
  DELETE FROM public.quotation_item_negotiations WHERE quotation_item_negotiations.lead_id = hard_delete_lead.lead_id;

  -- Delete from price_requests via enquiry_items
  DELETE FROM public.price_requests WHERE price_requests.enquiry_item_id IN (SELECT id FROM public.enquiry_items WHERE enquiry_items.lead_id = hard_delete_lead.lead_id);

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

-- Update hard_delete_customer function to handle webhook_events and tasks
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

  -- Delete webhook_events referencing this customer
  DELETE FROM public.webhook_events WHERE webhook_events.customer_id = hard_delete_customer.customer_id;

  -- Unlink tasks referencing this customer
  UPDATE public.tasks SET customer_id = NULL WHERE tasks.customer_id = hard_delete_customer.customer_id;

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

-- Update hard_delete_quotation function to handle purchase_orders and previous_quotation_id
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

  -- Unlink purchase_orders referencing this quotation
  UPDATE public.purchase_orders SET quotation_id = NULL WHERE purchase_orders.quotation_id = hard_delete_quotation.quotation_id;

  -- Unlink quotations referencing this as previous_quotation_id
  UPDATE public.quotations SET previous_quotation_id = NULL WHERE quotations.previous_quotation_id = hard_delete_quotation.quotation_id;

  -- Unlink related records (set foreign keys to NULL)
  UPDATE public.sales_orders SET quotation_id = NULL WHERE sales_orders.quotation_id = hard_delete_quotation.quotation_id;
  UPDATE public.invoices SET quotation_id = NULL WHERE invoices.quotation_id = hard_delete_quotation.quotation_id;
  UPDATE public.dispatches SET quotation_id = NULL WHERE dispatches.quotation_id = hard_delete_quotation.quotation_id;

  -- Delete quotation_item_negotiations
  DELETE FROM public.quotation_item_negotiations WHERE quotation_item_negotiations.quotation_id = hard_delete_quotation.quotation_id;

  -- Delete child records
  DELETE FROM public.quotation_versions WHERE quotation_versions.quotation_id = hard_delete_quotation.quotation_id;
  DELETE FROM public.quotation_items WHERE quotation_items.quotation_id = hard_delete_quotation.quotation_id;
  DELETE FROM public.email_logs WHERE email_logs.quotation_id = hard_delete_quotation.quotation_id;

  -- Finally delete the quotation
  DELETE FROM public.quotations WHERE quotations.id = hard_delete_quotation.quotation_id;
END;
$$;

-- Update empty_all_trash function with comprehensive cleanup and auth check
CREATE OR REPLACE FUNCTION public.empty_all_trash()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verify user is authenticated and authorized
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  
  IF NOT public.is_hr_or_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized to empty trash';
  END IF;

  -- Clean up webhook_events for leads being deleted
  DELETE FROM public.webhook_events WHERE lead_id IN (SELECT id FROM public.leads WHERE deleted_at IS NOT NULL);

  -- Clean up quotation_item_negotiations for leads being deleted
  DELETE FROM public.quotation_item_negotiations WHERE lead_id IN (SELECT id FROM public.leads WHERE deleted_at IS NOT NULL);

  -- Clean up price_requests for leads being deleted
  DELETE FROM public.price_requests WHERE enquiry_item_id IN (SELECT id FROM public.enquiry_items WHERE lead_id IN (SELECT id FROM public.leads WHERE deleted_at IS NOT NULL));

  -- Handle leads
  UPDATE public.quotations SET lead_id = NULL WHERE lead_id IN (SELECT id FROM public.leads WHERE deleted_at IS NOT NULL);
  UPDATE public.sales_orders SET lead_id = NULL WHERE lead_id IN (SELECT id FROM public.leads WHERE deleted_at IS NOT NULL);
  UPDATE public.purchase_orders SET lead_id = NULL WHERE lead_id IN (SELECT id FROM public.leads WHERE deleted_at IS NOT NULL);
  UPDATE public.dispatches SET lead_id = NULL WHERE lead_id IN (SELECT id FROM public.leads WHERE deleted_at IS NOT NULL);
  DELETE FROM public.escalation_logs WHERE lead_id IN (SELECT id FROM public.leads WHERE deleted_at IS NOT NULL);
  DELETE FROM public.customer_outreach WHERE lead_id IN (SELECT id FROM public.leads WHERE deleted_at IS NOT NULL);
  DELETE FROM public.enquiry_item_attachments WHERE enquiry_item_id IN (SELECT id FROM public.enquiry_items WHERE lead_id IN (SELECT id FROM public.leads WHERE deleted_at IS NOT NULL));
  DELETE FROM public.enquiry_items WHERE lead_id IN (SELECT id FROM public.leads WHERE deleted_at IS NOT NULL);
  DELETE FROM public.activities WHERE lead_id IN (SELECT id FROM public.leads WHERE deleted_at IS NOT NULL);
  DELETE FROM public.tasks WHERE lead_id IN (SELECT id FROM public.leads WHERE deleted_at IS NOT NULL);
  DELETE FROM public.leads WHERE deleted_at IS NOT NULL;

  -- Clean up webhook_events for customers being deleted
  DELETE FROM public.webhook_events WHERE customer_id IN (SELECT id FROM public.customers WHERE deleted_at IS NOT NULL);

  -- Clean up tasks referencing customers being deleted
  UPDATE public.tasks SET customer_id = NULL WHERE customer_id IN (SELECT id FROM public.customers WHERE deleted_at IS NOT NULL);

  -- Handle customers
  UPDATE public.leads SET customer_id = NULL WHERE customer_id IN (SELECT id FROM public.customers WHERE deleted_at IS NOT NULL);
  UPDATE public.quotations SET customer_id = NULL WHERE customer_id IN (SELECT id FROM public.customers WHERE deleted_at IS NOT NULL);
  UPDATE public.sales_orders SET customer_id = NULL WHERE customer_id IN (SELECT id FROM public.customers WHERE deleted_at IS NOT NULL);
  UPDATE public.invoices SET customer_id = NULL WHERE customer_id IN (SELECT id FROM public.customers WHERE deleted_at IS NOT NULL);
  UPDATE public.dispatches SET customer_id = NULL WHERE customer_id IN (SELECT id FROM public.customers WHERE deleted_at IS NOT NULL);
  DELETE FROM public.customer_payments WHERE customer_id IN (SELECT id FROM public.customers WHERE deleted_at IS NOT NULL);
  DELETE FROM public.customer_outreach WHERE customer_id IN (SELECT id FROM public.customers WHERE deleted_at IS NOT NULL);
  DELETE FROM public.customers WHERE deleted_at IS NOT NULL;

  -- Clean up purchase_orders referencing quotations being deleted
  UPDATE public.purchase_orders SET quotation_id = NULL WHERE quotation_id IN (SELECT id FROM public.quotations WHERE deleted_at IS NOT NULL);

  -- Clean up quotations referencing other quotations as previous_quotation_id
  UPDATE public.quotations SET previous_quotation_id = NULL WHERE previous_quotation_id IN (SELECT id FROM public.quotations WHERE deleted_at IS NOT NULL);

  -- Clean up quotation_item_negotiations for quotations being deleted
  DELETE FROM public.quotation_item_negotiations WHERE quotation_id IN (SELECT id FROM public.quotations WHERE deleted_at IS NOT NULL);

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