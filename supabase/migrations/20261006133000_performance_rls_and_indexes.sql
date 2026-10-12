-- Comprehensive Performance Optimization Migration
-- 1. Create missing indexes on foreign keys and RLS lookup columns
-- 2. Optimize RLS helper functions with PARALLEL SAFE & STABLE
-- 3. Optimize RLS policies using InitPlan scalar subqueries

-- ========================================================
-- 1. HIGH-IMPACT INDEXES
-- ========================================================

-- Lead qualification lookups by qualifier (used in lead visibility RLS)
CREATE INDEX IF NOT EXISTS idx_lead_qualification_qualified_by 
  ON public.lead_qualification (qualified_by, lead_id);

-- Lead assignment history lookups (used in was_recent_lead_assignee)
CREATE INDEX IF NOT EXISTS idx_lah_lead_assigned_from 
  ON public.lead_assignment_history (lead_id, assigned_from, created_at DESC);

-- Profiles lookup for managers
CREATE INDEX IF NOT EXISTS idx_profiles_manager_active 
  ON public.profiles (manager_id, is_active) 
  WHERE (manager_id IS NOT NULL);

-- Quotations lookup by creator and lead (used in get_user_quotation_lead_ids)
CREATE INDEX IF NOT EXISTS idx_quotations_created_by_lead 
  ON public.quotations (created_by, lead_id) 
  WHERE (deleted_at IS NULL AND lead_id IS NOT NULL);

-- Price requests lookup by lead and assignees
CREATE INDEX IF NOT EXISTS idx_price_requests_lead_id_assignees 
  ON public.price_requests (lead_id, assigned_to, requested_by);

-- Customer assignments lookup
CREATE INDEX IF NOT EXISTS idx_cro_cust_assignments_user_customer 
  ON public.cro_customer_assignments (cro_user_id, customer_id);

-- Sales orders lookups by customer
CREATE INDEX IF NOT EXISTS idx_sales_orders_customer_id 
  ON public.sales_orders (customer_id);

-- Customer payments lookup by sales_order_id
CREATE INDEX IF NOT EXISTS idx_customer_payments_order_id 
  ON public.customer_payments (sales_order_id);

-- Invoices status lookup for accounts
CREATE INDEX IF NOT EXISTS idx_invoices_status_paid 
  ON public.invoices (status, amount_paid, grand_total);

-- Leads composite filter index for inbox and search
CREATE INDEX IF NOT EXISTS idx_leads_tenant_status_created 
  ON public.leads (tenant_id, status, created_at DESC) 
  WHERE (deleted_at IS NULL);

-- ========================================================
-- 2. HELPER FUNCTIONS OPTIMIZATION
-- ========================================================

-- Fast security definer check for lead visibility via procurement
CREATE OR REPLACE FUNCTION public.can_user_view_lead_via_procurement(_lead_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE PARALLEL SAFE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.price_requests pr
    WHERE pr.lead_id = _lead_id
      AND (pr.assigned_to = _user_id OR pr.requested_by = _user_id)
  );
$$;

-- Current user tenant ID helper (returns scalar for instant InitPlan comparison)
CREATE OR REPLACE FUNCTION public.current_user_tenant_id()
RETURNS uuid
LANGUAGE sql
STABLE PARALLEL SAFE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT tenant_id 
  FROM public.tenant_users
  WHERE user_id = auth.uid()
    AND is_active = true
  LIMIT 1;
$$;

-- ========================================================
-- 3. RLS POLICIES OPTIMIZATION (INITPLAN SCALAR WRAPPERS)
-- ========================================================

-- LEADS POLICIES:
DROP POLICY IF EXISTS "Admins can view all leads" ON public.leads;
CREATE POLICY "Admins can view all leads" ON public.leads
FOR SELECT TO authenticated
USING ((SELECT is_admin_or_above(auth.uid())));

DROP POLICY IF EXISTS "Procurement assignees can view related leads" ON public.leads;
CREATE POLICY "Procurement assignees can view related leads" ON public.leads
FOR SELECT TO authenticated
USING (
  (SELECT is_procurement_or_above(auth.uid()))
  AND can_user_view_lead_via_procurement(id, (SELECT auth.uid()))
);

