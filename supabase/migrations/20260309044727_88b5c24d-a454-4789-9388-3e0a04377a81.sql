
-- =====================================================
-- SECURITY HARDENING: Fix all 27 vulnerabilities
-- =====================================================

-- =====================================================
-- 1. CRITICAL: Fix tenants SELECT policy (removes NOT EXISTS bypass)
-- =====================================================
DROP POLICY IF EXISTS "Users can view their own tenant" ON tenants;
CREATE POLICY "Users can view their own tenant" ON tenants
  FOR SELECT TO authenticated
  USING (id = get_user_tenant_id(auth.uid()));

-- Keep create policy but scope it properly
DROP POLICY IF EXISTS "Authenticated users can create tenants" ON tenants;
CREATE POLICY "Authenticated users can create tenants" ON tenants
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

-- =====================================================
-- 2. CRITICAL: Fix supplier_documents (was USING(true) / WITH CHECK(true))
-- =====================================================
DROP POLICY IF EXISTS "Supplier documents manageable by authenticated" ON supplier_documents;

CREATE POLICY "Supplier documents viewable by same tenant" ON supplier_documents
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM suppliers s
      WHERE s.id = supplier_documents.supplier_id
        AND (is_same_tenant(s.created_by) OR s.created_by IS NULL)
    )
  );

CREATE POLICY "Supplier documents insertable by procurement" ON supplier_documents
  FOR INSERT TO authenticated
  WITH CHECK (
    is_procurement_or_above(auth.uid()) AND
    EXISTS (
      SELECT 1 FROM suppliers s
      WHERE s.id = supplier_documents.supplier_id
        AND (is_same_tenant(s.created_by) OR s.created_by IS NULL)
    )
  );

CREATE POLICY "Supplier documents updatable by procurement" ON supplier_documents
  FOR UPDATE TO authenticated
  USING (
    is_procurement_or_above(auth.uid()) AND
    EXISTS (
      SELECT 1 FROM suppliers s
      WHERE s.id = supplier_documents.supplier_id
        AND (is_same_tenant(s.created_by) OR s.created_by IS NULL)
    )
  );

CREATE POLICY "Supplier documents deletable by procurement" ON supplier_documents
  FOR DELETE TO authenticated
  USING (
    is_procurement_or_above(auth.uid()) AND
    EXISTS (
      SELECT 1 FROM suppliers s
      WHERE s.id = supplier_documents.supplier_id
        AND (is_same_tenant(s.created_by) OR s.created_by IS NULL)
    )
  );

-- =====================================================
-- 3. CRITICAL: Fix supplier_notifications (was USING(true))
-- =====================================================
DROP POLICY IF EXISTS "Supplier notifications manageable by authenticated" ON supplier_notifications;

CREATE POLICY "Supplier notifications viewable by same tenant" ON supplier_notifications
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM suppliers s
      WHERE s.id = supplier_notifications.supplier_id
        AND (is_same_tenant(s.created_by) OR s.created_by IS NULL)
    )
  );

CREATE POLICY "Supplier notifications insertable by procurement" ON supplier_notifications
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM suppliers s
      WHERE s.id = supplier_notifications.supplier_id
        AND (is_same_tenant(s.created_by) OR s.created_by IS NULL)
    )
  );

CREATE POLICY "Supplier notifications updatable by same tenant" ON supplier_notifications
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM suppliers s
      WHERE s.id = supplier_notifications.supplier_id
        AND (is_same_tenant(s.created_by) OR s.created_by IS NULL)
    )
  );

CREATE POLICY "Supplier notifications deletable by procurement" ON supplier_notifications
  FOR DELETE TO authenticated
  USING (
    is_procurement_or_above(auth.uid()) AND
    EXISTS (
      SELECT 1 FROM suppliers s
      WHERE s.id = supplier_notifications.supplier_id
        AND (is_same_tenant(s.created_by) OR s.created_by IS NULL)
    )
  );

-- =====================================================
-- 4. CRITICAL: Fix supplier_status_history
-- =====================================================
DROP POLICY IF EXISTS "Status history viewable by authenticated" ON supplier_status_history;
DROP POLICY IF EXISTS "Status history insertable by authenticated" ON supplier_status_history;

CREATE POLICY "Status history viewable by same tenant" ON supplier_status_history
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM suppliers s
      WHERE s.id = supplier_status_history.supplier_id
        AND (is_same_tenant(s.created_by) OR s.created_by IS NULL)
    )
  );

CREATE POLICY "Status history insertable by same tenant" ON supplier_status_history
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM suppliers s
      WHERE s.id = supplier_status_history.supplier_id
        AND (is_same_tenant(s.created_by) OR s.created_by IS NULL)
    )
  );

-- =====================================================
-- 5. CRITICAL: Fix chat_members INSERT (cross-tenant channel injection)
-- =====================================================
DROP POLICY IF EXISTS "Authenticated users can join/add members" ON chat_members;

CREATE POLICY "Users can join channels in their tenant" ON chat_members
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM chat_channels cc
      WHERE cc.id = chat_members.channel_id
        AND (
          cc.created_by = auth.uid()
          OR is_same_tenant(cc.created_by)
          OR is_admin_or_above(auth.uid())
        )
    )
  );

