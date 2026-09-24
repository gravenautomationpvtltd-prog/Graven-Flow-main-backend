
-- =========================================================================
-- Phase 1: Verticals foundation
-- =========================================================================

-- 1. verticals table
CREATE TABLE IF NOT EXISTS public.verticals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  code text NOT NULL,
  name text NOT NULL,
  doc_prefix text NOT NULL,
  logo_url text,
  letterhead_url text,
  address text,
  city text,
  state text,
  country text DEFAULT 'India',
  phone text,
  email text,
  website text,
  gst_number text,
  currency text DEFAULT 'INR',
  is_default boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, code)
);
CREATE INDEX IF NOT EXISTS idx_verticals_tenant ON public.verticals(tenant_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_verticals_one_default_per_tenant
  ON public.verticals(tenant_id) WHERE is_default = true;

-- 2. vertical_users
CREATE TABLE IF NOT EXISTS public.vertical_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vertical_id uuid NOT NULL REFERENCES public.verticals(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role text NOT NULL DEFAULT 'member',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (vertical_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_vertical_users_user ON public.vertical_users(user_id);
CREATE INDEX IF NOT EXISTS idx_vertical_users_vertical ON public.vertical_users(vertical_id);

-- 3. Helper functions
CREATE OR REPLACE FUNCTION public.user_has_vertical(_user_id uuid, _vertical_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.vertical_users
    WHERE user_id = _user_id AND vertical_id = _vertical_id AND is_active = true
  ) OR EXISTS (
    SELECT 1 FROM public.tenant_users tu
    JOIN public.verticals v ON v.tenant_id = tu.tenant_id
    WHERE tu.user_id = _user_id AND tu.is_active = true
      AND tu.role IN ('owner','admin') AND v.id = _vertical_id
  );
$$;

CREATE OR REPLACE FUNCTION public.get_user_default_vertical(_user_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT v.id FROM public.verticals v
  JOIN public.tenant_users tu ON tu.tenant_id = v.tenant_id
  WHERE tu.user_id = _user_id AND tu.is_active = true
    AND v.is_active = true AND v.is_default = true
  ORDER BY v.created_at LIMIT 1;
$$;

-- 4. RLS
ALTER TABLE public.verticals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vertical_users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "verticals_select" ON public.verticals;
CREATE POLICY "verticals_select" ON public.verticals FOR SELECT TO authenticated
USING (tenant_id = public.get_user_tenant_id(auth.uid()));

DROP POLICY IF EXISTS "verticals_insert" ON public.verticals;
CREATE POLICY "verticals_insert" ON public.verticals FOR INSERT TO authenticated
WITH CHECK (
  tenant_id = public.get_user_tenant_id(auth.uid())
  AND EXISTS (SELECT 1 FROM public.tenant_users tu WHERE tu.user_id = auth.uid()
    AND tu.tenant_id = verticals.tenant_id AND tu.is_active = true AND tu.role IN ('owner','admin'))
);

DROP POLICY IF EXISTS "verticals_update" ON public.verticals;
CREATE POLICY "verticals_update" ON public.verticals FOR UPDATE TO authenticated
USING (
  tenant_id = public.get_user_tenant_id(auth.uid())
  AND EXISTS (SELECT 1 FROM public.tenant_users tu WHERE tu.user_id = auth.uid()
    AND tu.tenant_id = verticals.tenant_id AND tu.is_active = true AND tu.role IN ('owner','admin'))
);

DROP POLICY IF EXISTS "verticals_delete" ON public.verticals;
CREATE POLICY "verticals_delete" ON public.verticals FOR DELETE TO authenticated
USING (
  tenant_id = public.get_user_tenant_id(auth.uid())
  AND EXISTS (SELECT 1 FROM public.tenant_users tu WHERE tu.user_id = auth.uid()
    AND tu.tenant_id = verticals.tenant_id AND tu.is_active = true AND tu.role IN ('owner','admin'))
);

DROP POLICY IF EXISTS "vertical_users_select" ON public.vertical_users;
CREATE POLICY "vertical_users_select" ON public.vertical_users FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.verticals v WHERE v.id = vertical_users.vertical_id
  AND v.tenant_id = public.get_user_tenant_id(auth.uid())));

DROP POLICY IF EXISTS "vertical_users_manage" ON public.vertical_users;
CREATE POLICY "vertical_users_manage" ON public.vertical_users FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.verticals v
  JOIN public.tenant_users tu ON tu.tenant_id = v.tenant_id
  WHERE v.id = vertical_users.vertical_id AND tu.user_id = auth.uid()
    AND tu.is_active = true AND tu.role IN ('owner','admin')))
WITH CHECK (EXISTS (SELECT 1 FROM public.verticals v
  JOIN public.tenant_users tu ON tu.tenant_id = v.tenant_id
  WHERE v.id = vertical_users.vertical_id AND tu.user_id = auth.uid()
    AND tu.is_active = true AND tu.role IN ('owner','admin')));