DROP POLICY IF EXISTS "Lead visibility by role hierarchy" ON public.leads;
CREATE POLICY "Lead visibility by role hierarchy" ON public.leads
FOR SELECT TO authenticated
USING (
  (SELECT is_admin_or_above(auth.uid()))
  OR (
    is_my_tenant(tenant_id)
    AND branch_guard(office_id)
    AND (
      assigned_to = (SELECT auth.uid())
      OR (
        (SELECT is_manager_or_above(auth.uid())) 
        AND assigned_to = ANY (get_subordinate_ids((SELECT auth.uid())))
      )
      OR (
        (SELECT is_branch_manager(auth.uid()))
        AND office_id = (SELECT current_user_office_id())
      )
      OR (
        (SELECT has_role(auth.uid(), 'cro'::app_role))
        AND customer_id IS NOT NULL 
        AND customer_id = ANY (get_user_cro_customer_ids((SELECT auth.uid())))
      )
      OR (
        id = ANY (get_user_quotation_lead_ids((SELECT auth.uid())))
      )
      OR (
        id = ANY (get_user_qualified_lead_ids((SELECT auth.uid())))
      )
      OR was_recent_lead_assignee(id, (SELECT auth.uid()))
    )
  )
);

-- PRICE REQUESTS POLICIES:
DROP POLICY IF EXISTS "Price requests viewable by same tenant" ON public.price_requests;
CREATE POLICY "Price requests viewable by same tenant" ON public.price_requests
FOR SELECT TO authenticated
USING (
  (SELECT is_admin_or_above(auth.uid()))
  OR (tenant_id = (SELECT current_user_tenant_id()))
  OR is_my_tenant(tenant_id)
  OR ((tenant_id IS NULL) AND is_same_tenant(requested_by))
);

-- CUSTOMERS POLICIES:
DROP POLICY IF EXISTS "Customers are viewable by authenticated users" ON public.customers;
CREATE POLICY "Customers are viewable by authenticated users" ON public.customers
FOR SELECT TO authenticated
USING (
  (deleted_at IS NULL)
  AND (
    (SELECT is_admin_or_above(auth.uid()))
    OR (SELECT has_role(auth.uid(), 'accounts'::app_role))
    OR (
      is_my_tenant(tenant_id)
      AND branch_guard(office_id)
      AND (
        assigned_sales_id = (SELECT auth.uid())
        OR (
          (SELECT is_manager_or_above(auth.uid()))
          AND assigned_sales_id = ANY (get_subordinate_ids((SELECT auth.uid())))
        )
        OR (
          (SELECT is_branch_manager(auth.uid()))
          AND office_id = (SELECT current_user_office_id())
        )
        OR (
          (SELECT has_role(auth.uid(), 'cro'::app_role))
          AND EXISTS (
            SELECT 1 FROM cro_customer_assignments cca
            WHERE cca.customer_id = customers.id
              AND cca.cro_user_id = (SELECT auth.uid())
          )
        )
        OR (
          (SELECT is_procurement_or_above(auth.uid()))
          AND EXISTS (
            SELECT 1 FROM sales_orders so
            WHERE so.customer_id = customers.id
          )
        )
      )
    )
  )
);

-- QUOTATIONS POLICIES:
DROP POLICY IF EXISTS "Quotations viewable by authenticated users" ON public.quotations;
CREATE POLICY "Quotations viewable by authenticated users" ON public.quotations
FOR SELECT TO authenticated
USING (
  (SELECT is_admin_or_above(auth.uid()))
  OR (
    is_my_tenant(tenant_id)
    AND branch_guard(office_id)
    AND (
      created_by = (SELECT auth.uid())
      OR (
        (SELECT is_manager_or_above(auth.uid()))
        AND created_by = ANY (get_subordinate_ids((SELECT auth.uid())))
      )
      OR (
        (SELECT is_branch_manager(auth.uid()))
        AND office_id = (SELECT current_user_office_id())
      )
      OR (SELECT is_procurement_or_above(auth.uid()))
    )
  )
);
