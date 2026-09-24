
-- =====================================================
-- Add tenant_id to leads, quotations, sales_orders
-- =====================================================

-- 1. ADD COLUMNS
ALTER TABLE public.leads ADD COLUMN tenant_id UUID REFERENCES public.tenants(id);
ALTER TABLE public.quotations ADD COLUMN tenant_id UUID REFERENCES public.tenants(id);
ALTER TABLE public.sales_orders ADD COLUMN tenant_id UUID REFERENCES public.tenants(id);

-- 2. BACKFILL leads from assigned_to -> tenant_users
UPDATE public.leads l
SET tenant_id = tu.tenant_id
FROM public.tenant_users tu
WHERE l.assigned_to = tu.user_id AND tu.is_active = true AND l.tenant_id IS NULL;

-- Fallback: assign remaining to Graven Automation legacy tenant
UPDATE public.leads SET tenant_id = '1a5184ef-5138-4327-8928-67bc4f229131'
WHERE tenant_id IS NULL;

-- 3. BACKFILL quotations from created_by -> tenant_users
UPDATE public.quotations q
SET tenant_id = tu.tenant_id
FROM public.tenant_users tu
WHERE q.created_by = tu.user_id AND tu.is_active = true AND q.tenant_id IS NULL;

-- Fallback
UPDATE public.quotations SET tenant_id = '1a5184ef-5138-4327-8928-67bc4f229131'
WHERE tenant_id IS NULL;

-- 4. BACKFILL sales_orders from created_by -> tenant_users
UPDATE public.sales_orders so
SET tenant_id = tu.tenant_id
FROM public.tenant_users tu
WHERE so.created_by = tu.user_id AND tu.is_active = true AND so.tenant_id IS NULL;

-- Fallback
UPDATE public.sales_orders SET tenant_id = '1a5184ef-5138-4327-8928-67bc4f229131'
WHERE tenant_id IS NULL;

-- 5. CREATE INDEXES
CREATE INDEX idx_leads_tenant_id ON public.leads(tenant_id);
CREATE INDEX idx_quotations_tenant_id ON public.quotations(tenant_id);
CREATE INDEX idx_sales_orders_tenant_id ON public.sales_orders(tenant_id);

-- =====================================================
-- 6. FIX RLS POLICIES - LEADS
-- =====================================================
DROP POLICY IF EXISTS "Lead visibility by role hierarchy" ON public.leads;
CREATE POLICY "Lead visibility by role hierarchy" ON public.leads
  FOR SELECT TO authenticated
  USING (
    is_my_tenant(tenant_id)
    AND (
      is_admin_or_above(auth.uid())
      OR assigned_to = auth.uid()
      OR (is_manager_or_above(auth.uid()) AND assigned_to = ANY(get_subordinate_ids(auth.uid())))
    )
  );

DROP POLICY IF EXISTS "Authenticated users can create leads" ON public.leads;
CREATE POLICY "Authenticated users can create leads" ON public.leads
  FOR INSERT TO authenticated
  WITH CHECK (
    is_my_tenant(tenant_id)
  );

DROP POLICY IF EXISTS "Users can update leads they can access" ON public.leads;
CREATE POLICY "Users can update leads they can access" ON public.leads
  FOR UPDATE TO authenticated
  USING (
    is_my_tenant(tenant_id)
    AND (
      is_admin_or_above(auth.uid())
      OR assigned_to = auth.uid()
      OR is_manager_or_above(auth.uid())
    )
  )
  WITH CHECK (
    is_my_tenant(tenant_id)
    AND (
      is_admin_or_above(auth.uid())
      OR assigned_to = auth.uid()
      OR is_manager_or_above(auth.uid())
    )
  );

DROP POLICY IF EXISTS "Admins can delete leads" ON public.leads;
CREATE POLICY "Admins can delete leads" ON public.leads
  FOR DELETE TO authenticated
  USING (
    is_my_tenant(tenant_id)
    AND is_admin_or_above(auth.uid())
  );

-- =====================================================
-- 7. FIX RLS POLICIES - QUOTATIONS
-- =====================================================
DROP POLICY IF EXISTS "Quotations viewable by authenticated users" ON public.quotations;
CREATE POLICY "Quotations viewable by authenticated users" ON public.quotations
  FOR SELECT TO authenticated
  USING (
    is_my_tenant(tenant_id)
  );

DROP POLICY IF EXISTS "Authenticated users can create quotations" ON public.quotations;
CREATE POLICY "Authenticated users can create quotations" ON public.quotations
  FOR INSERT TO authenticated
  WITH CHECK (
    is_my_tenant(tenant_id)
  );

DROP POLICY IF EXISTS "Creator and managers can update quotations" ON public.quotations;
CREATE POLICY "Creator and managers can update quotations" ON public.quotations
  FOR UPDATE TO authenticated
  USING (
    is_my_tenant(tenant_id)
    AND (created_by = auth.uid() OR is_manager_or_above(auth.uid()))
  );

DROP POLICY IF EXISTS "Admins can delete quotations" ON public.quotations;
CREATE POLICY "Admins can delete quotations" ON public.quotations
  FOR DELETE TO authenticated
  USING (
    is_my_tenant(tenant_id)
    AND is_admin_or_above(auth.uid())
  );

-- =====================================================
-- 8. FIX RLS POLICIES - SALES_ORDERS
-- =====================================================
DROP POLICY IF EXISTS "Sales orders viewable by authenticated users" ON public.sales_orders;
CREATE POLICY "Sales orders viewable by authenticated users" ON public.sales_orders
  FOR SELECT TO authenticated
  USING (
    is_my_tenant(tenant_id)
  );

DROP POLICY IF EXISTS "Sales can create orders" ON public.sales_orders;
CREATE POLICY "Sales can create orders" ON public.sales_orders
  FOR INSERT TO authenticated
  WITH CHECK (
    is_my_tenant(tenant_id)
  );

DROP POLICY IF EXISTS "Creator and managers can update orders" ON public.sales_orders;
CREATE POLICY "Creator and managers can update orders" ON public.sales_orders
  FOR UPDATE TO authenticated
  USING (
    is_my_tenant(tenant_id)
    AND (created_by = auth.uid() OR is_manager_or_above(auth.uid()) OR is_procurement_or_above(auth.uid()))
  );

DROP POLICY IF EXISTS "Admins can delete orders" ON public.sales_orders;
CREATE POLICY "Admins can delete orders" ON public.sales_orders
  FOR DELETE TO authenticated
  USING (
    is_my_tenant(tenant_id)
    AND is_admin_or_above(auth.uid())
  );
