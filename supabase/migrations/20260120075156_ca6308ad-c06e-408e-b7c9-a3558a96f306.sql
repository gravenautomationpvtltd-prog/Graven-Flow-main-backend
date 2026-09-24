-- Add deleted_at column to leads table for soft delete
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES auth.users(id) DEFAULT NULL;

-- Add deleted_at column to customers table for soft delete
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES auth.users(id) DEFAULT NULL;

-- Add deleted_at column to quotations table for soft delete
ALTER TABLE public.quotations ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;
ALTER TABLE public.quotations ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES auth.users(id) DEFAULT NULL;

-- Create indexes for efficient filtering of non-deleted records
CREATE INDEX IF NOT EXISTS idx_leads_deleted_at ON public.leads(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_customers_deleted_at ON public.customers(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_quotations_deleted_at ON public.quotations(deleted_at) WHERE deleted_at IS NULL;

-- Create a function to soft delete a lead
CREATE OR REPLACE FUNCTION public.soft_delete_lead(lead_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.leads 
  SET deleted_at = now(), deleted_by = auth.uid()
  WHERE id = lead_id AND deleted_at IS NULL;
END;
$$;

-- Create a function to restore a soft-deleted lead
CREATE OR REPLACE FUNCTION public.restore_lead(lead_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.leads 
  SET deleted_at = NULL, deleted_by = NULL
  WHERE id = lead_id AND deleted_at IS NOT NULL;
END;
$$;

-- Create a function to soft delete a customer
CREATE OR REPLACE FUNCTION public.soft_delete_customer(customer_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.customers 
  SET deleted_at = now(), deleted_by = auth.uid()
  WHERE id = customer_id AND deleted_at IS NULL;
END;
$$;

-- Create a function to restore a soft-deleted customer
CREATE OR REPLACE FUNCTION public.restore_customer(customer_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.customers 
  SET deleted_at = NULL, deleted_by = NULL
  WHERE id = customer_id AND deleted_at IS NOT NULL;
END;
$$;

-- Create a function to soft delete a quotation
CREATE OR REPLACE FUNCTION public.soft_delete_quotation(quotation_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.quotations 
  SET deleted_at = now(), deleted_by = auth.uid()
  WHERE id = quotation_id AND deleted_at IS NULL;
END;
$$;

-- Create a function to restore a soft-deleted quotation
CREATE OR REPLACE FUNCTION public.restore_quotation(quotation_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.quotations 
  SET deleted_at = NULL, deleted_by = NULL
  WHERE id = quotation_id AND deleted_at IS NOT NULL;
END;
$$;