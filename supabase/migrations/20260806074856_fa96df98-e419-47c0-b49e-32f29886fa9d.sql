-- 1. New columns on price_requests
ALTER TABLE public.price_requests
  ADD COLUMN IF NOT EXISTS current_round integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS target_matched_at timestamptz,
  ADD COLUMN IF NOT EXISTS sales_outcome text,
  ADD COLUMN IF NOT EXISTS last_priced_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

-- 2. Quotes table
CREATE TABLE IF NOT EXISTS public.price_request_quotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  price_request_id uuid NOT NULL REFERENCES public.price_requests(id) ON DELETE CASCADE,
  tenant_id uuid,
  round integer NOT NULL DEFAULT 1,
  supplier_id uuid REFERENCES public.suppliers(id) ON DELETE SET NULL,
  supplier_name text,
  purchase_price numeric NOT NULL,
  sale_price numeric,
  currency text NOT NULL DEFAULT 'INR',
  fx_rate numeric,
  moq numeric,
  lead_time_days integer,
  valid_until date,
  notes text,
  is_pushed boolean NOT NULL DEFAULT false,
  pushed_at timestamptz,
  pushed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.price_request_quotes TO authenticated;
GRANT ALL ON public.price_request_quotes TO service_role;
ALTER TABLE public.price_request_quotes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "prq_select_tenant" ON public.price_request_quotes
  FOR SELECT TO authenticated
  USING (tenant_id IS NULL OR public.is_my_tenant(tenant_id));

CREATE POLICY "prq_insert_procurement" ON public.price_request_quotes
  FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND (tenant_id IS NULL OR public.is_my_tenant(tenant_id))
  );

CREATE POLICY "prq_update_procurement" ON public.price_request_quotes
  FOR UPDATE TO authenticated
  USING (tenant_id IS NULL OR public.is_my_tenant(tenant_id))
  WITH CHECK (tenant_id IS NULL OR public.is_my_tenant(tenant_id));

CREATE POLICY "prq_delete_owner_or_manager" ON public.price_request_quotes
  FOR DELETE TO authenticated
  USING (created_by = auth.uid() OR public.is_manager_or_above(auth.uid()));

-- 3. Negotiation rounds table
CREATE TABLE IF NOT EXISTS public.price_request_rounds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  price_request_id uuid NOT NULL REFERENCES public.price_requests(id) ON DELETE CASCADE,
  tenant_id uuid,
  round integer NOT NULL DEFAULT 1,
  target_price numeric,
  requested_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  requested_at timestamptz NOT NULL DEFAULT now(),
  responder_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  revised_price numeric,
  responded_at timestamptz,
  outcome text NOT NULL DEFAULT 'open',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.price_request_rounds TO authenticated;
GRANT ALL ON public.price_request_rounds TO service_role;
ALTER TABLE public.price_request_rounds ENABLE ROW LEVEL SECURITY;

CREATE POLICY "prr_select_tenant" ON public.price_request_rounds
  FOR SELECT TO authenticated
  USING (tenant_id IS NULL OR public.is_my_tenant(tenant_id));

CREATE POLICY "prr_insert_auth" ON public.price_request_rounds
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id IS NULL OR public.is_my_tenant(tenant_id));

CREATE POLICY "prr_update_auth" ON public.price_request_rounds
  FOR UPDATE TO authenticated
  USING (tenant_id IS NULL OR public.is_my_tenant(tenant_id))
  WITH CHECK (tenant_id IS NULL OR public.is_my_tenant(tenant_id));

CREATE POLICY "prr_delete_manager" ON public.price_request_rounds
  FOR DELETE TO authenticated
  USING (requested_by = auth.uid() OR public.is_manager_or_above(auth.uid()));

-- 4. updated_at triggers
CREATE TRIGGER trg_prq_updated_at BEFORE UPDATE ON public.price_request_quotes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_prr_updated_at BEFORE UPDATE ON public.price_request_rounds
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5. Indexes
CREATE INDEX IF NOT EXISTS idx_prq_request ON public.price_request_quotes(price_request_id);
CREATE INDEX IF NOT EXISTS idx_prq_pushed ON public.price_request_quotes(price_request_id, is_pushed);
CREATE INDEX IF NOT EXISTS idx_prr_request ON public.price_request_rounds(price_request_id, round);
CREATE INDEX IF NOT EXISTS idx_pr_tenant_status_requested ON public.price_requests(tenant_id, status, requested_at DESC);
CREATE INDEX IF NOT EXISTS idx_pr_assigned_status ON public.price_requests(assigned_to, status);
CREATE INDEX IF NOT EXISTS idx_pr_target_matched ON public.price_requests(target_matched_at) WHERE target_matched_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_pr_requested_at ON public.price_requests(requested_at DESC);