-- Drop existing restrictive UPDATE policy on leads
DROP POLICY IF EXISTS "Assigned users and managers can update leads" ON leads;

-- Create new policy that allows updates by anyone who can view the lead
CREATE POLICY "Users can update leads they can access" ON leads FOR UPDATE
USING (
  is_admin_or_above(auth.uid()) OR 
  assigned_to = auth.uid() OR 
  is_manager_or_above(auth.uid())
)
WITH CHECK (
  is_admin_or_above(auth.uid()) OR 
  assigned_to = auth.uid() OR 
  is_manager_or_above(auth.uid())
);