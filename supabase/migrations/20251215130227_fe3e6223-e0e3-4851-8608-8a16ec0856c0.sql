-- Drop existing policy
DROP POLICY IF EXISTS "Lead visibility by office and assignment" ON leads;

-- Create new policy with proper sales user restriction
-- Sales users only see leads assigned to them
-- Managers and above can see all leads
CREATE POLICY "Lead visibility by office and assignment" ON leads
FOR SELECT USING (
  -- Managers and above can see all leads
  is_manager_or_above(auth.uid())
  
  -- Users can see leads assigned to them
  OR (assigned_to = auth.uid())
);