-- Create lead_assignment_rules table for location-based assignment
CREATE TABLE public.lead_assignment_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_name TEXT NOT NULL,
  state TEXT,
  city TEXT,
  country TEXT DEFAULT 'India',
  assigned_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  assigned_office_id UUID REFERENCES offices(id) ON DELETE SET NULL,
  priority INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.lead_assignment_rules ENABLE ROW LEVEL SECURITY;

-- Only admins can manage assignment rules
CREATE POLICY "Admins can manage lead assignment rules"
ON public.lead_assignment_rules
FOR ALL
USING (is_admin_or_above(auth.uid()));

-- All authenticated users can view active rules (needed for edge functions via service role)
CREATE POLICY "Authenticated users can view assignment rules"
ON public.lead_assignment_rules
FOR SELECT
USING (true);

-- Create trigger for updated_at
CREATE TRIGGER update_lead_assignment_rules_updated_at
BEFORE UPDATE ON public.lead_assignment_rules
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create helper function to get Lucknow office ID
CREATE OR REPLACE FUNCTION public.get_lucknow_office_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM offices WHERE location = 'lucknow' LIMIT 1
$$;

-- Create helper function to get Delhi office ID
CREATE OR REPLACE FUNCTION public.get_delhi_office_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM offices WHERE location = 'delhi' LIMIT 1
$$;

-- Create function to check if user is in Lucknow office
CREATE OR REPLACE FUNCTION public.is_lucknow_user(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles p
    JOIN offices o ON p.office_id = o.id
    WHERE p.id = _user_id AND o.location = 'lucknow'
  )
$$;

-- Drop existing SELECT policy on leads
DROP POLICY IF EXISTS "Leads are viewable by authenticated users" ON public.leads;

-- Create new office-based visibility policy for leads
-- Lucknow users see: all external leads + leads assigned to them + leads in Lucknow office
-- Delhi users see: only leads assigned to them
-- Managers/Admins see: everything
CREATE POLICY "Lead visibility by office and assignment"
ON public.leads
FOR SELECT
USING (
  -- Managers and above see everything
  is_manager_or_above(auth.uid())
  OR
  -- User is assigned to this lead
  assigned_to = auth.uid()
  OR
  -- Lucknow users can see all external source leads and Lucknow office leads
  (
    is_lucknow_user(auth.uid())
    AND (
      source != 'manual'
      OR office_id = get_lucknow_office_id()
    )
  )
);