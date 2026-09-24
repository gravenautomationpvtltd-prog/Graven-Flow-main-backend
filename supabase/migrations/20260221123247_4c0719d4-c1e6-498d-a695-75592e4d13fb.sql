
-- ============================================================
-- PHASE 1: Add tenant_id to shared/config tables
-- ============================================================

ALTER TABLE public.offices ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id);
ALTER TABLE public.holidays ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id);
ALTER TABLE public.company_settings ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id);
ALTER TABLE public.email_templates ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id);
ALTER TABLE public.outreach_templates ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id);
ALTER TABLE public.whatsapp_templates ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id);
ALTER TABLE public.payroll_slabs ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id);
ALTER TABLE public.integration_settings ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id);
ALTER TABLE public.integration_accounts ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id);
ALTER TABLE public.lead_assignment_rules ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id);
ALTER TABLE public.pricing_alert_settings ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id);
ALTER TABLE public.supplier_categories ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id);

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'round_robin_tracker') THEN
    EXECUTE 'ALTER TABLE public.round_robin_tracker ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id)';
  END IF;
END $$;

-- Backfill all existing records to Graven Automation tenant
UPDATE public.offices SET tenant_id = '1a5184ef-5138-4327-8928-67bc4f229131' WHERE tenant_id IS NULL;
UPDATE public.holidays SET tenant_id = '1a5184ef-5138-4327-8928-67bc4f229131' WHERE tenant_id IS NULL;
UPDATE public.company_settings SET tenant_id = '1a5184ef-5138-4327-8928-67bc4f229131' WHERE tenant_id IS NULL;
UPDATE public.email_templates SET tenant_id = '1a5184ef-5138-4327-8928-67bc4f229131' WHERE tenant_id IS NULL;
UPDATE public.outreach_templates SET tenant_id = '1a5184ef-5138-4327-8928-67bc4f229131' WHERE tenant_id IS NULL;
UPDATE public.whatsapp_templates SET tenant_id = '1a5184ef-5138-4327-8928-67bc4f229131' WHERE tenant_id IS NULL;
UPDATE public.payroll_slabs SET tenant_id = '1a5184ef-5138-4327-8928-67bc4f229131' WHERE tenant_id IS NULL;
UPDATE public.integration_settings SET tenant_id = '1a5184ef-5138-4327-8928-67bc4f229131' WHERE tenant_id IS NULL;
UPDATE public.integration_accounts SET tenant_id = '1a5184ef-5138-4327-8928-67bc4f229131' WHERE tenant_id IS NULL;
UPDATE public.lead_assignment_rules SET tenant_id = '1a5184ef-5138-4327-8928-67bc4f229131' WHERE tenant_id IS NULL;
UPDATE public.pricing_alert_settings SET tenant_id = '1a5184ef-5138-4327-8928-67bc4f229131' WHERE tenant_id IS NULL;
UPDATE public.supplier_categories SET tenant_id = '1a5184ef-5138-4327-8928-67bc4f229131' WHERE tenant_id IS NULL;

-- ============================================================
-- PHASE 2: Drop old policies and recreate with tenant scoping
-- ============================================================

-- ---- OFFICES ----
DROP POLICY IF EXISTS "Offices are viewable by authenticated users" ON public.offices;
DROP POLICY IF EXISTS "Offices are manageable by admins" ON public.offices;
CREATE POLICY "Offices viewable by same tenant" ON public.offices FOR SELECT USING (is_my_tenant(tenant_id));
CREATE POLICY "Offices manageable by same tenant admins" ON public.offices FOR ALL USING (is_my_tenant(tenant_id) AND is_admin_or_above(auth.uid())) WITH CHECK (is_my_tenant(tenant_id) AND is_admin_or_above(auth.uid()));

