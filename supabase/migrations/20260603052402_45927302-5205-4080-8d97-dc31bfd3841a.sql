
-- Settings table for per-tenant audit threshold + alert emails
CREATE TABLE public.assignment_audit_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL UNIQUE,
  alert_threshold INT NOT NULL DEFAULT 5,
  alert_emails TEXT[] NOT NULL DEFAULT '{}',
  alert_throttle_hours INT NOT NULL DEFAULT 6,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.assignment_audit_settings TO authenticated;
GRANT ALL ON public.assignment_audit_settings TO service_role;

ALTER TABLE public.assignment_audit_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read tenant audit settings"
  ON public.assignment_audit_settings FOR SELECT
  TO authenticated
  USING (
    tenant_id = (SELECT p.tenant_id FROM profiles p WHERE p.id = auth.uid())
    AND (has_role(auth.uid(),'super_admin') OR has_role(auth.uid(),'coo'))
  );

CREATE POLICY "Admins upsert tenant audit settings"
  ON public.assignment_audit_settings FOR INSERT
  TO authenticated
  WITH CHECK (
    tenant_id = (SELECT p.tenant_id FROM profiles p WHERE p.id = auth.uid())
    AND (has_role(auth.uid(),'super_admin') OR has_role(auth.uid(),'coo'))
  );

CREATE POLICY "Admins update tenant audit settings"
  ON public.assignment_audit_settings FOR UPDATE
  TO authenticated
  USING (
    tenant_id = (SELECT p.tenant_id FROM profiles p WHERE p.id = auth.uid())
    AND (has_role(auth.uid(),'super_admin') OR has_role(auth.uid(),'coo'))
  );

CREATE TRIGGER trg_audit_settings_updated_at
  BEFORE UPDATE ON public.assignment_audit_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Run history for the scheduled check
CREATE TABLE public.assignment_audit_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  ran_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  unlogged_count INT NOT NULL,
  threshold INT NOT NULL,
  alert_sent BOOLEAN NOT NULL DEFAULT false,
  alert_error TEXT
);

CREATE INDEX idx_audit_runs_tenant_ran_at ON public.assignment_audit_runs(tenant_id, ran_at DESC);

GRANT SELECT ON public.assignment_audit_runs TO authenticated;
GRANT ALL ON public.assignment_audit_runs TO service_role;

ALTER TABLE public.assignment_audit_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read tenant audit runs"
  ON public.assignment_audit_runs FOR SELECT
  TO authenticated
  USING (
    tenant_id = (SELECT p.tenant_id FROM profiles p WHERE p.id = auth.uid())
    AND (has_role(auth.uid(),'super_admin') OR has_role(auth.uid(),'coo'))
  );

-- Function: list unlogged leads in last 24h for caller's tenant
CREATE OR REPLACE FUNCTION public.get_unlogged_leads_last_24h()
RETURNS TABLE (
  lead_id UUID,
  title TEXT,
  source TEXT,
  created_at TIMESTAMPTZ,
  assigned_to UUID,
  assignee_name TEXT,
  customer_id UUID,
  company_name TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    l.id AS lead_id,
    l.title,
    l.source::text AS source,
    l.created_at,
    l.assigned_to,
    p.full_name AS assignee_name,
    l.customer_id,
    c.company_name
  FROM leads l
  LEFT JOIN profiles p ON p.id = l.assigned_to
  LEFT JOIN customers c ON c.id = l.customer_id
  WHERE l.tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid())
    AND l.created_at >= now() - interval '24 hours'
    AND l.created_at <= now() - interval '1 minute'
    AND l.deleted_at IS NULL
    AND NOT EXISTS (
      SELECT 1 FROM lead_assignment_history h WHERE h.lead_id = l.id
    )
    AND (has_role(auth.uid(),'super_admin') OR has_role(auth.uid(),'coo'))
  ORDER BY l.created_at DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_unlogged_leads_last_24h() TO authenticated;

-- Function: count unlogged leads for any tenant (service-role only via edge fn)
CREATE OR REPLACE FUNCTION public.count_unlogged_leads_24h(_tenant_id UUID)
RETURNS INT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT count(*)::int FROM leads l
  WHERE l.tenant_id = _tenant_id
    AND l.created_at >= now() - interval '24 hours'
    AND l.created_at <= now() - interval '1 minute'
    AND l.deleted_at IS NULL
    AND NOT EXISTS (SELECT 1 FROM lead_assignment_history h WHERE h.lead_id = l.id);
$$;

GRANT EXECUTE ON FUNCTION public.count_unlogged_leads_24h(UUID) TO service_role;
