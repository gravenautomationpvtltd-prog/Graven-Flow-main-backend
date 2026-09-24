
-- ============================================================
-- STEP 1: Create tenant-scoping helper functions
-- ============================================================

CREATE OR REPLACE FUNCTION public.is_same_tenant(_target_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE 
    WHEN _target_user_id IS NULL THEN false
    ELSE EXISTS (
      SELECT 1 FROM public.tenant_users t1
      JOIN public.tenant_users t2 ON t1.tenant_id = t2.tenant_id
      WHERE t1.user_id = auth.uid()
        AND t2.user_id = _target_user_id
        AND t1.is_active = true
        AND t2.is_active = true
    )
  END
$$;

CREATE OR REPLACE FUNCTION public.is_same_tenant_any(VARIADIC _user_ids uuid[])
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.tenant_users t1
    JOIN public.tenant_users t2 ON t1.tenant_id = t2.tenant_id
    WHERE t1.user_id = auth.uid()
      AND t2.user_id = ANY(_user_ids)
      AND t1.is_active = true
      AND t2.is_active = true
  )
$$;

-- Helper to check if the current user's tenant matches a given tenant_id
CREATE OR REPLACE FUNCTION public.is_my_tenant(_tenant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.tenant_users
    WHERE user_id = auth.uid()
      AND tenant_id = _tenant_id
      AND is_active = true
  )
$$;

-- ============================================================
-- STEP 2: Add tenant_id to products and backfill
-- ============================================================
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id);

-- Backfill: all existing products belong to the Graven Automation tenant
UPDATE public.products SET tenant_id = (
  SELECT id FROM public.tenants WHERE company_name ILIKE '%Graven%' LIMIT 1
) WHERE tenant_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_products_tenant_id ON public.products(tenant_id);

-- ============================================================
-- STEP 3: Update RLS on LEADS
-- ============================================================
DROP POLICY IF EXISTS "Lead visibility by role hierarchy" ON public.leads;
CREATE POLICY "Lead visibility by role hierarchy" ON public.leads
  FOR SELECT USING (
    is_same_tenant(assigned_to)
    AND (
      is_admin_or_above(auth.uid())
      OR assigned_to = auth.uid()
      OR (is_manager_or_above(auth.uid()) AND assigned_to = ANY(get_subordinate_ids(auth.uid())))
    )
  );

DROP POLICY IF EXISTS "Users can update leads they can access" ON public.leads;
CREATE POLICY "Users can update leads they can access" ON public.leads
  FOR UPDATE USING (
    is_same_tenant(assigned_to)
    AND (is_admin_or_above(auth.uid()) OR assigned_to = auth.uid() OR is_manager_or_above(auth.uid()))
  ) WITH CHECK (
    is_same_tenant(assigned_to)
    AND (is_admin_or_above(auth.uid()) OR assigned_to = auth.uid() OR is_manager_or_above(auth.uid()))
  );

DROP POLICY IF EXISTS "Authenticated users can create leads" ON public.leads;
CREATE POLICY "Authenticated users can create leads" ON public.leads
  FOR INSERT TO authenticated WITH CHECK (
    assigned_to IS NULL OR is_same_tenant(assigned_to)
  );

DROP POLICY IF EXISTS "Admins can delete leads" ON public.leads;
CREATE POLICY "Admins can delete leads" ON public.leads
  FOR DELETE TO authenticated USING (
    is_same_tenant(assigned_to) AND is_admin_or_above(auth.uid())
  );

-- ============================================================
-- STEP 4: Update RLS on CUSTOMERS  
-- ============================================================
DROP POLICY IF EXISTS "Customers are viewable by authenticated users" ON public.customers;
CREATE POLICY "Customers are viewable by authenticated users" ON public.customers
  FOR SELECT TO authenticated USING (
    deleted_at IS NULL
    AND is_same_tenant_any(assigned_sales_id)
    AND (
      is_manager_or_above(auth.uid())
      OR assigned_sales_id = auth.uid()
      OR EXISTS (SELECT 1 FROM leads WHERE leads.customer_id = customers.id AND leads.assigned_to = auth.uid())
      OR (is_procurement_or_above(auth.uid()) AND EXISTS (SELECT 1 FROM sales_orders WHERE sales_orders.customer_id = customers.id))
    )
  );

