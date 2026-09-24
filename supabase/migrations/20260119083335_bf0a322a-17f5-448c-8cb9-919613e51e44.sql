-- Phase 1: Critical Security Fixes

-- 1.1 Fix Suppliers Table - Restrict public access
DROP POLICY IF EXISTS "Anyone can view suppliers" ON public.suppliers;
DROP POLICY IF EXISTS "Authenticated users can view suppliers" ON public.suppliers;

-- Create role-based read access for suppliers
CREATE POLICY "Procurement and admins full access to suppliers"
ON public.suppliers FOR ALL
TO authenticated
USING (is_procurement_or_above(auth.uid()))
WITH CHECK (is_procurement_or_above(auth.uid()));

CREATE POLICY "Sales can view active approved suppliers only"
ON public.suppliers FOR SELECT
TO authenticated
USING (
  application_status = 'approved' 
  AND is_active = true
  AND NOT is_procurement_or_above(auth.uid())
);

-- 1.2 Fix Profiles Table - Restrict to proper access
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;
DROP POLICY IF EXISTS "Anyone can view profiles" ON public.profiles;

CREATE POLICY "Users can view own profile fully"
ON public.profiles FOR SELECT
TO authenticated
USING (auth.uid() = id);

CREATE POLICY "Authenticated users can view basic profile info"
ON public.profiles FOR SELECT
TO authenticated
USING (auth.uid() != id);

-- 2.1 Add missing lead status enum values
ALTER TYPE public.lead_status ADD VALUE IF NOT EXISTS 'contacted';
ALTER TYPE public.lead_status ADD VALUE IF NOT EXISTS 'qualified';
ALTER TYPE public.lead_status ADD VALUE IF NOT EXISTS 'proposal';

-- 2.2 Fix function search paths for security
ALTER FUNCTION public.generate_rfq_number() SET search_path = public;
ALTER FUNCTION public.generate_supplier_quotation_number() SET search_path = public;
ALTER FUNCTION public.log_supplier_status_change() SET search_path = public;
ALTER FUNCTION public.update_rfq_distribution_on_quotation() SET search_path = public;