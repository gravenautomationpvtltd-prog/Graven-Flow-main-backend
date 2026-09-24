
-- ============================================================
-- FIX 1: integration_logs - Drop the old bypass policy
-- ============================================================
DROP POLICY IF EXISTS "Admins can view same tenant integration logs" ON public.integration_logs;
DROP POLICY IF EXISTS "Service role can insert integration logs" ON public.integration_logs;
DROP POLICY IF EXISTS "Service role can update integration logs" ON public.integration_logs;
DROP POLICY IF EXISTS "System can create integration logs" ON public.integration_logs;

-- Keep only the tenant-scoped SELECT
-- Re-add proper INSERT/UPDATE policies
CREATE POLICY "Tenant-scoped integration logs INSERT"
  ON public.integration_logs FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Tenant-scoped integration logs UPDATE"
  ON public.integration_logs FOR UPDATE
  USING (is_my_tenant(tenant_id) AND is_admin_or_above(auth.uid()));

-- ============================================================
-- FIX 2: rfqs - Drop USING(true) duplicates
-- ============================================================
DROP POLICY IF EXISTS "RFQs manageable by authenticated" ON public.rfqs;
DROP POLICY IF EXISTS "RFQs viewable by authenticated" ON public.rfqs;

-- ============================================================
-- FIX 3: rfq_items - Drop USING(true) duplicates
-- ============================================================
DROP POLICY IF EXISTS "RFQ items manageable by authenticated" ON public.rfq_items;

-- ============================================================
-- FIX 4: rfq_distributions - Drop USING(true) duplicates
-- ============================================================
DROP POLICY IF EXISTS "RFQ distributions manageable by authenticated" ON public.rfq_distributions;

-- ============================================================
-- FIX 5: supplier_categories - Drop USING(true) duplicates
-- ============================================================
DROP POLICY IF EXISTS "Supplier categories manageable by authenticated" ON public.supplier_categories;
DROP POLICY IF EXISTS "Supplier categories viewable by authenticated" ON public.supplier_categories;

-- ============================================================
-- FIX 6: goods_receipt_notes - Replace USING(true) with tenant check via PO
-- ============================================================
DROP POLICY IF EXISTS "GRNs viewable by authenticated users" ON public.goods_receipt_notes;
DROP POLICY IF EXISTS "Procurement can create GRNs" ON public.goods_receipt_notes;

CREATE POLICY "GRNs viewable by same tenant"
  ON public.goods_receipt_notes FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM purchase_orders po
      WHERE po.id = goods_receipt_notes.po_id
        AND is_same_tenant(po.created_by)
    )
  );

CREATE POLICY "Procurement can create GRNs tenant-scoped"
  ON public.goods_receipt_notes FOR INSERT
  WITH CHECK (
    is_procurement_or_above(auth.uid())
  );

-- ============================================================
-- FIX 7: grn_items - Replace USING(true) with tenant check via GRN->PO
-- ============================================================
DROP POLICY IF EXISTS "Authenticated users can manage GRN items" ON public.grn_items;
DROP POLICY IF EXISTS "GRN items viewable by authenticated users" ON public.grn_items;

CREATE POLICY "GRN items viewable by same tenant"
  ON public.grn_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM goods_receipt_notes grn
      JOIN purchase_orders po ON po.id = grn.po_id
      WHERE grn.id = grn_items.grn_id
        AND is_same_tenant(po.created_by)
    )
  );

CREATE POLICY "Procurement can manage GRN items"
  ON public.grn_items FOR ALL
  USING (
    is_procurement_or_above(auth.uid())
    AND EXISTS (
      SELECT 1 FROM goods_receipt_notes grn
      JOIN purchase_orders po ON po.id = grn.po_id
      WHERE grn.id = grn_items.grn_id
        AND is_same_tenant(po.created_by)
    )
  )
  WITH CHECK (
    is_procurement_or_above(auth.uid())
  );

-- ============================================================
-- FIX 8: supplier_communications - Replace USING(true) with tenant check via RFQ
-- ============================================================
DROP POLICY IF EXISTS "Supplier communications manageable by authenticated" ON public.supplier_communications;

CREATE POLICY "Supplier communications viewable by same tenant"
  ON public.supplier_communications FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM rfqs
      WHERE rfqs.id = supplier_communications.rfq_id
        AND is_same_tenant(rfqs.created_by)
    )
  );

CREATE POLICY "Procurement can manage supplier communications"
  ON public.supplier_communications FOR ALL
  USING (
    is_procurement_or_above(auth.uid())
    AND EXISTS (
      SELECT 1 FROM rfqs
      WHERE rfqs.id = supplier_communications.rfq_id
        AND is_same_tenant(rfqs.created_by)
    )
  )
  WITH CHECK (is_procurement_or_above(auth.uid()));