-- 5. Seed default vertical per tenant
INSERT INTO public.verticals (tenant_id, code, name, doc_prefix, is_default, is_active)
SELECT t.id, 'DEFAULT',
  COALESCE(NULLIF(t.company_name,''), 'Default'),
  UPPER(LEFT(REGEXP_REPLACE(COALESCE(t.company_name,'DEF'), '[^A-Za-z0-9]', '', 'g'), 2)),
  true, true
FROM public.tenants t
WHERE NOT EXISTS (SELECT 1 FROM public.verticals v WHERE v.tenant_id = t.id);

-- Rename Graven default
UPDATE public.verticals
SET name='Graven Automation', code='GRAVEN', doc_prefix='GA'
WHERE tenant_id='1a5184ef-5138-4327-8928-67bc4f229131' AND is_default=true AND code='DEFAULT';

-- Seed Glidex
INSERT INTO public.verticals (tenant_id, code, name, doc_prefix, is_default, is_active)
SELECT '1a5184ef-5138-4327-8928-67bc4f229131'::uuid, 'GLIDEX','Glidex Lubricants','GL',false,true
WHERE NOT EXISTS (SELECT 1 FROM public.verticals
  WHERE tenant_id='1a5184ef-5138-4327-8928-67bc4f229131' AND code='GLIDEX');

-- 6. Seed vertical_users from tenant_users
INSERT INTO public.vertical_users (vertical_id, user_id, role, is_active)
SELECT v.id, tu.user_id, tu.role, true
FROM public.tenant_users tu
JOIN public.verticals v ON v.tenant_id = tu.tenant_id AND v.is_default = true
WHERE tu.is_active = true
ON CONFLICT (vertical_id, user_id) DO NOTHING;

INSERT INTO public.vertical_users (vertical_id, user_id, role, is_active)
SELECT v.id, tu.user_id, tu.role, true
FROM public.tenant_users tu
JOIN public.verticals v ON v.tenant_id = tu.tenant_id AND v.code = 'GLIDEX'
WHERE tu.is_active = true AND tu.role IN ('owner','admin')
  AND tu.tenant_id = '1a5184ef-5138-4327-8928-67bc4f229131'
ON CONFLICT (vertical_id, user_id) DO NOTHING;

-- 7. Add vertical_id columns
ALTER TABLE public.leads                    ADD COLUMN IF NOT EXISTS vertical_id uuid REFERENCES public.verticals(id);
ALTER TABLE public.customers                ADD COLUMN IF NOT EXISTS vertical_id uuid REFERENCES public.verticals(id);
ALTER TABLE public.quotations               ADD COLUMN IF NOT EXISTS vertical_id uuid REFERENCES public.verticals(id);
ALTER TABLE public.sales_orders             ADD COLUMN IF NOT EXISTS vertical_id uuid REFERENCES public.verticals(id);
ALTER TABLE public.invoices                 ADD COLUMN IF NOT EXISTS vertical_id uuid REFERENCES public.verticals(id);
ALTER TABLE public.purchase_orders          ADD COLUMN IF NOT EXISTS vertical_id uuid REFERENCES public.verticals(id);
ALTER TABLE public.dispatches               ADD COLUMN IF NOT EXISTS vertical_id uuid REFERENCES public.verticals(id);
ALTER TABLE public.cct_sourcing_decisions   ADD COLUMN IF NOT EXISTS vertical_id uuid REFERENCES public.verticals(id);
ALTER TABLE public.lead_qualification       ADD COLUMN IF NOT EXISTS vertical_id uuid REFERENCES public.verticals(id);
ALTER TABLE public.customer_payments        ADD COLUMN IF NOT EXISTS vertical_id uuid REFERENCES public.verticals(id);
ALTER TABLE public.products                 ADD COLUMN IF NOT EXISTS vertical_id uuid REFERENCES public.verticals(id);
ALTER TABLE public.lead_assignment_rules    ADD COLUMN IF NOT EXISTS vertical_id uuid REFERENCES public.verticals(id);
ALTER TABLE public.enquiry_items            ADD COLUMN IF NOT EXISTS vertical_id uuid REFERENCES public.verticals(id);
ALTER TABLE public.notifications            ADD COLUMN IF NOT EXISTS vertical_id uuid REFERENCES public.verticals(id);

-- 8. Backfill - tables that have tenant_id directly
UPDATE public.leads t SET vertical_id = v.id
  FROM public.verticals v WHERE t.vertical_id IS NULL AND v.tenant_id = t.tenant_id AND v.is_default = true;
UPDATE public.customers t SET vertical_id = v.id
  FROM public.verticals v WHERE t.vertical_id IS NULL AND v.tenant_id = t.tenant_id AND v.is_default = true;
UPDATE public.quotations t SET vertical_id = v.id
  FROM public.verticals v WHERE t.vertical_id IS NULL AND v.tenant_id = t.tenant_id AND v.is_default = true;
UPDATE public.sales_orders t SET vertical_id = v.id
  FROM public.verticals v WHERE t.vertical_id IS NULL AND v.tenant_id = t.tenant_id AND v.is_default = true;
