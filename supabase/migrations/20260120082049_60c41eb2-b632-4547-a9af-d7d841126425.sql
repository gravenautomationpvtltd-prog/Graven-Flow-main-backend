-- Fix soft_delete_lead function to properly report failures
CREATE OR REPLACE FUNCTION public.soft_delete_lead(lead_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rows_affected INTEGER;
BEGIN
  UPDATE public.leads 
  SET deleted_at = now(), deleted_by = auth.uid()
  WHERE id = lead_id AND deleted_at IS NULL;
  
  GET DIAGNOSTICS rows_affected = ROW_COUNT;
  
  IF rows_affected = 0 THEN
    RAISE EXCEPTION 'Lead not found or already deleted';
  END IF;
END;
$$;

-- Fix soft_delete_customer function
CREATE OR REPLACE FUNCTION public.soft_delete_customer(customer_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rows_affected INTEGER;
BEGIN
  UPDATE public.customers 
  SET deleted_at = now(), deleted_by = auth.uid()
  WHERE id = customer_id AND deleted_at IS NULL;
  
  GET DIAGNOSTICS rows_affected = ROW_COUNT;
  
  IF rows_affected = 0 THEN
    RAISE EXCEPTION 'Customer not found or already deleted';
  END IF;
END;
$$;

-- Fix soft_delete_quotation function
CREATE OR REPLACE FUNCTION public.soft_delete_quotation(quotation_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rows_affected INTEGER;
BEGIN
  UPDATE public.quotations 
  SET deleted_at = now(), deleted_by = auth.uid()
  WHERE id = quotation_id AND deleted_at IS NULL;
  
  GET DIAGNOSTICS rows_affected = ROW_COUNT;
  
  IF rows_affected = 0 THEN
    RAISE EXCEPTION 'Quotation not found or already deleted';
  END IF;
END;
$$;

-- Fix restore_lead function
CREATE OR REPLACE FUNCTION public.restore_lead(lead_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rows_affected INTEGER;
BEGIN
  UPDATE public.leads 
  SET deleted_at = NULL, deleted_by = NULL
  WHERE id = lead_id AND deleted_at IS NOT NULL;
  
  GET DIAGNOSTICS rows_affected = ROW_COUNT;
  
  IF rows_affected = 0 THEN
    RAISE EXCEPTION 'Lead not found or not deleted';
  END IF;
END;
$$;

-- Fix restore_customer function
CREATE OR REPLACE FUNCTION public.restore_customer(customer_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rows_affected INTEGER;
BEGIN
  UPDATE public.customers 
  SET deleted_at = NULL, deleted_by = NULL
  WHERE id = customer_id AND deleted_at IS NOT NULL;
  
  GET DIAGNOSTICS rows_affected = ROW_COUNT;
  
  IF rows_affected = 0 THEN
    RAISE EXCEPTION 'Customer not found or not deleted';
  END IF;
END;
$$;

-- Fix restore_quotation function
CREATE OR REPLACE FUNCTION public.restore_quotation(quotation_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rows_affected INTEGER;
BEGIN
  UPDATE public.quotations 
  SET deleted_at = NULL, deleted_by = NULL
  WHERE id = quotation_id AND deleted_at IS NOT NULL;
  
  GET DIAGNOSTICS rows_affected = ROW_COUNT;
  
  IF rows_affected = 0 THEN
    RAISE EXCEPTION 'Quotation not found or not deleted';
  END IF;
END;
$$;