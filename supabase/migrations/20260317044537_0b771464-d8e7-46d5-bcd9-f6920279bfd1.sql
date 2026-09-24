
DROP POLICY IF EXISTS "Customer payments viewable by same tenant" ON customer_payments;
DROP POLICY IF EXISTS "Sales and above can create payments" ON customer_payments;
DROP POLICY IF EXISTS "Sales and above can update payments" ON customer_payments;
DROP POLICY IF EXISTS "Admins can delete payments" ON customer_payments;

CREATE POLICY "Customer payments viewable by same tenant" ON customer_payments
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM customers c
      WHERE c.id = customer_payments.customer_id
        AND is_my_tenant(c.tenant_id)
    )
  );

CREATE POLICY "Sales and above can create payments" ON customer_payments
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM customers c
      WHERE c.id = customer_payments.customer_id
        AND is_my_tenant(c.tenant_id)
    )
  );

CREATE POLICY "Sales and above can update payments" ON customer_payments
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM customers c
      WHERE c.id = customer_payments.customer_id
        AND is_my_tenant(c.tenant_id)
    )
  );

CREATE POLICY "Admins can delete payments" ON customer_payments
  FOR DELETE TO authenticated
  USING (
    is_admin_or_above(auth.uid())
    AND EXISTS (
      SELECT 1 FROM customers c
      WHERE c.id = customer_payments.customer_id
        AND is_my_tenant(c.tenant_id)
    )
  );
