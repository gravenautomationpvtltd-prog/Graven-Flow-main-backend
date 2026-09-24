-- Phase 2: TST / BOQ schema

-- 1. BOQ status enum
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'boq_status') THEN
    CREATE TYPE public.boq_status AS ENUM ('draft', 'in_progress', 'ready_for_sales', 'handed_off', 'on_hold');
  END IF;
END $$;

-- 2. Feasibility enum
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'boq_feasibility') THEN
    CREATE TYPE public.boq_feasibility AS ENUM ('feasible', 'not_feasible', 'needs_clarification');
  END IF;
END $$;

-- 3. BOQ item category enum
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'boq_item_category') THEN
    CREATE TYPE public.boq_item_category AS ENUM ('vfd', 'plc', 'hmi', 'sensor', 'motor', 'panel', 'cable', 'accessory', 'other');
  END IF;
END $$;

-- 4. boqs table
CREATE TABLE IF NOT EXISTS public.boqs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  status public.boq_status NOT NULL DEFAULT 'draft',
  assigned_to UUID REFERENCES public.profiles(id),
  technical_notes TEXT,
  feasibility public.boq_feasibility,
  feasibility_notes TEXT,
  handoff_to_sales_at TIMESTAMPTZ,
  handoff_by UUID REFERENCES public.profiles(id),
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_boqs_lead ON public.boqs(lead_id);
CREATE INDEX IF NOT EXISTS idx_boqs_tenant ON public.boqs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_boqs_status ON public.boqs(status);
CREATE INDEX IF NOT EXISTS idx_boqs_assigned ON public.boqs(assigned_to);

-- 5. boq_items table
CREATE TABLE IF NOT EXISTS public.boq_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  boq_id UUID NOT NULL REFERENCES public.boqs(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  category public.boq_item_category NOT NULL DEFAULT 'other',
  model_number TEXT,
  manufacturer TEXT,
  description TEXT NOT NULL,
  quantity NUMERIC NOT NULL DEFAULT 1,
  unit TEXT DEFAULT 'pcs',
  estimated_unit_price NUMERIC,
  technical_specs JSONB,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_boq_items_boq ON public.boq_items(boq_id);

-- 6. Enable RLS
ALTER TABLE public.boqs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.boq_items ENABLE ROW LEVEL SECURITY;

-- 7. boqs RLS
CREATE POLICY "Tenant members can view BOQs"
ON public.boqs FOR SELECT
USING (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "TST and managers can create BOQs"
ON public.boqs FOR INSERT
WITH CHECK (
  tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
  AND (
    public.has_role(auth.uid(), 'tst')
    OR public.has_role(auth.uid(), 'manager')
    OR public.has_role(auth.uid(), 'coo')
    OR public.has_role(auth.uid(), 'super_admin')
  )
);

CREATE POLICY "TST and managers can update BOQs"
ON public.boqs FOR UPDATE
USING (
  tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
  AND (
    public.has_role(auth.uid(), 'tst')
    OR public.has_role(auth.uid(), 'manager')
    OR public.has_role(auth.uid(), 'coo')
    OR public.has_role(auth.uid(), 'super_admin')
  )
);

CREATE POLICY "Managers can delete BOQs"
ON public.boqs FOR DELETE
USING (
  public.has_role(auth.uid(), 'manager')
  OR public.has_role(auth.uid(), 'coo')
  OR public.has_role(auth.uid(), 'super_admin')
);

-- 8. boq_items RLS — inherit from parent boq
CREATE POLICY "View BOQ items via parent"
ON public.boq_items FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.boqs b
    WHERE b.id = boq_items.boq_id
    AND b.tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
  )
);

CREATE POLICY "TST and managers can manage BOQ items"
ON public.boq_items FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.boqs b
    WHERE b.id = boq_items.boq_id
    AND b.tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
    AND (
      public.has_role(auth.uid(), 'tst')
      OR public.has_role(auth.uid(), 'manager')
      OR public.has_role(auth.uid(), 'coo')
      OR public.has_role(auth.uid(), 'super_admin')
    )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.boqs b
    WHERE b.id = boq_items.boq_id
    AND b.tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
  )
);

-- 9. updated_at triggers
CREATE TRIGGER update_boqs_updated_at
BEFORE UPDATE ON public.boqs
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_boq_items_updated_at
BEFORE UPDATE ON public.boq_items
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 10. Auto-set tenant_id from lead on BOQ insert
CREATE OR REPLACE FUNCTION public.set_boq_tenant()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.tenant_id IS NULL THEN
    SELECT tenant_id INTO NEW.tenant_id FROM public.leads WHERE id = NEW.lead_id;
  END IF;
  IF NEW.created_by IS NULL THEN
    NEW.created_by := auth.uid();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_set_boq_tenant
BEFORE INSERT ON public.boqs
FOR EACH ROW EXECUTE FUNCTION public.set_boq_tenant();

-- 11. Auto-create draft BOQ when lead is qualified as 'technical'
CREATE OR REPLACE FUNCTION public.auto_create_boq_on_technical_qualification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id UUID;
BEGIN
  IF NEW.qualification_type = 'technical' AND NEW.routed_to = 'tst' THEN
    -- Only create if no BOQ exists yet
    IF NOT EXISTS (SELECT 1 FROM public.boqs WHERE lead_id = NEW.lead_id) THEN
      SELECT tenant_id INTO v_tenant_id FROM public.leads WHERE id = NEW.lead_id;
      INSERT INTO public.boqs (lead_id, tenant_id, status, technical_notes, created_by)
      VALUES (
        NEW.lead_id,
        v_tenant_id,
        'draft',
        COALESCE(NEW.notes, NEW.decision_reason),
        NEW.qualified_by
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_auto_create_boq_on_qualification
AFTER INSERT OR UPDATE ON public.lead_qualification
FOR EACH ROW EXECUTE FUNCTION public.auto_create_boq_on_technical_qualification();