-- ---- HOLIDAYS ----
DROP POLICY IF EXISTS "Holidays viewable by authenticated users" ON public.holidays;
DROP POLICY IF EXISTS "HR/Admin can create holidays" ON public.holidays;
DROP POLICY IF EXISTS "HR/Admin can update holidays" ON public.holidays;
DROP POLICY IF EXISTS "HR/Admin can delete holidays" ON public.holidays;
CREATE POLICY "Holidays viewable by same tenant" ON public.holidays FOR SELECT USING (is_my_tenant(tenant_id));
CREATE POLICY "HR/Admin can create holidays for tenant" ON public.holidays FOR INSERT WITH CHECK (is_my_tenant(tenant_id) AND is_hr_or_admin(auth.uid()));
CREATE POLICY "HR/Admin can update holidays for tenant" ON public.holidays FOR UPDATE USING (is_my_tenant(tenant_id) AND is_hr_or_admin(auth.uid()));
CREATE POLICY "HR/Admin can delete holidays for tenant" ON public.holidays FOR DELETE USING (is_my_tenant(tenant_id) AND is_hr_or_admin(auth.uid()));

-- ---- COMPANY_SETTINGS ----
DROP POLICY IF EXISTS "Company settings are viewable by authenticated users" ON public.company_settings;
DROP POLICY IF EXISTS "Only admins can insert company settings" ON public.company_settings;
DROP POLICY IF EXISTS "Only admins can update company settings" ON public.company_settings;
DROP POLICY IF EXISTS "Only admins can delete company settings" ON public.company_settings;
CREATE POLICY "Company settings viewable by same tenant" ON public.company_settings FOR SELECT USING (is_my_tenant(tenant_id));
CREATE POLICY "Admins can insert company settings for tenant" ON public.company_settings FOR INSERT WITH CHECK (is_my_tenant(tenant_id) AND is_admin_or_above(auth.uid()));
CREATE POLICY "Admins can update company settings for tenant" ON public.company_settings FOR UPDATE USING (is_my_tenant(tenant_id) AND is_admin_or_above(auth.uid()));
CREATE POLICY "Admins can delete company settings for tenant" ON public.company_settings FOR DELETE USING (is_my_tenant(tenant_id) AND is_admin_or_above(auth.uid()));

-- ---- EMAIL_TEMPLATES ----
DROP POLICY IF EXISTS "Email templates viewable by authenticated users" ON public.email_templates;
DROP POLICY IF EXISTS "Managers can manage email templates" ON public.email_templates;
CREATE POLICY "Email templates viewable by same tenant" ON public.email_templates FOR SELECT USING (is_my_tenant(tenant_id));
CREATE POLICY "Managers can manage email templates for tenant" ON public.email_templates FOR ALL USING (is_my_tenant(tenant_id) AND is_manager_or_above(auth.uid())) WITH CHECK (is_my_tenant(tenant_id) AND is_manager_or_above(auth.uid()));

-- ---- OUTREACH_TEMPLATES ----
DROP POLICY IF EXISTS "Outreach templates viewable by authenticated users" ON public.outreach_templates;
DROP POLICY IF EXISTS "Admins can manage outreach templates" ON public.outreach_templates;
CREATE POLICY "Outreach templates viewable by same tenant" ON public.outreach_templates FOR SELECT USING (is_my_tenant(tenant_id));
CREATE POLICY "Admins can manage outreach templates for tenant" ON public.outreach_templates FOR ALL USING (is_my_tenant(tenant_id) AND is_admin_or_above(auth.uid())) WITH CHECK (is_my_tenant(tenant_id) AND is_admin_or_above(auth.uid()));