DROP POLICY IF EXISTS "Sales and above can update customers" ON public.customers;
CREATE POLICY "Sales and above can update customers" ON public.customers
  FOR UPDATE TO authenticated USING (
    is_same_tenant_any(assigned_sales_id)
  ) WITH CHECK (
    is_same_tenant_any(assigned_sales_id)
  );

DROP POLICY IF EXISTS "Sales and above can create customers" ON public.customers;
CREATE POLICY "Sales and above can create customers" ON public.customers
  FOR INSERT TO authenticated WITH CHECK (
    assigned_sales_id IS NULL OR is_same_tenant(assigned_sales_id)
  );

DROP POLICY IF EXISTS "Admins can delete customers" ON public.customers;
CREATE POLICY "Admins can delete customers" ON public.customers
  FOR DELETE TO authenticated USING (
    is_same_tenant_any(assigned_sales_id) AND is_admin_or_above(auth.uid())
  );

-- ============================================================
-- STEP 5: Update RLS on QUOTATIONS
-- ============================================================
DROP POLICY IF EXISTS "Quotations viewable by authenticated users" ON public.quotations;
CREATE POLICY "Quotations viewable by authenticated users" ON public.quotations
  FOR SELECT USING (is_same_tenant(created_by));

DROP POLICY IF EXISTS "Creator and managers can update quotations" ON public.quotations;
CREATE POLICY "Creator and managers can update quotations" ON public.quotations
  FOR UPDATE USING (
    is_same_tenant(created_by) AND (created_by = auth.uid() OR is_manager_or_above(auth.uid()))
  );

DROP POLICY IF EXISTS "Authenticated users can create quotations" ON public.quotations;
CREATE POLICY "Authenticated users can create quotations" ON public.quotations
  FOR INSERT WITH CHECK (created_by IS NULL OR is_same_tenant(created_by));

DROP POLICY IF EXISTS "Admins can delete quotations" ON public.quotations;
CREATE POLICY "Admins can delete quotations" ON public.quotations
  FOR DELETE USING (is_same_tenant(created_by) AND is_admin_or_above(auth.uid()));

-- ============================================================
-- STEP 6: Update RLS on SALES_ORDERS
-- ============================================================
DROP POLICY IF EXISTS "Sales orders are viewable by authenticated users" ON public.sales_orders;
DROP POLICY IF EXISTS "Sales orders viewable by authenticated users" ON public.sales_orders;
CREATE POLICY "Sales orders viewable by authenticated users" ON public.sales_orders
  FOR SELECT USING (is_same_tenant(created_by));

DROP POLICY IF EXISTS "Creator and managers can update orders" ON public.sales_orders;
CREATE POLICY "Creator and managers can update orders" ON public.sales_orders
  FOR UPDATE USING (
    is_same_tenant(created_by)
    AND (created_by = auth.uid() OR is_manager_or_above(auth.uid()) OR is_procurement_or_above(auth.uid()))
  );

DROP POLICY IF EXISTS "Sales can create orders" ON public.sales_orders;
CREATE POLICY "Sales can create orders" ON public.sales_orders
  FOR INSERT WITH CHECK (created_by IS NULL OR is_same_tenant(created_by));

DROP POLICY IF EXISTS "Admins can delete orders" ON public.sales_orders;
CREATE POLICY "Admins can delete orders" ON public.sales_orders
  FOR DELETE USING (is_same_tenant(created_by) AND is_admin_or_above(auth.uid()));

-- ============================================================
-- STEP 7: Update RLS on INVOICES
-- ============================================================
DROP POLICY IF EXISTS "Invoices viewable by authenticated users" ON public.invoices;
CREATE POLICY "Invoices viewable by authenticated users" ON public.invoices
  FOR SELECT USING (is_same_tenant(created_by));

DROP POLICY IF EXISTS "Creator and managers can update invoices" ON public.invoices;
CREATE POLICY "Creator and managers can update invoices" ON public.invoices
  FOR UPDATE USING (is_same_tenant(created_by) AND (created_by = auth.uid() OR is_manager_or_above(auth.uid())));

