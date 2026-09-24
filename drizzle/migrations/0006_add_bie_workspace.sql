ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'bie';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'bie_manager';

CREATE OR REPLACE FUNCTION public.is_bie_manager(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role::text IN ('bie_manager', 'super_admin', 'coo')
  )
$$;

CREATE TABLE public.vendor_registrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  company_name text NOT NULL,
  portal_name text NOT NULL,
  registration_reference text,
  status text NOT NULL DEFAULT 'not_started' CHECK (status IN ('not_started','in_progress','submitted','approved','rejected')),
  validity_date date,
  credential_reference text,
  notes text,
  assigned_to uuid NOT NULL REFERENCES public.profiles(id),
  assigned_by uuid NOT NULL REFERENCES public.profiles(id),
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vendor_registrations TO authenticated;
GRANT ALL ON public.vendor_registrations TO service_role;
ALTER TABLE public.vendor_registrations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "BIE tenant members view assigned registrations"
ON public.vendor_registrations FOR SELECT TO authenticated
USING (tenant_id = public.get_user_tenant_id(auth.uid()) AND (assigned_to = auth.uid() OR public.is_bie_manager(auth.uid())));
CREATE POLICY "BIE tenant members create registrations"
ON public.vendor_registrations FOR INSERT TO authenticated
WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()) AND assigned_by = auth.uid() AND (assigned_to = auth.uid() OR public.is_bie_manager(auth.uid())));
CREATE POLICY "BIE tenant members update registrations"
ON public.vendor_registrations FOR UPDATE TO authenticated
USING (tenant_id = public.get_user_tenant_id(auth.uid()) AND (assigned_to = auth.uid() OR public.is_bie_manager(auth.uid())))
WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()) AND (assigned_to = auth.uid() OR public.is_bie_manager(auth.uid())));
CREATE POLICY "BIE managers delete registrations"
ON public.vendor_registrations FOR DELETE TO authenticated
USING (tenant_id = public.get_user_tenant_id(auth.uid()) AND public.is_bie_manager(auth.uid()));

CREATE TABLE public.tenders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  tender_number text NOT NULL,
  issuing_authority text NOT NULL,
  description text NOT NULL,
  estimated_value numeric,
  submission_deadline timestamptz,
  status text NOT NULL DEFAULT 'identified' CHECK (status IN ('identified','preparing','submitted','awarded','lost')),
  awarded_value numeric,
  awarded_date date,
  notes text,
  assigned_to uuid NOT NULL REFERENCES public.profiles(id),
  assigned_by uuid NOT NULL REFERENCES public.profiles(id),
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tenders TO authenticated;
GRANT ALL ON public.tenders TO service_role;
ALTER TABLE public.tenders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "BIE tenant members view assigned tenders"
ON public.tenders FOR SELECT TO authenticated
USING (tenant_id = public.get_user_tenant_id(auth.uid()) AND (assigned_to = auth.uid() OR public.is_bie_manager(auth.uid())));
CREATE POLICY "BIE tenant members create tenders"
ON public.tenders FOR INSERT TO authenticated
WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()) AND assigned_by = auth.uid() AND (assigned_to = auth.uid() OR public.is_bie_manager(auth.uid())));
CREATE POLICY "BIE tenant members update tenders"
ON public.tenders FOR UPDATE TO authenticated
USING (tenant_id = public.get_user_tenant_id(auth.uid()) AND (assigned_to = auth.uid() OR public.is_bie_manager(auth.uid())))
WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()) AND (assigned_to = auth.uid() OR public.is_bie_manager(auth.uid())));
CREATE POLICY "BIE managers delete tenders"
ON public.tenders FOR DELETE TO authenticated
USING (tenant_id = public.get_user_tenant_id(auth.uid()) AND public.is_bie_manager(auth.uid()));

CREATE TABLE public.website_listings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  website_name text NOT NULL,
  listing_title text NOT NULL,
  listing_reference text,
  listing_url text,
  listed_date date,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','needs_update','removed')),
  notes text,
  assigned_to uuid NOT NULL REFERENCES public.profiles(id),
  assigned_by uuid NOT NULL REFERENCES public.profiles(id),
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX website_listings_tenant_site_reference_uidx ON public.website_listings (tenant_id, lower(website_name), lower(listing_reference)) WHERE listing_reference IS NOT NULL;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.website_listings TO authenticated;
GRANT ALL ON public.website_listings TO service_role;
ALTER TABLE public.website_listings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "BIE tenant members view assigned listings"
ON public.website_listings FOR SELECT TO authenticated
USING (tenant_id = public.get_user_tenant_id(auth.uid()) AND (assigned_to = auth.uid() OR public.is_bie_manager(auth.uid())));
CREATE POLICY "BIE tenant members create listings"
ON public.website_listings FOR INSERT TO authenticated
WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()) AND assigned_by = auth.uid() AND (assigned_to = auth.uid() OR public.is_bie_manager(auth.uid())));
CREATE POLICY "BIE tenant members update listings"
ON public.website_listings FOR UPDATE TO authenticated
USING (tenant_id = public.get_user_tenant_id(auth.uid()) AND (assigned_to = auth.uid() OR public.is_bie_manager(auth.uid())))
WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()) AND (assigned_to = auth.uid() OR public.is_bie_manager(auth.uid())));
CREATE POLICY "BIE managers delete listings"
ON public.website_listings FOR DELETE TO authenticated
USING (tenant_id = public.get_user_tenant_id(auth.uid()) AND public.is_bie_manager(auth.uid()));

CREATE INDEX vendor_registrations_tenant_assignee_idx ON public.vendor_registrations (tenant_id, assigned_to, status);
CREATE INDEX tenders_tenant_assignee_deadline_idx ON public.tenders (tenant_id, assigned_to, submission_deadline);
CREATE INDEX website_listings_tenant_assignee_status_idx ON public.website_listings (tenant_id, assigned_to, status);

CREATE POLICY "BIE can maintain products"
ON public.products FOR UPDATE TO authenticated
USING (public.is_my_tenant(tenant_id) AND EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role::text IN ('bie','bie_manager')))
WITH CHECK (public.is_my_tenant(tenant_id) AND EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role::text IN ('bie','bie_manager')));

CREATE POLICY "BIE can review supplier onboarding"
ON public.suppliers FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role::text IN ('bie','bie_manager')) AND (created_by IS NULL OR public.is_same_tenant(created_by)));