-- ---- WHATSAPP_TEMPLATES ----
DROP POLICY IF EXISTS "WhatsApp templates viewable by authenticated users" ON public.whatsapp_templates;
DROP POLICY IF EXISTS "Admins can manage WhatsApp templates" ON public.whatsapp_templates;
CREATE POLICY "WhatsApp templates viewable by same tenant" ON public.whatsapp_templates FOR SELECT USING (is_my_tenant(tenant_id));
CREATE POLICY "Admins can manage WhatsApp templates for tenant" ON public.whatsapp_templates FOR ALL USING (is_my_tenant(tenant_id) AND is_admin_or_above(auth.uid())) WITH CHECK (is_my_tenant(tenant_id) AND is_admin_or_above(auth.uid()));

-- ---- PAYROLL_SLABS ----
DROP POLICY IF EXISTS "Only admins can view payroll slabs" ON public.payroll_slabs;
DROP POLICY IF EXISTS "Only admins can manage payroll slabs" ON public.payroll_slabs;
CREATE POLICY "Payroll slabs viewable by same tenant" ON public.payroll_slabs FOR SELECT USING (is_my_tenant(tenant_id) AND is_admin_or_above(auth.uid()));
CREATE POLICY "Admins can manage payroll slabs for tenant" ON public.payroll_slabs FOR ALL USING (is_my_tenant(tenant_id) AND is_admin_or_above(auth.uid())) WITH CHECK (is_my_tenant(tenant_id) AND is_admin_or_above(auth.uid()));

-- ---- INTEGRATION_SETTINGS ----
DROP POLICY IF EXISTS "Only admins can view integration settings" ON public.integration_settings;
DROP POLICY IF EXISTS "Only admins can insert integration settings" ON public.integration_settings;
DROP POLICY IF EXISTS "Only admins can update integration settings" ON public.integration_settings;
DROP POLICY IF EXISTS "Only admins can delete integration settings" ON public.integration_settings;
CREATE POLICY "Integration settings viewable by same tenant" ON public.integration_settings FOR SELECT USING (is_my_tenant(tenant_id) AND is_admin_or_above(auth.uid()));
CREATE POLICY "Admins can insert integration settings for tenant" ON public.integration_settings FOR INSERT WITH CHECK (is_my_tenant(tenant_id) AND is_admin_or_above(auth.uid()));
CREATE POLICY "Admins can update integration settings for tenant" ON public.integration_settings FOR UPDATE USING (is_my_tenant(tenant_id) AND is_admin_or_above(auth.uid()));
CREATE POLICY "Admins can delete integration settings for tenant" ON public.integration_settings FOR DELETE USING (is_my_tenant(tenant_id) AND is_admin_or_above(auth.uid()));

-- ---- INTEGRATION_ACCOUNTS ----
DROP POLICY IF EXISTS "Admins can view integration accounts" ON public.integration_accounts;
DROP POLICY IF EXISTS "Admins can insert integration accounts" ON public.integration_accounts;
DROP POLICY IF EXISTS "Admins can update integration accounts" ON public.integration_accounts;
DROP POLICY IF EXISTS "Admins can delete integration accounts" ON public.integration_accounts;
CREATE POLICY "Integration accounts viewable by same tenant" ON public.integration_accounts FOR SELECT USING (is_my_tenant(tenant_id) AND is_admin_or_above(auth.uid()));
CREATE POLICY "Admins can insert integration accounts for tenant" ON public.integration_accounts FOR INSERT WITH CHECK (is_my_tenant(tenant_id) AND is_admin_or_above(auth.uid()));
CREATE POLICY "Admins can update integration accounts for tenant" ON public.integration_accounts FOR UPDATE USING (is_my_tenant(tenant_id) AND is_admin_or_above(auth.uid()));
CREATE POLICY "Admins can delete integration accounts for tenant" ON public.integration_accounts FOR DELETE USING (is_my_tenant(tenant_id) AND is_admin_or_above(auth.uid()));