DROP POLICY IF EXISTS "Authenticated users can create invoices" ON public.invoices;
CREATE POLICY "Authenticated users can create invoices" ON public.invoices
  FOR INSERT WITH CHECK (created_by IS NULL OR is_same_tenant(created_by));

DROP POLICY IF EXISTS "Admins can delete invoices" ON public.invoices;
CREATE POLICY "Admins can delete invoices" ON public.invoices
  FOR DELETE USING (is_same_tenant(created_by) AND is_admin_or_above(auth.uid()));

-- ============================================================
-- STEP 8: Update RLS on DISPATCHES
-- ============================================================
DROP POLICY IF EXISTS "Dispatches viewable by authenticated users" ON public.dispatches;
CREATE POLICY "Dispatches viewable by authenticated users" ON public.dispatches
  FOR SELECT USING (is_same_tenant(dispatched_by));

DROP POLICY IF EXISTS "Creator and managers can update dispatches" ON public.dispatches;
CREATE POLICY "Creator and managers can update dispatches" ON public.dispatches
  FOR UPDATE USING (is_same_tenant(dispatched_by) AND (dispatched_by = auth.uid() OR is_manager_or_above(auth.uid())));

DROP POLICY IF EXISTS "Authenticated users can create dispatches" ON public.dispatches;
CREATE POLICY "Authenticated users can create dispatches" ON public.dispatches
  FOR INSERT WITH CHECK (dispatched_by IS NULL OR is_same_tenant(dispatched_by));

DROP POLICY IF EXISTS "Admins can delete dispatches" ON public.dispatches;
CREATE POLICY "Admins can delete dispatches" ON public.dispatches
  FOR DELETE USING (is_same_tenant(dispatched_by) AND is_admin_or_above(auth.uid()));

-- ============================================================
-- STEP 9: Update RLS on TASKS
-- ============================================================
DROP POLICY IF EXISTS "Tasks are viewable by authenticated users" ON public.tasks;
CREATE POLICY "Tasks are viewable by authenticated users" ON public.tasks
  FOR SELECT TO authenticated USING (is_same_tenant(assigned_to));

DROP POLICY IF EXISTS "Assigned users and managers can update tasks" ON public.tasks;
CREATE POLICY "Assigned users and managers can update tasks" ON public.tasks
  FOR UPDATE TO authenticated USING (is_same_tenant(assigned_to) AND (assigned_to = auth.uid() OR is_manager_or_above(auth.uid())));

DROP POLICY IF EXISTS "Authenticated users can create tasks" ON public.tasks;
CREATE POLICY "Authenticated users can create tasks" ON public.tasks
  FOR INSERT TO authenticated WITH CHECK (assigned_to IS NULL OR is_same_tenant(assigned_to));

DROP POLICY IF EXISTS "Admins can delete tasks" ON public.tasks;
CREATE POLICY "Admins can delete tasks" ON public.tasks
  FOR DELETE TO authenticated USING (is_same_tenant(assigned_to) AND is_admin_or_above(auth.uid()));

-- ============================================================
-- STEP 10: Update RLS on PURCHASE_ORDERS
-- ============================================================
DROP POLICY IF EXISTS "POs viewable by authenticated users" ON public.purchase_orders;
CREATE POLICY "POs viewable by authenticated users" ON public.purchase_orders
  FOR SELECT USING (is_same_tenant(created_by));

DROP POLICY IF EXISTS "Creator and managers can update POs" ON public.purchase_orders;
CREATE POLICY "Creator and managers can update POs" ON public.purchase_orders
  FOR UPDATE USING (is_same_tenant(created_by) AND (created_by = auth.uid() OR is_manager_or_above(auth.uid())));

DROP POLICY IF EXISTS "Procurement can create POs" ON public.purchase_orders;
CREATE POLICY "Procurement can create POs" ON public.purchase_orders
  FOR INSERT WITH CHECK (created_by IS NULL OR is_same_tenant(created_by));

DROP POLICY IF EXISTS "Admins can delete POs" ON public.purchase_orders;
CREATE POLICY "Admins can delete POs" ON public.purchase_orders
  FOR DELETE USING (is_same_tenant(created_by) AND is_admin_or_above(auth.uid()));

