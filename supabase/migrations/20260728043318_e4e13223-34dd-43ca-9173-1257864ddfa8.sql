
ALTER TABLE public.quotations   ADD COLUMN IF NOT EXISTS office_id uuid REFERENCES public.offices(id);
ALTER TABLE public.sales_orders ADD COLUMN IF NOT EXISTS office_id uuid REFERENCES public.offices(id);
ALTER TABLE public.invoices     ADD COLUMN IF NOT EXISTS office_id uuid REFERENCES public.offices(id);

CREATE INDEX IF NOT EXISTS idx_quotations_office_id   ON public.quotations(office_id);
CREATE INDEX IF NOT EXISTS idx_sales_orders_office_id ON public.sales_orders(office_id);
CREATE INDEX IF NOT EXISTS idx_invoices_office_id     ON public.invoices(office_id);

UPDATE public.customers c SET office_id = p.office_id
  FROM public.profiles p
 WHERE c.office_id IS NULL AND c.assigned_sales_id = p.id AND p.office_id IS NOT NULL;

UPDATE public.leads l SET office_id = p.office_id
  FROM public.profiles p
 WHERE l.office_id IS NULL AND l.assigned_to = p.id AND p.office_id IS NOT NULL;

UPDATE public.quotations q SET office_id = p.office_id
  FROM public.profiles p
 WHERE q.office_id IS NULL AND q.created_by = p.id AND p.office_id IS NOT NULL;

UPDATE public.sales_orders so SET office_id = q.office_id
  FROM public.quotations q
 WHERE so.office_id IS NULL AND so.quotation_id = q.id AND q.office_id IS NOT NULL;

UPDATE public.sales_orders so SET office_id = p.office_id
  FROM public.profiles p
 WHERE so.office_id IS NULL AND so.created_by = p.id AND p.office_id IS NOT NULL;

UPDATE public.invoices i SET office_id = so.office_id
  FROM public.sales_orders so
 WHERE i.office_id IS NULL AND i.sales_order_id = so.id AND so.office_id IS NOT NULL;

UPDATE public.invoices i SET office_id = p.office_id
  FROM public.profiles p
 WHERE i.office_id IS NULL AND i.created_by = p.id AND p.office_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.current_user_office_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT office_id FROM public.profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.is_branch_scoped_role(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT NOT (
    public.is_admin_or_above(_user_id)
    OR public.is_procurement_or_above(_user_id)
    OR public.has_role(_user_id, 'accounts'::public.app_role)
    OR public.has_role(_user_id, 'hr'::public.app_role)
    OR public.has_role(_user_id, 'warehouse'::public.app_role)
    OR public.has_role(_user_id, 'platform_admin'::public.app_role)
  );
$$;

CREATE OR REPLACE FUNCTION public.branch_guard(_office_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT NOT public.is_branch_scoped_role(auth.uid())
    OR _office_id IS NULL
    OR _office_id = public.current_user_office_id();
$$;

CREATE OR REPLACE FUNCTION public.set_office_from_creator()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.office_id IS NULL THEN
    SELECT office_id INTO NEW.office_id FROM public.profiles WHERE id = auth.uid();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_office_quotations   ON public.quotations;
DROP TRIGGER IF EXISTS set_office_sales_orders ON public.sales_orders;
DROP TRIGGER IF EXISTS set_office_invoices     ON public.invoices;

CREATE TRIGGER set_office_quotations   BEFORE INSERT ON public.quotations   FOR EACH ROW EXECUTE FUNCTION public.set_office_from_creator();
CREATE TRIGGER set_office_sales_orders BEFORE INSERT ON public.sales_orders FOR EACH ROW EXECUTE FUNCTION public.set_office_from_creator();
CREATE TRIGGER set_office_invoices     BEFORE INSERT ON public.invoices     FOR EACH ROW EXECUTE FUNCTION public.set_office_from_creator();

DROP POLICY IF EXISTS "Lead visibility by role hierarchy" ON public.leads;
CREATE POLICY "Lead visibility by role hierarchy" ON public.leads FOR SELECT USING (
  is_my_tenant(tenant_id) AND public.branch_guard(office_id) AND (
    is_admin_or_above(auth.uid())
    OR (assigned_to = auth.uid())
    OR (is_manager_or_above(auth.uid()) AND (assigned_to = ANY (get_subordinate_ids(auth.uid()))))
    OR ((customer_id IS NOT NULL) AND (customer_id = ANY (get_user_cro_customer_ids(auth.uid()))))
    OR (id = ANY (get_user_quotation_lead_ids(auth.uid())))
    OR (id = ANY (get_user_qualified_lead_ids(auth.uid())))
    OR was_recent_lead_assignee(id, auth.uid())
  )
);

DROP POLICY IF EXISTS "Customers are viewable by authenticated users" ON public.customers;
CREATE POLICY "Customers are viewable by authenticated users" ON public.customers FOR SELECT USING (
  (deleted_at IS NULL) AND is_my_tenant(tenant_id) AND public.branch_guard(office_id) AND (
    is_admin_or_above(auth.uid())
    OR (assigned_sales_id = auth.uid())
    OR (assigned_sales_id = ANY (get_subordinate_ids(auth.uid())))
    OR (is_procurement_or_above(auth.uid()) AND EXISTS (SELECT 1 FROM sales_orders so WHERE so.customer_id = customers.id))
    OR EXISTS (SELECT 1 FROM cro_customer_assignments cca WHERE cca.customer_id = customers.id AND cca.cro_user_id = auth.uid())
    OR has_role(auth.uid(), 'accounts'::app_role)
  )
);

DROP POLICY IF EXISTS "Quotations viewable by authenticated users" ON public.quotations;
CREATE POLICY "Quotations viewable by authenticated users" ON public.quotations FOR SELECT USING (
  is_my_tenant(tenant_id) AND public.branch_guard(office_id) AND (
    is_admin_or_above(auth.uid())
    OR (created_by = auth.uid())
    OR (created_by = ANY (get_subordinate_ids(auth.uid())))
    OR is_procurement_or_above(auth.uid())
  )
);

DROP POLICY IF EXISTS "Sales orders viewable by authenticated users" ON public.sales_orders;
CREATE POLICY "Sales orders viewable by authenticated users" ON public.sales_orders FOR SELECT USING (
  is_my_tenant(tenant_id) AND public.branch_guard(office_id) AND (
    is_admin_or_above(auth.uid())
    OR (created_by = auth.uid())
    OR (created_by = ANY (get_subordinate_ids(auth.uid())))
    OR is_procurement_or_above(auth.uid())
    OR has_role(auth.uid(), 'accounts'::app_role)
  )
);

DROP POLICY IF EXISTS "Invoices viewable by authenticated users" ON public.invoices;
CREATE POLICY "Invoices viewable by authenticated users" ON public.invoices FOR SELECT USING (
  is_same_tenant(created_by) AND public.branch_guard(office_id)
);

CREATE OR REPLACE VIEW public.sales_orders_with_net WITH (security_invoker = on) AS
SELECT so.*, COALESCE(q.subtotal - COALESCE(q.total_discount, 0), so.order_value) AS net_value
FROM public.sales_orders so
LEFT JOIN public.quotations q ON q.id = so.quotation_id;

GRANT SELECT ON public.sales_orders_with_net TO authenticated;
GRANT SELECT ON public.sales_orders_with_net TO service_role;