-- ---- LEAD_ASSIGNMENT_RULES ----
DROP POLICY IF EXISTS "Lead assignment rules viewable by authenticated users" ON public.lead_assignment_rules;
DROP POLICY IF EXISTS "Admins can manage lead assignment rules" ON public.lead_assignment_rules;
DROP POLICY IF EXISTS "Lead assignment rules viewable by managers" ON public.lead_assignment_rules;
DROP POLICY IF EXISTS "Managers can manage lead assignment rules" ON public.lead_assignment_rules;
CREATE POLICY "Lead assignment rules viewable by same tenant" ON public.lead_assignment_rules FOR SELECT USING (is_my_tenant(tenant_id));
CREATE POLICY "Admins can manage lead assignment rules for tenant" ON public.lead_assignment_rules FOR ALL USING (is_my_tenant(tenant_id) AND is_admin_or_above(auth.uid())) WITH CHECK (is_my_tenant(tenant_id) AND is_admin_or_above(auth.uid()));

-- ---- PRICING_ALERT_SETTINGS ----
DROP POLICY IF EXISTS "Managers and above can view alert settings" ON public.pricing_alert_settings;
DROP POLICY IF EXISTS "Admins can update alert settings" ON public.pricing_alert_settings;
CREATE POLICY "Alert settings viewable by same tenant managers" ON public.pricing_alert_settings FOR SELECT USING (is_my_tenant(tenant_id) AND (is_manager_or_above(auth.uid()) OR is_procurement_or_above(auth.uid())));
CREATE POLICY "Admins can update alert settings for tenant" ON public.pricing_alert_settings FOR UPDATE USING (is_my_tenant(tenant_id) AND is_admin_or_above(auth.uid()));

-- ---- SUPPLIER_CATEGORIES ----
DROP POLICY IF EXISTS "Supplier categories viewable by authenticated users" ON public.supplier_categories;
DROP POLICY IF EXISTS "Admins and procurement can manage supplier categories" ON public.supplier_categories;
DROP POLICY IF EXISTS "Procurement and above can manage supplier categories" ON public.supplier_categories;
CREATE POLICY "Supplier categories viewable by same tenant" ON public.supplier_categories FOR SELECT USING (is_my_tenant(tenant_id));
CREATE POLICY "Procurement can manage supplier categories for tenant" ON public.supplier_categories FOR ALL USING (is_my_tenant(tenant_id) AND is_procurement_or_above(auth.uid())) WITH CHECK (is_my_tenant(tenant_id) AND is_procurement_or_above(auth.uid()));

-- ============================================================
-- PHASE 2b: Scope user-linked tables with is_same_tenant()
-- ============================================================

-- ---- ATTENDANCE_RECORDS ----
DROP POLICY IF EXISTS "Users can view their own attendance" ON public.attendance_records;
DROP POLICY IF EXISTS "System can insert attendance records" ON public.attendance_records;
DROP POLICY IF EXISTS "Users can update their own attendance" ON public.attendance_records;
DROP POLICY IF EXISTS "HR/Admin can update attendance records" ON public.attendance_records;
DROP POLICY IF EXISTS "HR/Admin can delete attendance records" ON public.attendance_records;
CREATE POLICY "Users can view same tenant attendance" ON public.attendance_records FOR SELECT USING ((user_id = auth.uid()) OR (is_hr_or_admin(auth.uid()) AND is_same_tenant(user_id)));
CREATE POLICY "Users can insert own attendance" ON public.attendance_records FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own attendance" ON public.attendance_records FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "HR/Admin can update same tenant attendance" ON public.attendance_records FOR UPDATE USING (is_hr_or_admin(auth.uid()) AND is_same_tenant(user_id));
CREATE POLICY "HR/Admin can delete same tenant attendance" ON public.attendance_records FOR DELETE USING (is_hr_or_admin(auth.uid()) AND is_same_tenant(user_id));