-- ============================================================
-- STEP 11: Update RLS on PRODUCTS (using tenant_id)
-- ============================================================
DROP POLICY IF EXISTS "Products viewable by authenticated users" ON public.products;
CREATE POLICY "Products viewable by authenticated users" ON public.products
  FOR SELECT USING (is_my_tenant(tenant_id));

DROP POLICY IF EXISTS "Authenticated users can create products" ON public.products;
CREATE POLICY "Authenticated users can create products" ON public.products
  FOR INSERT WITH CHECK (is_my_tenant(tenant_id));

DROP POLICY IF EXISTS "Authorized users can manage products" ON public.products;
CREATE POLICY "Authorized users can manage products" ON public.products
  FOR ALL TO authenticated USING (
    is_my_tenant(tenant_id)
    AND (is_manager_or_above(auth.uid()) OR has_role(auth.uid(), 'procurement'::app_role))
  ) WITH CHECK (
    is_my_tenant(tenant_id)
    AND (is_manager_or_above(auth.uid()) OR has_role(auth.uid(), 'procurement'::app_role))
  );

-- ============================================================
-- STEP 12: Update RLS on SUPPLIERS
-- ============================================================
DROP POLICY IF EXISTS "Suppliers viewable by authenticated users" ON public.suppliers;
CREATE POLICY "Suppliers viewable by authenticated users" ON public.suppliers
  FOR SELECT USING (is_same_tenant(created_by));

DROP POLICY IF EXISTS "Sales can view active approved suppliers only" ON public.suppliers;

DROP POLICY IF EXISTS "Procurement and managers can manage suppliers" ON public.suppliers;
CREATE POLICY "Procurement and managers can manage suppliers" ON public.suppliers
  FOR ALL USING (is_same_tenant(created_by) AND is_procurement_or_above(auth.uid()));

DROP POLICY IF EXISTS "Procurement and admins full access to suppliers" ON public.suppliers;

DROP POLICY IF EXISTS "Procurement can create suppliers" ON public.suppliers;
CREATE POLICY "Procurement can create suppliers" ON public.suppliers
  FOR INSERT WITH CHECK (created_by IS NULL OR is_same_tenant(created_by));

-- ============================================================
-- STEP 13: Update RLS on INVENTORY (via products.tenant_id)
-- ============================================================
DROP POLICY IF EXISTS "Inventory viewable by authenticated users" ON public.inventory;
CREATE POLICY "Inventory viewable by authenticated users" ON public.inventory
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.products p WHERE p.id = inventory.product_id AND is_my_tenant(p.tenant_id))
  );

DROP POLICY IF EXISTS "Procurement can update inventory" ON public.inventory;
CREATE POLICY "Procurement can update inventory" ON public.inventory
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.products p WHERE p.id = inventory.product_id AND is_my_tenant(p.tenant_id))
  );

DROP POLICY IF EXISTS "Procurement can create inventory" ON public.inventory;
CREATE POLICY "Procurement can create inventory" ON public.inventory
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.products p WHERE p.id = inventory.product_id AND is_my_tenant(p.tenant_id))
  );

DROP POLICY IF EXISTS "Managers can manage inventory" ON public.inventory;
CREATE POLICY "Managers can manage inventory" ON public.inventory
  FOR ALL USING (
    is_manager_or_above(auth.uid())
    AND EXISTS (SELECT 1 FROM public.products p WHERE p.id = inventory.product_id AND is_my_tenant(p.tenant_id))
  );

-- ============================================================
-- STEP 14: Update RLS on ACTIVITIES
-- ============================================================
DROP POLICY IF EXISTS "Activities are viewable by authenticated users" ON public.activities;
CREATE POLICY "Activities are viewable by authenticated users" ON public.activities
  FOR SELECT TO authenticated USING (is_same_tenant(user_id));

DROP POLICY IF EXISTS "Authenticated users can create activities" ON public.activities;
CREATE POLICY "Authenticated users can create activities" ON public.activities
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

-- ============================================================
-- STEP 15: Update RLS on ACTIVITY_LOGS
-- ============================================================
DROP POLICY IF EXISTS "Only admins can view activity logs" ON public.activity_logs;
CREATE POLICY "Only admins can view activity logs" ON public.activity_logs
  FOR SELECT USING (is_same_tenant(user_id) AND is_admin_or_above(auth.uid()));

