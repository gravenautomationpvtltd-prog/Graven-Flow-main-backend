-- Phase 1: LQT Qualification & Routing
-- Adds qualification decision layer (Simple → SPT, Technical → TST, Invalid → Discard)
-- Non-breaking: existing leads continue working without qualification records.

-- 1. Add 'tst' to app_role enum (only if not present)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum 
    WHERE enumlabel = 'tst' 
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'app_role')
  ) THEN
    ALTER TYPE public.app_role ADD VALUE 'tst';
  END IF;
END$$;

-- 2. Qualification type enum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'lead_qualification_type') THEN
    CREATE TYPE public.lead_qualification_type AS ENUM ('simple', 'technical', 'invalid');
  END IF;
END$$;

-- 3. Routing target enum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'lead_routing_target') THEN
    CREATE TYPE public.lead_routing_target AS ENUM ('spt', 'tst', 'discard', 'nurture');
  END IF;
END$$;

-- 4. lead_qualification table
CREATE TABLE IF NOT EXISTS public.lead_qualification (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  qualification_type public.lead_qualification_type NOT NULL,
  routed_to public.lead_routing_target NOT NULL,
  qualified_by UUID NOT NULL REFERENCES public.profiles(id),
  qualified_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  decision_reason TEXT,
  application TEXT,
  estimated_quantity NUMERIC,
  estimated_timeline TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lead_qualification_lead_id ON public.lead_qualification(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_qualification_tenant_id ON public.lead_qualification(tenant_id);
CREATE INDEX IF NOT EXISTS idx_lead_qualification_routed_to ON public.lead_qualification(routed_to);
CREATE UNIQUE INDEX IF NOT EXISTS uq_lead_qualification_active ON public.lead_qualification(lead_id);

-- 5. Enable RLS
ALTER TABLE public.lead_qualification ENABLE ROW LEVEL SECURITY;

-- 6. RLS policies — tenant scoped, similar to leads table
CREATE POLICY "Users can view qualifications in their tenant"
ON public.lead_qualification FOR SELECT
USING (
  tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
);

CREATE POLICY "Users can create qualifications in their tenant"
ON public.lead_qualification FOR INSERT
WITH CHECK (
  qualified_by = auth.uid()
  AND tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
);

CREATE POLICY "Qualifier or managers can update qualifications"
ON public.lead_qualification FOR UPDATE
USING (
  qualified_by = auth.uid()
  OR public.has_role(auth.uid(), 'super_admin')
  OR public.has_role(auth.uid(), 'coo')
  OR public.has_role(auth.uid(), 'manager')
);

CREATE POLICY "Admins can delete qualifications"
ON public.lead_qualification FOR DELETE
USING (
  public.has_role(auth.uid(), 'super_admin')
  OR public.has_role(auth.uid(), 'coo')
);

-- 7. updated_at trigger
CREATE TRIGGER update_lead_qualification_updated_at
BEFORE UPDATE ON public.lead_qualification
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- 8. Auto-set tenant_id from lead on insert if not provided
CREATE OR REPLACE FUNCTION public.set_lead_qualification_tenant()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.tenant_id IS NULL THEN
    SELECT tenant_id INTO NEW.tenant_id FROM public.leads WHERE id = NEW.lead_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_set_lead_qualification_tenant
BEFORE INSERT ON public.lead_qualification
FOR EACH ROW
EXECUTE FUNCTION public.set_lead_qualification_tenant();