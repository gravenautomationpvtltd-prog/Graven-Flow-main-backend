
-- Step 1: Add tenant_id column
ALTER TABLE public.customers ADD COLUMN tenant_id UUID REFERENCES public.tenants(id);

-- Step 2: Backfill from assigned_sales_id → tenant_users
UPDATE public.customers c
SET tenant_id = (
  SELECT tu.tenant_id FROM public.tenant_users tu
  WHERE tu.user_id = c.assigned_sales_id AND tu.is_active = true
  LIMIT 1
)
WHERE c.tenant_id IS NULL AND c.assigned_sales_id IS NOT NULL;

-- Step 3: Assign remaining (unassigned) customers to Graven Automation legacy tenant
UPDATE public.customers SET tenant_id = '1a5184ef-5138-4327-8928-67bc4f229131'
WHERE tenant_id IS NULL;

-- Step 4: Add index
CREATE INDEX idx_customers_tenant_id ON public.customers(tenant_id);

-- Step 5: Drop and recreate all RLS policies using is_my_tenant(tenant_id)

DROP POLICY "Customers are viewable by authenticated users" ON customers;
CREATE POLICY "Customers are viewable by authenticated users"
  ON customers FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND is_my_tenant(tenant_id)
    AND (
      is_manager_or_above(auth.uid())
      OR assigned_sales_id = auth.uid()
      OR EXISTS (SELECT 1 FROM leads WHERE leads.customer_id = customers.id AND leads.assigned_to = auth.uid())
      OR (is_procurement_or_above(auth.uid()) AND EXISTS (SELECT 1 FROM sales_orders WHERE sales_orders.customer_id = customers.id))
    )
  );

DROP POLICY "Sales and above can create customers" ON customers;
CREATE POLICY "Sales and above can create customers"
  ON customers FOR INSERT TO authenticated
  WITH CHECK (
    is_my_tenant(tenant_id)
    AND (assigned_sales_id IS NULL OR is_same_tenant(assigned_sales_id))
  );

DROP POLICY "Sales and above can update customers" ON customers;
CREATE POLICY "Sales and above can update customers"
  ON customers FOR UPDATE TO authenticated
  USING (is_my_tenant(tenant_id))
  WITH CHECK (is_my_tenant(tenant_id));

DROP POLICY "Admins can delete customers" ON customers;
CREATE POLICY "Admins can delete customers"
  ON customers FOR DELETE TO authenticated
  USING (is_my_tenant(tenant_id) AND is_admin_or_above(auth.uid()));
