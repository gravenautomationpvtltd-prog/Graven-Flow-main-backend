-- Create a new function that includes procurement role
CREATE OR REPLACE FUNCTION public.is_procurement_or_above(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('super_admin', 'coo', 'manager', 'procurement')
  )
$$;

-- Drop existing restrictive policy
DROP POLICY IF EXISTS "Procurement and managers can manage suppliers" ON suppliers;

-- Create new policy that includes procurement role
CREATE POLICY "Procurement and managers can manage suppliers"
ON suppliers
FOR ALL
USING (is_procurement_or_above(auth.uid()));