-- ---- LEAVE_REQUESTS ----
DROP POLICY IF EXISTS "Users can view their own leave requests" ON public.leave_requests;
DROP POLICY IF EXISTS "Users can create their own leave requests" ON public.leave_requests;
DROP POLICY IF EXISTS "Users can update their pending leave requests" ON public.leave_requests;
DROP POLICY IF EXISTS "HR/Admin can delete leave requests" ON public.leave_requests;
CREATE POLICY "Users can view same tenant leave requests" ON public.leave_requests FOR SELECT USING ((user_id = auth.uid()) OR (is_hr_or_admin(auth.uid()) AND is_same_tenant(user_id)));
CREATE POLICY "Users can create own leave requests" ON public.leave_requests FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own pending leave requests" ON public.leave_requests FOR UPDATE USING (((user_id = auth.uid()) AND (status = 'pending')) OR (is_hr_or_admin(auth.uid()) AND is_same_tenant(user_id)));
CREATE POLICY "HR/Admin can delete same tenant leave requests" ON public.leave_requests FOR DELETE USING (is_hr_or_admin(auth.uid()) AND is_same_tenant(user_id));

-- ---- BREAK_RECORDS ----
DROP POLICY IF EXISTS "Users can view own breaks or HR/Admin all" ON public.break_records;
DROP POLICY IF EXISTS "Users can create own breaks" ON public.break_records;
DROP POLICY IF EXISTS "Users can update own breaks" ON public.break_records;
DROP POLICY IF EXISTS "Users can delete own breaks" ON public.break_records;
CREATE POLICY "Users can view same tenant breaks" ON public.break_records FOR SELECT USING ((user_id = auth.uid()) OR (is_hr_or_admin(auth.uid()) AND is_same_tenant(user_id)));
CREATE POLICY "Users can create own breaks" ON public.break_records FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own breaks" ON public.break_records FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "Users can delete own breaks" ON public.break_records FOR DELETE USING (user_id = auth.uid());

-- ---- EMPLOYEE_SALARIES ----
DROP POLICY IF EXISTS "HR/Admin can view salaries" ON public.employee_salaries;
DROP POLICY IF EXISTS "HR/Admin can manage salaries" ON public.employee_salaries;
CREATE POLICY "HR/Admin can view same tenant salaries" ON public.employee_salaries FOR SELECT USING (is_hr_or_admin(auth.uid()) AND is_same_tenant(user_id));
CREATE POLICY "HR/Admin can manage same tenant salaries" ON public.employee_salaries FOR ALL USING (is_hr_or_admin(auth.uid()) AND is_same_tenant(user_id)) WITH CHECK (is_hr_or_admin(auth.uid()) AND is_same_tenant(user_id));

-- ---- EMPLOYEE_PAYROLL ----
DROP POLICY IF EXISTS "Users can view their own payroll" ON public.employee_payroll;
DROP POLICY IF EXISTS "HR/Admin can manage employee payroll" ON public.employee_payroll;
CREATE POLICY "Users can view same tenant payroll" ON public.employee_payroll FOR SELECT USING ((user_id = auth.uid()) OR (is_hr_or_admin(auth.uid()) AND is_same_tenant(user_id)));
CREATE POLICY "HR/Admin can manage same tenant payroll" ON public.employee_payroll FOR ALL USING (is_hr_or_admin(auth.uid()) AND is_same_tenant(user_id)) WITH CHECK (is_hr_or_admin(auth.uid()) AND is_same_tenant(user_id));

-- ---- PAYROLL_RUNS (uses processed_by, not created_by) ----
DROP POLICY IF EXISTS "HR/Admin can view payroll runs" ON public.payroll_runs;
DROP POLICY IF EXISTS "HR/Admin can manage payroll runs" ON public.payroll_runs;
CREATE POLICY "HR/Admin can view same tenant payroll runs" ON public.payroll_runs FOR SELECT USING (is_hr_or_admin(auth.uid()) AND is_same_tenant(processed_by));
CREATE POLICY "HR/Admin can manage same tenant payroll runs" ON public.payroll_runs FOR ALL USING (is_hr_or_admin(auth.uid()) AND (processed_by IS NULL OR is_same_tenant(processed_by))) WITH CHECK (is_hr_or_admin(auth.uid()));

