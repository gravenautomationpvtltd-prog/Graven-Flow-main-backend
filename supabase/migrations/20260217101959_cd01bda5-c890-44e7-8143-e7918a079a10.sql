
-- =============================================
-- STAGE 1: Multi-Tenancy Database Foundation
-- =============================================

-- 1. Create enums
CREATE TYPE public.subscription_status AS ENUM ('trial', 'active', 'expired', 'cancelled');
CREATE TYPE public.subscription_plan_type AS ENUM ('monthly', 'half_yearly', 'annual');
CREATE TYPE public.subscription_payment_status AS ENUM ('active', 'expired', 'cancelled', 'pending');
CREATE TYPE public.tenant_user_role AS ENUM ('owner', 'admin', 'member');

-- 2. Create tenants table
CREATE TABLE public.tenants (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_name TEXT NOT NULL,
  logo_url TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  country TEXT DEFAULT 'India',
  phone TEXT,
  email TEXT,
  website TEXT,
  gst_number TEXT,
  industry TEXT,
  subscription_status public.subscription_status NOT NULL DEFAULT 'trial',
  trial_start_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  trial_end_date TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '30 days'),
  max_users INTEGER NOT NULL DEFAULT 5,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Create tenant_subscriptions table
CREATE TABLE public.tenant_subscriptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  plan_type public.subscription_plan_type NOT NULL,
  user_count INTEGER NOT NULL DEFAULT 1,
  price_per_user NUMERIC(10,2) NOT NULL,
  total_amount NUMERIC(10,2) NOT NULL,
  payment_status public.subscription_payment_status NOT NULL DEFAULT 'pending',
  razorpay_order_id TEXT,
  razorpay_payment_id TEXT,
  razorpay_subscription_id TEXT,
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Create tenant_users table
CREATE TABLE public.tenant_users (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.tenant_user_role NOT NULL DEFAULT 'member',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, user_id)
);

-- 5. Add tenant_id to profiles (nullable for backward compatibility)
ALTER TABLE public.profiles ADD COLUMN tenant_id UUID REFERENCES public.tenants(id);

-- 6. Create indexes
CREATE INDEX idx_tenant_users_user_id ON public.tenant_users(user_id);
CREATE INDEX idx_tenant_users_tenant_id ON public.tenant_users(tenant_id);
CREATE INDEX idx_tenant_subscriptions_tenant_id ON public.tenant_subscriptions(tenant_id);
CREATE INDEX idx_profiles_tenant_id ON public.profiles(tenant_id);

-- 7. Security definer functions

-- Get the tenant_id for a given user
CREATE OR REPLACE FUNCTION public.get_user_tenant_id(_user_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT tenant_id FROM public.tenant_users
  WHERE user_id = _user_id AND is_active = true
  LIMIT 1
$$;

-- Check if user has a specific tenant role
CREATE OR REPLACE FUNCTION public.has_tenant_role(_user_id UUID, _role public.tenant_user_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.tenant_users
    WHERE user_id = _user_id
      AND role = _role
      AND is_active = true
  )
$$;

-- Check if user is owner or admin of their tenant
CREATE OR REPLACE FUNCTION public.is_tenant_owner_or_admin(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.tenant_users
    WHERE user_id = _user_id
      AND role IN ('owner', 'admin')
      AND is_active = true
  )
$$;

-- 8. Enable RLS on all new tables
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_users ENABLE ROW LEVEL SECURITY;

-- 9. RLS policies for tenants
CREATE POLICY "Users can view their own tenant"
  ON public.tenants FOR SELECT
  TO authenticated
  USING (id = public.get_user_tenant_id(auth.uid()));

CREATE POLICY "Tenant owners/admins can update their tenant"
  ON public.tenants FOR UPDATE
  TO authenticated
  USING (id = public.get_user_tenant_id(auth.uid()) AND public.is_tenant_owner_or_admin(auth.uid()));

CREATE POLICY "Authenticated users can create tenants"
  ON public.tenants FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- 10. RLS policies for tenant_subscriptions
CREATE POLICY "Users can view their tenant subscriptions"
  ON public.tenant_subscriptions FOR SELECT
  TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid()));

CREATE POLICY "Tenant owners/admins can insert subscriptions"
  ON public.tenant_subscriptions FOR INSERT
  TO authenticated
  WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()) AND public.is_tenant_owner_or_admin(auth.uid()));

CREATE POLICY "Tenant owners/admins can update subscriptions"
  ON public.tenant_subscriptions FOR UPDATE
  TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid()) AND public.is_tenant_owner_or_admin(auth.uid()));

-- 11. RLS policies for tenant_users
CREATE POLICY "Users can view members of their tenant"
  ON public.tenant_users FOR SELECT
  TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid()));

CREATE POLICY "Tenant owners/admins can insert members"
  ON public.tenant_users FOR INSERT
  TO authenticated
  WITH CHECK (
    tenant_id = public.get_user_tenant_id(auth.uid()) AND public.is_tenant_owner_or_admin(auth.uid())
    OR NOT EXISTS (SELECT 1 FROM public.tenant_users WHERE user_id = auth.uid())
  );

CREATE POLICY "Tenant owners/admins can update members"
  ON public.tenant_users FOR UPDATE
  TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid()) AND public.is_tenant_owner_or_admin(auth.uid()));

CREATE POLICY "Tenant owners/admins can delete members"
  ON public.tenant_users FOR DELETE
  TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid()) AND public.is_tenant_owner_or_admin(auth.uid()));

-- 12. Updated_at triggers
CREATE TRIGGER update_tenants_updated_at
  BEFORE UPDATE ON public.tenants
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_tenant_subscriptions_updated_at
  BEFORE UPDATE ON public.tenant_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_tenant_users_updated_at
  BEFORE UPDATE ON public.tenant_users
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 13. Create tenant-logos storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('tenant-logos', 'tenant-logos', true);

-- Storage policies for tenant-logos
CREATE POLICY "Tenant logos are publicly accessible"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'tenant-logos');

CREATE POLICY "Authenticated users can upload tenant logos"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'tenant-logos');

CREATE POLICY "Tenant owners/admins can update logos"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'tenant-logos');

CREATE POLICY "Tenant owners/admins can delete logos"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'tenant-logos');