DROP POLICY IF EXISTS "Authenticated users can create activity logs" ON public.activity_logs;
CREATE POLICY "Authenticated users can create activity logs" ON public.activity_logs
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- ============================================================
-- STEP 16: Update RLS on CHILD/JUNCTION tables
-- ============================================================

-- QUOTATION_ITEMS
DROP POLICY IF EXISTS "Quotation items viewable by authenticated users" ON public.quotation_items;
CREATE POLICY "Quotation items viewable by authenticated users" ON public.quotation_items
  FOR SELECT USING (EXISTS (SELECT 1 FROM public.quotations q WHERE q.id = quotation_items.quotation_id AND is_same_tenant(q.created_by)));

DROP POLICY IF EXISTS "Authenticated users can manage quotation items" ON public.quotation_items;
CREATE POLICY "Authenticated users can manage quotation items" ON public.quotation_items
  FOR ALL USING (EXISTS (SELECT 1 FROM public.quotations q WHERE q.id = quotation_items.quotation_id AND is_same_tenant(q.created_by)));

-- INVOICE_ITEMS
DROP POLICY IF EXISTS "Invoice items viewable by authenticated users" ON public.invoice_items;
CREATE POLICY "Invoice items viewable by authenticated users" ON public.invoice_items
  FOR SELECT USING (EXISTS (SELECT 1 FROM public.invoices i WHERE i.id = invoice_items.invoice_id AND is_same_tenant(i.created_by)));

DROP POLICY IF EXISTS "Authenticated users can manage invoice items" ON public.invoice_items;
CREATE POLICY "Authenticated users can manage invoice items" ON public.invoice_items
  FOR ALL USING (EXISTS (SELECT 1 FROM public.invoices i WHERE i.id = invoice_items.invoice_id AND is_same_tenant(i.created_by)));

-- DISPATCH_ITEMS
DROP POLICY IF EXISTS "Dispatch items viewable by authenticated users" ON public.dispatch_items;
CREATE POLICY "Dispatch items viewable by authenticated users" ON public.dispatch_items
  FOR SELECT USING (EXISTS (SELECT 1 FROM public.dispatches d WHERE d.id = dispatch_items.dispatch_id AND is_same_tenant(d.dispatched_by)));

DROP POLICY IF EXISTS "Authenticated users can manage dispatch items" ON public.dispatch_items;
CREATE POLICY "Authenticated users can manage dispatch items" ON public.dispatch_items
  FOR ALL USING (EXISTS (SELECT 1 FROM public.dispatches d WHERE d.id = dispatch_items.dispatch_id AND is_same_tenant(d.dispatched_by)));

-- DISPATCH_DOCUMENTS
DROP POLICY IF EXISTS "Dispatch documents viewable by authenticated users" ON public.dispatch_documents;
CREATE POLICY "Dispatch documents viewable by authenticated users" ON public.dispatch_documents
  FOR SELECT USING (EXISTS (SELECT 1 FROM public.dispatches d WHERE d.id = dispatch_documents.dispatch_id AND is_same_tenant(d.dispatched_by)));

DROP POLICY IF EXISTS "Uploader and managers can update documents" ON public.dispatch_documents;
CREATE POLICY "Uploader and managers can update documents" ON public.dispatch_documents
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.dispatches d WHERE d.id = dispatch_documents.dispatch_id AND is_same_tenant(d.dispatched_by))
    AND (uploaded_by = auth.uid() OR is_manager_or_above(auth.uid()))
  );

DROP POLICY IF EXISTS "Uploader and managers can delete documents" ON public.dispatch_documents;
CREATE POLICY "Uploader and managers can delete documents" ON public.dispatch_documents
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.dispatches d WHERE d.id = dispatch_documents.dispatch_id AND is_same_tenant(d.dispatched_by))
    AND (uploaded_by = auth.uid() OR is_manager_or_above(auth.uid()))
  );

DROP POLICY IF EXISTS "Authenticated users can upload documents" ON public.dispatch_documents;
CREATE POLICY "Authenticated users can upload documents" ON public.dispatch_documents
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.dispatches d WHERE d.id = dispatch_documents.dispatch_id AND is_same_tenant(d.dispatched_by))
  );