-- ---- PRICE_REQUESTS ----
DROP POLICY IF EXISTS "Price requests viewable by authenticated users" ON public.price_requests;
DROP POLICY IF EXISTS "Sales can create price requests" ON public.price_requests;
DROP POLICY IF EXISTS "Procurement and managers can update price requests" ON public.price_requests;
DROP POLICY IF EXISTS "Admins can delete price requests" ON public.price_requests;
CREATE POLICY "Price requests viewable by same tenant" ON public.price_requests FOR SELECT USING (is_same_tenant(requested_by));
CREATE POLICY "Users can create price requests" ON public.price_requests FOR INSERT WITH CHECK (requested_by = auth.uid());
CREATE POLICY "Procurement can update same tenant price requests" ON public.price_requests FOR UPDATE USING ((is_procurement_or_above(auth.uid()) OR (requested_by = auth.uid())) AND is_same_tenant(requested_by));
CREATE POLICY "Admins can delete same tenant price requests" ON public.price_requests FOR DELETE USING (is_admin_or_above(auth.uid()) AND is_same_tenant(requested_by));

-- ---- SALES_TARGETS ----
DROP POLICY IF EXISTS "Users can view own sales targets" ON public.sales_targets;
DROP POLICY IF EXISTS "Admins can manage all sales targets" ON public.sales_targets;
DROP POLICY IF EXISTS "Managers can view team sales targets" ON public.sales_targets;
CREATE POLICY "Users can view own sales targets" ON public.sales_targets FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Managers can view same tenant team targets" ON public.sales_targets FOR SELECT USING (is_same_tenant(user_id) AND (is_manager_or_above(auth.uid()) OR (user_id IN (SELECT unnest(get_subordinate_ids(auth.uid()))))));
CREATE POLICY "Admins can manage same tenant sales targets" ON public.sales_targets FOR ALL USING (is_same_tenant(user_id) AND is_admin_or_above(auth.uid())) WITH CHECK (is_same_tenant(user_id) AND is_admin_or_above(auth.uid()));

-- ---- PROCUREMENT_TARGETS ----
DROP POLICY IF EXISTS "Users can view own procurement targets" ON public.procurement_targets;
DROP POLICY IF EXISTS "Admins can manage all procurement targets" ON public.procurement_targets;
DROP POLICY IF EXISTS "Managers can view team procurement targets" ON public.procurement_targets;
CREATE POLICY "Users can view own procurement targets" ON public.procurement_targets FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Managers can view same tenant procurement targets" ON public.procurement_targets FOR SELECT USING (is_same_tenant(user_id) AND (is_manager_or_above(auth.uid()) OR (user_id IN (SELECT unnest(get_subordinate_ids(auth.uid()))))));
CREATE POLICY "Admins can manage same tenant procurement targets" ON public.procurement_targets FOR ALL USING (is_same_tenant(user_id) AND is_admin_or_above(auth.uid())) WITH CHECK (is_same_tenant(user_id) AND is_admin_or_above(auth.uid()));

-- ---- SCHEDULED_REPORTS ----
DROP POLICY IF EXISTS "Users can manage own reports" ON public.scheduled_reports;
DROP POLICY IF EXISTS "Admins can view all reports" ON public.scheduled_reports;
CREATE POLICY "Users can manage own reports" ON public.scheduled_reports FOR ALL USING (created_by = auth.uid()) WITH CHECK (created_by = auth.uid());
CREATE POLICY "Admins can view same tenant reports" ON public.scheduled_reports FOR SELECT USING (is_same_tenant(created_by) AND is_admin_or_above(auth.uid()));