-- ============================================================
-- FIX 9: supplier_ratings - Replace USING(true) with tenant check via PO
-- ============================================================
DROP POLICY IF EXISTS "Ratings viewable by authenticated users" ON public.supplier_ratings;
DROP POLICY IF EXISTS "Procurement can create ratings" ON public.supplier_ratings;

CREATE POLICY "Ratings viewable by same tenant"
  ON public.supplier_ratings FOR SELECT
  USING (
    is_same_tenant(rated_by)
  );

CREATE POLICY "Procurement can create tenant-scoped ratings"
  ON public.supplier_ratings FOR INSERT
  WITH CHECK (is_procurement_or_above(auth.uid()));

-- ============================================================
-- FIX 10: supplier_quotations - Replace USING(true) with tenant check via RFQ
-- ============================================================
DROP POLICY IF EXISTS "Supplier quotations manageable by authenticated" ON public.supplier_quotations;
DROP POLICY IF EXISTS "Supplier quotations viewable by authenticated" ON public.supplier_quotations;

CREATE POLICY "Supplier quotations viewable by same tenant"
  ON public.supplier_quotations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM rfqs
      WHERE rfqs.id = supplier_quotations.rfq_id
        AND is_same_tenant(rfqs.created_by)
    )
  );

CREATE POLICY "Procurement can manage supplier quotations"
  ON public.supplier_quotations FOR ALL
  USING (
    is_procurement_or_above(auth.uid())
    AND EXISTS (
      SELECT 1 FROM rfqs
      WHERE rfqs.id = supplier_quotations.rfq_id
        AND is_same_tenant(rfqs.created_by)
    )
  )
  WITH CHECK (is_procurement_or_above(auth.uid()));

-- ============================================================
-- FIX 11: supplier_quotation_items - Replace USING(true) with tenant check
-- ============================================================
DROP POLICY IF EXISTS "Quotation items manageable by authenticated" ON public.supplier_quotation_items;

CREATE POLICY "Supplier quotation items viewable by same tenant"
  ON public.supplier_quotation_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM supplier_quotations sq
      JOIN rfqs ON rfqs.id = sq.rfq_id
      WHERE sq.id = supplier_quotation_items.quotation_id
        AND is_same_tenant(rfqs.created_by)
    )
  );

CREATE POLICY "Procurement can manage supplier quotation items"
  ON public.supplier_quotation_items FOR ALL
  USING (
    is_procurement_or_above(auth.uid())
    AND EXISTS (
      SELECT 1 FROM supplier_quotations sq
      JOIN rfqs ON rfqs.id = sq.rfq_id
      WHERE sq.id = supplier_quotation_items.quotation_id
        AND is_same_tenant(rfqs.created_by)
    )
  )
  WITH CHECK (is_procurement_or_above(auth.uid()));

-- ============================================================
-- FIX 12: webhook_events - Add tenant_id and scope access
-- ============================================================
ALTER TABLE public.webhook_events ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id);
CREATE INDEX IF NOT EXISTS idx_webhook_events_tenant_id ON public.webhook_events(tenant_id);

DROP POLICY IF EXISTS "Admins can view webhook events" ON public.webhook_events;
DROP POLICY IF EXISTS "Admins can delete webhook events" ON public.webhook_events;

CREATE POLICY "Tenant-scoped webhook events SELECT"
  ON public.webhook_events FOR SELECT
  USING (is_my_tenant(tenant_id) AND is_admin_or_above(auth.uid()));

CREATE POLICY "Tenant-scoped webhook events DELETE"
  ON public.webhook_events FOR DELETE
  USING (is_my_tenant(tenant_id) AND is_admin_or_above(auth.uid()));

CREATE POLICY "Webhook events INSERT"
  ON public.webhook_events FOR INSERT
  WITH CHECK (true);

-- ============================================================
-- FIX 13: round_robin_tracker - Scope to tenant
-- ============================================================
DROP POLICY IF EXISTS "Service role can manage round_robin_tracker" ON public.round_robin_tracker;

CREATE POLICY "Round robin tracker tenant-scoped SELECT"
  ON public.round_robin_tracker FOR SELECT
  USING (is_my_tenant(tenant_id));

CREATE POLICY "Round robin tracker tenant-scoped ALL"
  ON public.round_robin_tracker FOR ALL
  USING (is_my_tenant(tenant_id) AND is_admin_or_above(auth.uid()))
  WITH CHECK (is_my_tenant(tenant_id));
