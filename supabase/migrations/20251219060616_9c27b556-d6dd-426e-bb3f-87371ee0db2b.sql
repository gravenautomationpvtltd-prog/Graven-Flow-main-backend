-- Add DELETE policy for email_logs (Admins only)
CREATE POLICY "Admins can delete email logs"
  ON email_logs
  FOR DELETE
  TO authenticated
  USING (is_admin_or_above(auth.uid()));

-- Add DELETE policy for supplier_ratings (Admins only)  
CREATE POLICY "Admins can delete supplier ratings"
  ON supplier_ratings
  FOR DELETE
  TO authenticated
  USING (is_admin_or_above(auth.uid()));