-- ---- EXECUTIVE_ACTIONS_LOG ----
DROP POLICY IF EXISTS "Only admins can view executive actions log" ON public.executive_actions_log;
DROP POLICY IF EXISTS "Only admins can create executive actions log" ON public.executive_actions_log;
CREATE POLICY "Admins can view same tenant executive actions" ON public.executive_actions_log FOR SELECT USING (is_same_tenant(performed_by) AND is_admin_or_above(auth.uid()));
CREATE POLICY "Admins can create executive actions" ON public.executive_actions_log FOR INSERT WITH CHECK (performed_by = auth.uid() AND is_admin_or_above(auth.uid()));

-- ---- PRODUCT_PRICE_HISTORY ----
DROP POLICY IF EXISTS "Managers and above can view price history" ON public.product_price_history;
DROP POLICY IF EXISTS "Managers and above can insert price history" ON public.product_price_history;
DROP POLICY IF EXISTS "Managers and above can update price history" ON public.product_price_history;
DROP POLICY IF EXISTS "Managers and above can delete price history" ON public.product_price_history;
CREATE POLICY "Same tenant can view price history" ON public.product_price_history FOR SELECT USING (is_same_tenant(changed_by) AND (is_manager_or_above(auth.uid()) OR is_procurement_or_above(auth.uid())));
CREATE POLICY "Same tenant can insert price history" ON public.product_price_history FOR INSERT WITH CHECK ((is_manager_or_above(auth.uid()) OR is_procurement_or_above(auth.uid())));
CREATE POLICY "Same tenant can update price history" ON public.product_price_history FOR UPDATE USING (is_same_tenant(changed_by) AND (is_manager_or_above(auth.uid()) OR is_procurement_or_above(auth.uid())));
CREATE POLICY "Same tenant can delete price history" ON public.product_price_history FOR DELETE USING (is_same_tenant(changed_by) AND is_manager_or_above(auth.uid()));

-- ---- STOCK_MOVEMENTS ----
DROP POLICY IF EXISTS "Stock movements viewable by authenticated users" ON public.stock_movements;
DROP POLICY IF EXISTS "Admins and procurement can manage stock movements" ON public.stock_movements;
DROP POLICY IF EXISTS "Procurement and above can manage stock movements" ON public.stock_movements;
CREATE POLICY "Stock movements viewable by same tenant" ON public.stock_movements FOR SELECT USING (is_same_tenant(created_by));
CREATE POLICY "Procurement can manage same tenant stock movements" ON public.stock_movements FOR ALL USING (is_same_tenant(created_by) AND is_procurement_or_above(auth.uid())) WITH CHECK (is_procurement_or_above(auth.uid()));

-- ---- RFQS ----
DROP POLICY IF EXISTS "RFQs viewable by authenticated users" ON public.rfqs;
DROP POLICY IF EXISTS "Procurement and above can manage RFQs" ON public.rfqs;
CREATE POLICY "RFQs viewable by same tenant" ON public.rfqs FOR SELECT USING (is_same_tenant(created_by));
CREATE POLICY "Procurement can manage same tenant RFQs" ON public.rfqs FOR ALL USING (is_same_tenant(created_by) AND is_procurement_or_above(auth.uid())) WITH CHECK (is_procurement_or_above(auth.uid()));

-- ============================================================
-- PHASE 3: Scope child/junction tables via parent
-- ============================================================

-- ---- RFQ_ITEMS ----
DROP POLICY IF EXISTS "RFQ items viewable by authenticated users" ON public.rfq_items;
DROP POLICY IF EXISTS "Procurement and above can manage RFQ items" ON public.rfq_items;
CREATE POLICY "RFQ items viewable by same tenant" ON public.rfq_items FOR SELECT USING (EXISTS (SELECT 1 FROM public.rfqs WHERE rfqs.id = rfq_items.rfq_id AND is_same_tenant(rfqs.created_by)));
CREATE POLICY "Procurement can manage same tenant RFQ items" ON public.rfq_items FOR ALL USING (EXISTS (SELECT 1 FROM public.rfqs WHERE rfqs.id = rfq_items.rfq_id AND is_same_tenant(rfqs.created_by)) AND is_procurement_or_above(auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM public.rfqs WHERE rfqs.id = rfq_items.rfq_id AND is_same_tenant(rfqs.created_by)) AND is_procurement_or_above(auth.uid()));

