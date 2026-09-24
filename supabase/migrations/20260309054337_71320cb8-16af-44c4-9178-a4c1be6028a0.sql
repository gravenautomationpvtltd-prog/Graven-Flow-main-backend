
-- ============================================================
-- PHASE 2: Remaining security fixes
-- ============================================================

-- 1. FIX: suppliers SELECT – scope via created_by
DROP POLICY IF EXISTS "Authenticated users can view suppliers" ON suppliers;
DROP POLICY IF EXISTS "Tenant users can view suppliers" ON suppliers;
CREATE POLICY "Tenant users can view suppliers" ON suppliers
  FOR SELECT TO authenticated
  USING (
    is_same_tenant(created_by)
    OR created_by IS NULL
    OR is_admin_or_above(auth.uid())
  );

-- 2. FIX: goods_receipt_notes – scope writes via PO creator
DROP POLICY IF EXISTS "Authenticated users can create GRNs" ON goods_receipt_notes;
CREATE POLICY "Tenant users can create GRNs" ON goods_receipt_notes
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM purchase_orders po
      WHERE po.id = po_id AND is_same_tenant(po.created_by)
    )
  );

DROP POLICY IF EXISTS "Authenticated users can update GRNs" ON goods_receipt_notes;
CREATE POLICY "Tenant users can update GRNs" ON goods_receipt_notes
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM purchase_orders po
      WHERE po.id = po_id AND is_same_tenant(po.created_by)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM purchase_orders po
      WHERE po.id = po_id AND is_same_tenant(po.created_by)
    )
  );

-- 3. FIX: stock_movements – scope INSERT to authenticated + tenant product
DROP POLICY IF EXISTS "Anyone can insert stock movements" ON stock_movements;
CREATE POLICY "Authenticated users can insert stock movements" ON stock_movements
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM products p
      WHERE p.id = product_id AND is_my_tenant(p.tenant_id)
    )
  );

-- 4. FIX: supplier_ratings – scope via PO creator
DROP POLICY IF EXISTS "Authenticated users can create ratings" ON supplier_ratings;
CREATE POLICY "Tenant users can create ratings" ON supplier_ratings
  FOR INSERT TO authenticated
  WITH CHECK (
    po_id IS NULL
    OR EXISTS (
      SELECT 1 FROM purchase_orders po
      WHERE po.id = po_id AND is_same_tenant(po.created_by)
    )
  );

-- 5. FIX: user_roles – prevent cross-tenant role modifications
DROP POLICY IF EXISTS "Admins can manage user roles" ON user_roles;
CREATE POLICY "Admins can manage same-tenant user roles" ON user_roles
  FOR ALL TO authenticated
  USING (
    is_admin_or_above(auth.uid()) AND is_same_tenant(user_id)
  )
  WITH CHECK (
    is_admin_or_above(auth.uid()) AND is_same_tenant(user_id)
  );

DROP POLICY IF EXISTS "Users can view own roles" ON user_roles;
CREATE POLICY "Users can view own roles" ON user_roles
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- 6. FIX: activity_logs – scope to same tenant
DROP POLICY IF EXISTS "Authenticated users can view activity logs" ON activity_logs;
CREATE POLICY "Tenant users can view activity logs" ON activity_logs
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR is_same_tenant(user_id)
    OR is_admin_or_above(auth.uid())
  );

DROP POLICY IF EXISTS "Authenticated users can create activity logs" ON activity_logs;
CREATE POLICY "Users can create own activity logs" ON activity_logs
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() OR user_id IS NULL);

-- FIX: webhook_events – restrict SELECT to tenant
DROP POLICY IF EXISTS "Anyone can insert webhook events" ON webhook_events;
CREATE POLICY "Authenticated can insert webhook events" ON webhook_events
  FOR INSERT TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can view webhook events" ON webhook_events;
CREATE POLICY "Tenant users can view webhook events" ON webhook_events
  FOR SELECT TO authenticated
  USING (
    tenant_id IS NULL OR is_my_tenant(tenant_id)
  );