UPDATE public.cct_sourcing_decisions t SET vertical_id = v.id
  FROM public.verticals v WHERE t.vertical_id IS NULL AND v.tenant_id = t.tenant_id AND v.is_default = true;
UPDATE public.lead_qualification t SET vertical_id = v.id
  FROM public.verticals v WHERE t.vertical_id IS NULL AND v.tenant_id = t.tenant_id AND v.is_default = true;
UPDATE public.products t SET vertical_id = v.id
  FROM public.verticals v WHERE t.vertical_id IS NULL AND v.tenant_id = t.tenant_id AND v.is_default = true;
UPDATE public.lead_assignment_rules t SET vertical_id = v.id
  FROM public.verticals v WHERE t.vertical_id IS NULL AND v.tenant_id = t.tenant_id AND v.is_default = true;

-- Backfill via joins (no tenant_id on these tables)
UPDATE public.invoices t SET vertical_id = so.vertical_id
  FROM public.sales_orders so WHERE t.vertical_id IS NULL AND t.sales_order_id = so.id;
UPDATE public.invoices t SET vertical_id = c.vertical_id
  FROM public.customers c WHERE t.vertical_id IS NULL AND t.customer_id = c.id;

UPDATE public.purchase_orders t SET vertical_id = so.vertical_id
  FROM public.sales_orders so WHERE t.vertical_id IS NULL AND t.sales_order_id = so.id;
UPDATE public.purchase_orders t SET vertical_id = q.vertical_id
  FROM public.quotations q WHERE t.vertical_id IS NULL AND t.quotation_id = q.id;
UPDATE public.purchase_orders t SET vertical_id = l.vertical_id
  FROM public.leads l WHERE t.vertical_id IS NULL AND t.lead_id = l.id;

UPDATE public.dispatches t SET vertical_id = so.vertical_id
  FROM public.sales_orders so WHERE t.vertical_id IS NULL AND t.sales_order_id = so.id;
UPDATE public.dispatches t SET vertical_id = c.vertical_id
  FROM public.customers c WHERE t.vertical_id IS NULL AND t.customer_id = c.id;

UPDATE public.customer_payments t SET vertical_id = so.vertical_id
  FROM public.sales_orders so WHERE t.vertical_id IS NULL AND t.sales_order_id = so.id;
UPDATE public.customer_payments t SET vertical_id = c.vertical_id
  FROM public.customers c WHERE t.vertical_id IS NULL AND t.customer_id = c.id;

UPDATE public.enquiry_items t SET vertical_id = l.vertical_id
  FROM public.leads l WHERE t.vertical_id IS NULL AND t.lead_id = l.id;
UPDATE public.enquiry_items t SET vertical_id = q.vertical_id
  FROM public.quotations q WHERE t.vertical_id IS NULL AND t.quotation_id = q.id;

UPDATE public.notifications t SET vertical_id = v.id
  FROM public.tenant_users tu
  JOIN public.verticals v ON v.tenant_id = tu.tenant_id AND v.is_default = true
  WHERE t.vertical_id IS NULL AND tu.user_id = t.user_id AND tu.is_active = true;

-- 9. Indexes
CREATE INDEX IF NOT EXISTS idx_leads_vertical                  ON public.leads(vertical_id);
CREATE INDEX IF NOT EXISTS idx_customers_vertical              ON public.customers(vertical_id);
CREATE INDEX IF NOT EXISTS idx_quotations_vertical             ON public.quotations(vertical_id);
CREATE INDEX IF NOT EXISTS idx_sales_orders_vertical           ON public.sales_orders(vertical_id);
CREATE INDEX IF NOT EXISTS idx_invoices_vertical               ON public.invoices(vertical_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_vertical        ON public.purchase_orders(vertical_id);
CREATE INDEX IF NOT EXISTS idx_dispatches_vertical             ON public.dispatches(vertical_id);
CREATE INDEX IF NOT EXISTS idx_cct_sourcing_decisions_vertical ON public.cct_sourcing_decisions(vertical_id);
CREATE INDEX IF NOT EXISTS idx_lead_qualification_vertical     ON public.lead_qualification(vertical_id);
CREATE INDEX IF NOT EXISTS idx_customer_payments_vertical      ON public.customer_payments(vertical_id);
CREATE INDEX IF NOT EXISTS idx_products_vertical               ON public.products(vertical_id);
CREATE INDEX IF NOT EXISTS idx_lead_assignment_rules_vertical  ON public.lead_assignment_rules(vertical_id);
CREATE INDEX IF NOT EXISTS idx_enquiry_items_vertical          ON public.enquiry_items(vertical_id);
CREATE INDEX IF NOT EXISTS idx_notifications_vertical          ON public.notifications(vertical_id);

-- 10. Trigger
DROP TRIGGER IF EXISTS trg_verticals_updated_at ON public.verticals;
CREATE TRIGGER trg_verticals_updated_at
BEFORE UPDATE ON public.verticals FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