-- ---- RFQ_DISTRIBUTIONS ----
DROP POLICY IF EXISTS "RFQ distributions viewable by authenticated users" ON public.rfq_distributions;
DROP POLICY IF EXISTS "Procurement and above can manage RFQ distributions" ON public.rfq_distributions;
CREATE POLICY "RFQ distributions viewable by same tenant" ON public.rfq_distributions FOR SELECT USING (EXISTS (SELECT 1 FROM public.rfqs WHERE rfqs.id = rfq_distributions.rfq_id AND is_same_tenant(rfqs.created_by)));
CREATE POLICY "Procurement can manage same tenant RFQ distributions" ON public.rfq_distributions FOR ALL USING (EXISTS (SELECT 1 FROM public.rfqs WHERE rfqs.id = rfq_distributions.rfq_id AND is_same_tenant(rfqs.created_by)) AND is_procurement_or_above(auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM public.rfqs WHERE rfqs.id = rfq_distributions.rfq_id AND is_same_tenant(rfqs.created_by)) AND is_procurement_or_above(auth.uid()));

-- ---- INTEGRATION_LOGS ----
DROP POLICY IF EXISTS "Only admins can view integration logs" ON public.integration_logs;
DROP POLICY IF EXISTS "System can create integration logs" ON public.integration_logs;
CREATE POLICY "Admins can view same tenant integration logs" ON public.integration_logs FOR SELECT USING (is_admin_or_above(auth.uid()));
CREATE POLICY "System can create integration logs" ON public.integration_logs FOR INSERT WITH CHECK (true);

-- ---- PRICING_ALERTS ----
DROP POLICY IF EXISTS "Managers and above can view pricing alerts" ON public.pricing_alerts;
DROP POLICY IF EXISTS "System can insert pricing alerts" ON public.pricing_alerts;
DROP POLICY IF EXISTS "Managers and above can update pricing alerts" ON public.pricing_alerts;
CREATE POLICY "Same tenant can view pricing alerts" ON public.pricing_alerts FOR SELECT USING (EXISTS (SELECT 1 FROM public.products WHERE products.id = pricing_alerts.product_id AND is_my_tenant(products.tenant_id)) AND (is_manager_or_above(auth.uid()) OR is_procurement_or_above(auth.uid())));
CREATE POLICY "System can insert pricing alerts" ON public.pricing_alerts FOR INSERT WITH CHECK (true);
CREATE POLICY "Same tenant can update pricing alerts" ON public.pricing_alerts FOR UPDATE USING (EXISTS (SELECT 1 FROM public.products WHERE products.id = pricing_alerts.product_id AND is_my_tenant(products.tenant_id)) AND (is_manager_or_above(auth.uid()) OR is_procurement_or_above(auth.uid())));

-- ============================================================
-- PHASE 4: Update profiles & user_roles SELECT policy
-- ============================================================

DROP POLICY IF EXISTS "Profiles are viewable by authenticated users" ON public.profiles;
DROP POLICY IF EXISTS "Users can view all active profiles" ON public.profiles;
CREATE POLICY "Profiles viewable by same tenant" ON public.profiles FOR SELECT USING (is_same_tenant(id));

DROP POLICY IF EXISTS "Users can view all roles" ON public.user_roles;
DROP POLICY IF EXISTS "User roles are viewable by authenticated users" ON public.user_roles;
CREATE POLICY "User roles viewable by same tenant" ON public.user_roles FOR SELECT USING (is_same_tenant(user_id));