-- PURCHASE_ORDER_ITEMS
DROP POLICY IF EXISTS "PO items viewable by authenticated users" ON public.purchase_order_items;
CREATE POLICY "PO items viewable by authenticated users" ON public.purchase_order_items
  FOR SELECT USING (EXISTS (SELECT 1 FROM public.purchase_orders po WHERE po.id = purchase_order_items.po_id AND is_same_tenant(po.created_by)));

DROP POLICY IF EXISTS "Authenticated users can manage PO items" ON public.purchase_order_items;
CREATE POLICY "Authenticated users can manage PO items" ON public.purchase_order_items
  FOR ALL USING (EXISTS (SELECT 1 FROM public.purchase_orders po WHERE po.id = purchase_order_items.po_id AND is_same_tenant(po.created_by)));

-- ORDER_DOCUMENTS
DROP POLICY IF EXISTS "Order documents viewable by authenticated users" ON public.order_documents;
CREATE POLICY "Order documents viewable by authenticated users" ON public.order_documents
  FOR SELECT USING (EXISTS (SELECT 1 FROM public.sales_orders so WHERE so.id = order_documents.sales_order_id AND is_same_tenant(so.created_by)));

DROP POLICY IF EXISTS "Uploader and managers can delete documents" ON public.order_documents;
CREATE POLICY "Uploader and managers can delete order documents" ON public.order_documents
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.sales_orders so WHERE so.id = order_documents.sales_order_id AND is_same_tenant(so.created_by))
    AND (uploaded_by = auth.uid() OR is_manager_or_above(auth.uid()))
  );

DROP POLICY IF EXISTS "Authenticated users can upload documents" ON public.order_documents;
CREATE POLICY "Authenticated users can upload order documents" ON public.order_documents
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.sales_orders so WHERE so.id = order_documents.sales_order_id AND is_same_tenant(so.created_by))
  );

-- CUSTOMER_PAYMENTS
DROP POLICY IF EXISTS "Customer payments viewable by authenticated users" ON public.customer_payments;
CREATE POLICY "Customer payments viewable by authenticated users" ON public.customer_payments
  FOR SELECT USING (EXISTS (SELECT 1 FROM public.customers c WHERE c.id = customer_payments.customer_id AND is_same_tenant_any(c.assigned_sales_id)));

DROP POLICY IF EXISTS "Sales and above can create payments" ON public.customer_payments;
CREATE POLICY "Sales and above can create payments" ON public.customer_payments
  FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.customers c WHERE c.id = customer_payments.customer_id AND is_same_tenant_any(c.assigned_sales_id)));

DROP POLICY IF EXISTS "Sales and above can update payments" ON public.customer_payments;
CREATE POLICY "Sales and above can update payments" ON public.customer_payments
  FOR UPDATE USING (EXISTS (SELECT 1 FROM public.customers c WHERE c.id = customer_payments.customer_id AND is_same_tenant_any(c.assigned_sales_id)));

DROP POLICY IF EXISTS "Admins can delete payments" ON public.customer_payments;
CREATE POLICY "Admins can delete payments" ON public.customer_payments
  FOR DELETE USING (
    is_admin_or_above(auth.uid())
    AND EXISTS (SELECT 1 FROM public.customers c WHERE c.id = customer_payments.customer_id AND is_same_tenant_any(c.assigned_sales_id))
  );

-- SUPPLIER_PAYMENTS
DROP POLICY IF EXISTS "Supplier payments viewable by authenticated users" ON public.supplier_payments;
CREATE POLICY "Supplier payments viewable by authenticated users" ON public.supplier_payments
  FOR SELECT USING (EXISTS (SELECT 1 FROM public.suppliers s WHERE s.id = supplier_payments.supplier_id AND is_same_tenant(s.created_by)));

DROP POLICY IF EXISTS "Procurement can create supplier payments" ON public.supplier_payments;
CREATE POLICY "Procurement can create supplier payments" ON public.supplier_payments
  FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.suppliers s WHERE s.id = supplier_payments.supplier_id AND is_same_tenant(s.created_by)));