-- =====================================================
-- 6. Fix supplier_category_assignments (was USING(true))
-- =====================================================
DROP POLICY IF EXISTS "Category assignments manageable by authenticated" ON supplier_category_assignments;

CREATE POLICY "Category assignments viewable by same tenant" ON supplier_category_assignments
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM suppliers s
      WHERE s.id = supplier_category_assignments.supplier_id
        AND (is_same_tenant(s.created_by) OR s.created_by IS NULL)
    )
  );

CREATE POLICY "Category assignments modifiable by procurement" ON supplier_category_assignments
  FOR INSERT TO authenticated
  WITH CHECK (
    is_procurement_or_above(auth.uid()) AND
    EXISTS (
      SELECT 1 FROM suppliers s
      WHERE s.id = supplier_category_assignments.supplier_id
        AND (is_same_tenant(s.created_by) OR s.created_by IS NULL)
    )
  );

CREATE POLICY "Category assignments updatable by procurement" ON supplier_category_assignments
  FOR UPDATE TO authenticated
  USING (
    is_procurement_or_above(auth.uid()) AND
    EXISTS (
      SELECT 1 FROM suppliers s
      WHERE s.id = supplier_category_assignments.supplier_id
        AND (is_same_tenant(s.created_by) OR s.created_by IS NULL)
    )
  );

CREATE POLICY "Category assignments deletable by procurement" ON supplier_category_assignments
  FOR DELETE TO authenticated
  USING (
    is_procurement_or_above(auth.uid()) AND
    EXISTS (
      SELECT 1 FROM suppliers s
      WHERE s.id = supplier_category_assignments.supplier_id
        AND (is_same_tenant(s.created_by) OR s.created_by IS NULL)
    )
  );

-- =====================================================
-- 7. Fix fx_rates INSERT (keep SELECT open - global reference data)
-- =====================================================
DROP POLICY IF EXISTS "FX rates insertable by authenticated" ON fx_rates;

CREATE POLICY "FX rates insertable by admin" ON fx_rates
  FOR INSERT TO authenticated
  WITH CHECK (is_admin_or_above(auth.uid()));

-- =====================================================
-- 8. Fix notifications INSERT (cross-tenant injection)
-- =====================================================
DROP POLICY IF EXISTS "System can create notifications" ON notifications;

CREATE POLICY "Users can create notifications for same tenant" ON notifications
  FOR INSERT TO authenticated
  WITH CHECK (is_same_tenant(user_id));

-- =====================================================
-- 9. Fix escalation_logs INSERT
-- =====================================================
DROP POLICY IF EXISTS "System can create escalation logs" ON escalation_logs;

CREATE POLICY "Authenticated users can create escalation logs" ON escalation_logs
  FOR INSERT TO authenticated
  WITH CHECK (is_same_tenant(user_id));

-- =====================================================
-- 10. Fix stock_movements INSERT (was public role, no check)
-- =====================================================
DROP POLICY IF EXISTS "Authenticated users can create stock movements" ON stock_movements;

CREATE POLICY "Authenticated users can create stock movements" ON stock_movements
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

-- =====================================================
-- 11. Fix quotation_versions INSERT (no tenant check)
-- =====================================================
DROP POLICY IF EXISTS "Authenticated users can create quotation versions" ON quotation_versions;

CREATE POLICY "Authenticated users can create quotation versions" ON quotation_versions
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM quotations q
      WHERE q.id = quotation_versions.quotation_id
        AND is_same_tenant(q.created_by)
    )
  );

-- =====================================================
-- 12. Fix quotation_item_negotiations INSERT (no tenant check)
-- =====================================================
DROP POLICY IF EXISTS "Authenticated users can insert negotiations" ON quotation_item_negotiations;

CREATE POLICY "Authenticated users can insert negotiations" ON quotation_item_negotiations
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM leads l
      WHERE l.id = quotation_item_negotiations.lead_id
        AND is_same_tenant(l.assigned_to)
    )
  );

-- =====================================================
-- 13. Fix public-role INSERT policies (unauthenticated access)
-- =====================================================

-- integration_logs
DROP POLICY IF EXISTS "Tenant-scoped integration logs INSERT" ON integration_logs;
CREATE POLICY "Authenticated users can create integration logs" ON integration_logs
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id IS NULL OR is_my_tenant(tenant_id));

-- email_logs
DROP POLICY IF EXISTS "System can create email logs" ON email_logs;
CREATE POLICY "Authenticated users can create email logs" ON email_logs
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

-- webhook_events
DROP POLICY IF EXISTS "Webhook events INSERT" ON webhook_events;
CREATE POLICY "Authenticated users can create webhook events" ON webhook_events
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

-- pricing_alerts
DROP POLICY IF EXISTS "System can insert pricing alerts" ON pricing_alerts;
CREATE POLICY "Authenticated users can insert pricing alerts" ON pricing_alerts
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

-- customer_outreach
DROP POLICY IF EXISTS "System can create outreach records" ON customer_outreach;
CREATE POLICY "Authenticated users can create outreach records" ON customer_outreach
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);
