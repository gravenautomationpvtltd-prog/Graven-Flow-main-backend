-- Enums
DO $$ BEGIN
  CREATE TYPE public.cct_sourcing_type AS ENUM ('domestic', 'import', 'hybrid');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE public.cct_assigned_team AS ENUM ('domestic_procurement', 'import_procurement');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE public.cct_stage AS ENUM (
    'assigned', 'in_sourcing', 'price_finalized', 'order_placed', 'in_transit', 'delivered'
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE public.cct_priority AS ENUM ('low', 'normal', 'high', 'urgent');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Decisions table
CREATE TABLE IF NOT EXISTS public.cct_sourcing_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  sales_order_id UUID REFERENCES public.sales_orders(id) ON DELETE CASCADE,
  order_item_id UUID,
  lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  product_description TEXT,
  brand TEXT,
  quantity NUMERIC,
  selling_price NUMERIC,
  sourcing_type public.cct_sourcing_type NOT NULL DEFAULT 'domestic',
  target_price NUMERIC,
  assigned_team public.cct_assigned_team,
  assigned_to UUID REFERENCES public.profiles(id),
  priority public.cct_priority NOT NULL DEFAULT 'normal',
  timeline_date DATE,
  decided_by UUID REFERENCES public.profiles(id),
  decided_at TIMESTAMPTZ,
  locked BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL DEFAULT 'pending',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cct_decisions_tenant ON public.cct_sourcing_decisions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_cct_decisions_order ON public.cct_sourcing_decisions(sales_order_id);
CREATE INDEX IF NOT EXISTS idx_cct_decisions_status ON public.cct_sourcing_decisions(status);
CREATE INDEX IF NOT EXISTS idx_cct_decisions_assigned ON public.cct_sourcing_decisions(assigned_to);

ALTER TABLE public.cct_sourcing_decisions ENABLE ROW LEVEL SECURITY;

-- Stages table
CREATE TABLE IF NOT EXISTS public.cct_order_stages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  decision_id UUID NOT NULL REFERENCES public.cct_sourcing_decisions(id) ON DELETE CASCADE,
  stage public.cct_stage NOT NULL,
  supplier_name TEXT,
  final_price NUMERIC,
  lead_time_days INTEGER,
  notes TEXT,
  updated_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cct_stages_decision ON public.cct_order_stages(decision_id);
CREATE INDEX IF NOT EXISTS idx_cct_stages_tenant ON public.cct_order_stages(tenant_id);

ALTER TABLE public.cct_order_stages ENABLE ROW LEVEL SECURITY;

-- is_cct helper
CREATE OR REPLACE FUNCTION public.is_cct(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('cct'::app_role, 'super_admin'::app_role, 'coo'::app_role)
  )
$$;

-- RLS: decisions
DROP POLICY IF EXISTS "Tenant members can view CCT decisions" ON public.cct_sourcing_decisions;
CREATE POLICY "Tenant members can view CCT decisions"
ON public.cct_sourcing_decisions FOR SELECT
USING (public.is_my_tenant(tenant_id));

DROP POLICY IF EXISTS "CCT can insert decisions" ON public.cct_sourcing_decisions;
CREATE POLICY "CCT can insert decisions"
ON public.cct_sourcing_decisions FOR INSERT
WITH CHECK (public.is_my_tenant(tenant_id) AND (public.is_cct(auth.uid()) OR public.is_admin_or_above(auth.uid())));

DROP POLICY IF EXISTS "CCT can update decisions" ON public.cct_sourcing_decisions;
CREATE POLICY "CCT can update decisions"
ON public.cct_sourcing_decisions FOR UPDATE
USING (public.is_my_tenant(tenant_id) AND (public.is_cct(auth.uid()) OR public.is_admin_or_above(auth.uid())));

DROP POLICY IF EXISTS "Admins can delete decisions" ON public.cct_sourcing_decisions;
CREATE POLICY "Admins can delete decisions"
ON public.cct_sourcing_decisions FOR DELETE
USING (public.is_admin_or_above(auth.uid()));

-- RLS: stages
DROP POLICY IF EXISTS "Tenant members can view stages" ON public.cct_order_stages;
CREATE POLICY "Tenant members can view stages"
ON public.cct_order_stages FOR SELECT
USING (public.is_my_tenant(tenant_id));

DROP POLICY IF EXISTS "CCT and procurement can insert stages" ON public.cct_order_stages;
CREATE POLICY "CCT and procurement can insert stages"
ON public.cct_order_stages FOR INSERT
WITH CHECK (
  public.is_my_tenant(tenant_id) AND (
    public.is_cct(auth.uid())
    OR public.is_procurement_or_above(auth.uid())
    OR public.is_admin_or_above(auth.uid())
  )
);

DROP POLICY IF EXISTS "CCT and admins can update stages" ON public.cct_order_stages;
CREATE POLICY "CCT and admins can update stages"
ON public.cct_order_stages FOR UPDATE
USING (public.is_my_tenant(tenant_id) AND (public.is_cct(auth.uid()) OR public.is_admin_or_above(auth.uid())));

-- Trigger: lock target_price modifications
CREATE OR REPLACE FUNCTION public.prevent_target_price_override()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF OLD.target_price IS DISTINCT FROM NEW.target_price THEN
    IF NOT (public.is_cct(auth.uid()) OR public.is_admin_or_above(auth.uid())) THEN
      RAISE EXCEPTION 'Only CCT can modify the target price';
    END IF;
  END IF;
  IF OLD.locked = true AND (
    OLD.sourcing_type IS DISTINCT FROM NEW.sourcing_type
    OR OLD.assigned_team IS DISTINCT FROM NEW.assigned_team
    OR OLD.target_price IS DISTINCT FROM NEW.target_price
  ) AND NOT public.is_admin_or_above(auth.uid()) THEN
    RAISE EXCEPTION 'Decision is locked. Only admins can modify locked decisions.';
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_target_price_override ON public.cct_sourcing_decisions;
CREATE TRIGGER trg_prevent_target_price_override
BEFORE UPDATE ON public.cct_sourcing_decisions
FOR EACH ROW EXECUTE FUNCTION public.prevent_target_price_override();

-- Auto-create CCT inbox entry on sales order
CREATE OR REPLACE FUNCTION public.auto_create_cct_decision_on_order()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.cct_sourcing_decisions (
    tenant_id, sales_order_id, lead_id, selling_price, status
  ) VALUES (
    NEW.tenant_id, NEW.id, NEW.lead_id, NEW.order_value, 'pending'
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_create_cct_decision ON public.sales_orders;
CREATE TRIGGER trg_auto_create_cct_decision
AFTER INSERT ON public.sales_orders
FOR EACH ROW EXECUTE FUNCTION public.auto_create_cct_decision_on_order();

-- Auto-create initial 'assigned' stage on handoff
CREATE OR REPLACE FUNCTION public.auto_create_initial_stage()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'handed_off' AND (OLD.status IS DISTINCT FROM NEW.status) THEN
    INSERT INTO public.cct_order_stages (tenant_id, decision_id, stage, updated_by)
    VALUES (NEW.tenant_id, NEW.id, 'assigned', auth.uid());
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_create_initial_stage ON public.cct_sourcing_decisions;
CREATE TRIGGER trg_auto_create_initial_stage
AFTER UPDATE ON public.cct_sourcing_decisions
FOR EACH ROW EXECUTE FUNCTION public.auto_create_initial_stage();