DROP POLICY IF EXISTS "Procurement can update supplier payments" ON public.supplier_payments;
CREATE POLICY "Procurement can update supplier payments" ON public.supplier_payments
  FOR UPDATE USING (
    is_procurement_or_above(auth.uid())
    AND EXISTS (SELECT 1 FROM public.suppliers s WHERE s.id = supplier_payments.supplier_id AND is_same_tenant(s.created_by))
  );

DROP POLICY IF EXISTS "Admins can delete supplier payments" ON public.supplier_payments;
CREATE POLICY "Admins can delete supplier payments" ON public.supplier_payments
  FOR DELETE USING (
    is_admin_or_above(auth.uid())
    AND EXISTS (SELECT 1 FROM public.suppliers s WHERE s.id = supplier_payments.supplier_id AND is_same_tenant(s.created_by))
  );

-- ENQUIRY_ITEMS
DROP POLICY IF EXISTS "Enquiry items viewable by authenticated users" ON public.enquiry_items;
CREATE POLICY "Enquiry items viewable by authenticated users" ON public.enquiry_items
  FOR SELECT USING (EXISTS (SELECT 1 FROM public.leads l WHERE l.id = enquiry_items.lead_id AND is_same_tenant(l.assigned_to)));

DROP POLICY IF EXISTS "Sales and managers can create enquiry items" ON public.enquiry_items;
CREATE POLICY "Sales and managers can create enquiry items" ON public.enquiry_items
  FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.leads l WHERE l.id = enquiry_items.lead_id AND is_same_tenant(l.assigned_to)));

DROP POLICY IF EXISTS "Sales and managers can update enquiry items" ON public.enquiry_items;
CREATE POLICY "Sales and managers can update enquiry items" ON public.enquiry_items
  FOR UPDATE USING (EXISTS (SELECT 1 FROM public.leads l WHERE l.id = enquiry_items.lead_id AND is_same_tenant(l.assigned_to)));

DROP POLICY IF EXISTS "Admins can delete enquiry items" ON public.enquiry_items;
CREATE POLICY "Admins can delete enquiry items" ON public.enquiry_items
  FOR DELETE USING (
    is_admin_or_above(auth.uid())
    AND EXISTS (SELECT 1 FROM public.leads l WHERE l.id = enquiry_items.lead_id AND is_same_tenant(l.assigned_to))
  );

-- ENQUIRY_ITEM_ATTACHMENTS
DROP POLICY IF EXISTS "Allow authenticated users to read attachments" ON public.enquiry_item_attachments;
CREATE POLICY "Allow authenticated users to read attachments" ON public.enquiry_item_attachments
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.enquiry_items ei
      JOIN public.leads l ON l.id = ei.lead_id
      WHERE ei.id = enquiry_item_attachments.enquiry_item_id AND is_same_tenant(l.assigned_to)
    )
  );

DROP POLICY IF EXISTS "Allow authenticated users to insert attachments" ON public.enquiry_item_attachments;
CREATE POLICY "Allow authenticated users to insert attachments" ON public.enquiry_item_attachments
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = uploaded_by);

DROP POLICY IF EXISTS "Allow attachment owners to delete" ON public.enquiry_item_attachments;
CREATE POLICY "Allow attachment owners to delete" ON public.enquiry_item_attachments
  FOR DELETE TO authenticated USING (uploaded_by = auth.uid());

-- ESCALATION_LOGS
DROP POLICY IF EXISTS "Escalation logs are viewable by managers and above" ON public.escalation_logs;
CREATE POLICY "Escalation logs are viewable by managers and above" ON public.escalation_logs
  FOR SELECT TO authenticated USING (is_same_tenant(user_id) AND (user_id = auth.uid() OR is_manager_or_above(auth.uid())));

DROP POLICY IF EXISTS "System can create escalation logs" ON public.escalation_logs;
CREATE POLICY "System can create escalation logs" ON public.escalation_logs
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Managers can update escalation logs" ON public.escalation_logs;
CREATE POLICY "Managers can update escalation logs" ON public.escalation_logs
  FOR UPDATE TO authenticated USING (is_same_tenant(user_id) AND is_manager_or_above(auth.uid()));

