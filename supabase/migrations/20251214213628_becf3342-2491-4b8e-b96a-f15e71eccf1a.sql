-- Drop existing policies
DROP POLICY IF EXISTS "Admins can manage lead assignment rules" ON lead_assignment_rules;
DROP POLICY IF EXISTS "Authenticated users can view assignment rules" ON lead_assignment_rules;

-- New SELECT policy: Managers see only their branch rules, Admins see all
CREATE POLICY "View lead assignment rules by office"
ON lead_assignment_rules FOR SELECT
TO authenticated
USING (
  is_admin_or_above(auth.uid()) 
  OR (
    is_manager_or_above(auth.uid()) 
    AND assigned_office_id = (SELECT office_id FROM profiles WHERE id = auth.uid())
  )
);

-- New INSERT policy: Managers can create rules for their branch only
CREATE POLICY "Create lead assignment rules by office"
ON lead_assignment_rules FOR INSERT
TO authenticated
WITH CHECK (
  is_admin_or_above(auth.uid()) 
  OR (
    is_manager_or_above(auth.uid()) 
    AND assigned_office_id = (SELECT office_id FROM profiles WHERE id = auth.uid())
  )
);

-- New UPDATE policy: Managers can update their branch rules only
CREATE POLICY "Update lead assignment rules by office"
ON lead_assignment_rules FOR UPDATE
TO authenticated
USING (
  is_admin_or_above(auth.uid()) 
  OR (
    is_manager_or_above(auth.uid()) 
    AND assigned_office_id = (SELECT office_id FROM profiles WHERE id = auth.uid())
  )
);

-- New DELETE policy: Managers can delete their branch rules only
CREATE POLICY "Delete lead assignment rules by office"
ON lead_assignment_rules FOR DELETE
TO authenticated
USING (
  is_admin_or_above(auth.uid()) 
  OR (
    is_manager_or_above(auth.uid()) 
    AND assigned_office_id = (SELECT office_id FROM profiles WHERE id = auth.uid())
  )
);