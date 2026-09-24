-- Create function to get all subordinate IDs for a manager
CREATE OR REPLACE FUNCTION public.get_subordinate_ids(_manager_id uuid)
RETURNS uuid[]
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(
    array_agg(id),
    ARRAY[]::uuid[]
  )
  FROM public.profiles
  WHERE manager_id = _manager_id
    AND is_active = true
$$;

-- Drop existing leads SELECT policies
DROP POLICY IF EXISTS "Users can view leads they are assigned to" ON public.leads;
DROP POLICY IF EXISTS "Managers can view all leads" ON public.leads;
DROP POLICY IF EXISTS "Lead visibility by office and assignment" ON public.leads;
DROP POLICY IF EXISTS "Lead visibility by role hierarchy" ON public.leads;

-- Create new policy that enforces manager-subordinate hierarchy
CREATE POLICY "Lead visibility by role hierarchy"
ON public.leads
FOR SELECT
USING (
  -- Super admins and COO see everything
  is_admin_or_above(auth.uid())
  OR
  -- User is directly assigned to this lead
  assigned_to = auth.uid()
  OR
  -- Managers see leads assigned to their direct reports
  (
    is_manager_or_above(auth.uid()) 
    AND assigned_to = ANY(get_subordinate_ids(auth.uid()))
  )
);