DROP POLICY IF EXISTS "Admins can delete escalation logs" ON public.escalation_logs;
CREATE POLICY "Admins can delete escalation logs" ON public.escalation_logs
  FOR DELETE TO authenticated USING (is_same_tenant(user_id) AND is_admin_or_above(auth.uid()));

-- QUOTATION_ITEM_NEGOTIATIONS
DROP POLICY IF EXISTS "Users can view negotiations based on role" ON public.quotation_item_negotiations;
CREATE POLICY "Users can view negotiations based on role" ON public.quotation_item_negotiations
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.leads l WHERE l.id = quotation_item_negotiations.lead_id AND is_same_tenant(l.assigned_to))
    AND (
      is_admin_or_above(auth.uid()) OR is_manager_or_above(auth.uid()) OR is_procurement_or_above(auth.uid())
      OR EXISTS (SELECT 1 FROM public.leads l WHERE l.id = quotation_item_negotiations.lead_id AND l.assigned_to = auth.uid())
    )
  );

DROP POLICY IF EXISTS "Authenticated users can insert negotiations" ON public.quotation_item_negotiations;
CREATE POLICY "Authenticated users can insert negotiations" ON public.quotation_item_negotiations
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can update negotiations" ON public.quotation_item_negotiations;
CREATE POLICY "Authenticated users can update negotiations" ON public.quotation_item_negotiations
  FOR UPDATE USING (
    auth.uid() IS NOT NULL
    AND EXISTS (SELECT 1 FROM public.leads l WHERE l.id = quotation_item_negotiations.lead_id AND is_same_tenant(l.assigned_to))
  );

-- QUOTATION_VERSIONS
DROP POLICY IF EXISTS "Users can view quotation versions" ON public.quotation_versions;
CREATE POLICY "Users can view quotation versions" ON public.quotation_versions
  FOR SELECT USING (EXISTS (SELECT 1 FROM public.quotations q WHERE q.id = quotation_versions.quotation_id AND is_same_tenant(q.created_by)));

DROP POLICY IF EXISTS "Authenticated users can create quotation versions" ON public.quotation_versions;
CREATE POLICY "Authenticated users can create quotation versions" ON public.quotation_versions
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- EMAIL_LOGS
DROP POLICY IF EXISTS "Email logs viewable by authenticated users" ON public.email_logs;
CREATE POLICY "Email logs viewable by authenticated users" ON public.email_logs
  FOR SELECT USING (is_same_tenant(sent_by));

DROP POLICY IF EXISTS "System can create email logs" ON public.email_logs;
CREATE POLICY "System can create email logs" ON public.email_logs
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "System can update email logs" ON public.email_logs;
CREATE POLICY "System can update email logs" ON public.email_logs
  FOR UPDATE USING (is_same_tenant(sent_by));

DROP POLICY IF EXISTS "Admins can delete email logs" ON public.email_logs;
CREATE POLICY "Admins can delete email logs" ON public.email_logs
  FOR DELETE TO authenticated USING (is_same_tenant(sent_by) AND is_admin_or_above(auth.uid()));

-- CUSTOMER_OUTREACH
DROP POLICY IF EXISTS "Customer outreach viewable by managers and above" ON public.customer_outreach;
CREATE POLICY "Customer outreach viewable by managers and above" ON public.customer_outreach
  FOR SELECT USING (is_same_tenant(sent_by_user_id) AND is_manager_or_above(auth.uid()));

DROP POLICY IF EXISTS "System can create outreach records" ON public.customer_outreach;
CREATE POLICY "System can create outreach records" ON public.customer_outreach
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "System can update outreach records" ON public.customer_outreach;
CREATE POLICY "System can update outreach records" ON public.customer_outreach
  FOR UPDATE USING (is_same_tenant(sent_by_user_id));

DROP POLICY IF EXISTS "Admins can delete customer outreach" ON public.customer_outreach;
DROP POLICY IF EXISTS "Admins can delete outreach records" ON public.customer_outreach;
CREATE POLICY "Admins can delete outreach records" ON public.customer_outreach
  FOR DELETE TO authenticated USING (is_same_tenant(sent_by_user_id) AND is_admin_or_above(auth.uid()));
