
-- 1. Lead assignment history
CREATE TABLE IF NOT EXISTS public.lead_assignment_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL,
  assigned_from uuid,
  assigned_to uuid,
  changed_by uuid,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lah_lead ON public.lead_assignment_history(lead_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_lah_from_recent ON public.lead_assignment_history(assigned_from, created_at DESC);

GRANT SELECT, INSERT ON public.lead_assignment_history TO authenticated;
GRANT ALL ON public.lead_assignment_history TO service_role;

ALTER TABLE public.lead_assignment_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant members can read lead assignment history" ON public.lead_assignment_history;
CREATE POLICY "Tenant members can read lead assignment history"
ON public.lead_assignment_history FOR SELECT TO authenticated
USING (is_my_tenant(tenant_id));

DROP POLICY IF EXISTS "Service role inserts lead assignment history" ON public.lead_assignment_history;
CREATE POLICY "Service role inserts lead assignment history"
ON public.lead_assignment_history FOR INSERT TO authenticated
WITH CHECK (is_my_tenant(tenant_id));

-- 2. Helper: was this user the assignee of this lead within the last 30 days?
CREATE OR REPLACE FUNCTION public.was_recent_lead_assignee(_lead_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.lead_assignment_history h
    WHERE h.lead_id = _lead_id
      AND h.assigned_from = _user_id
      AND h.created_at > now() - interval '30 days'
  );
$$;

-- 3. Trigger: log assignment changes
CREATE OR REPLACE FUNCTION public.log_lead_assignment_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (NEW.assigned_to IS DISTINCT FROM OLD.assigned_to) THEN
    INSERT INTO public.lead_assignment_history (lead_id, tenant_id, assigned_from, assigned_to, changed_by, reason)
    VALUES (NEW.id, NEW.tenant_id, OLD.assigned_to, NEW.assigned_to, auth.uid(), 'reassignment');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_lead_assignment_change ON public.leads;
CREATE TRIGGER trg_log_lead_assignment_change
AFTER UPDATE OF assigned_to ON public.leads
FOR EACH ROW EXECUTE FUNCTION public.log_lead_assignment_change();

-- 4. Trigger: protect lead details when only reassigning
CREATE OR REPLACE FUNCTION public.protect_lead_on_reassign()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Never allow non-null fields to be silently nulled out by a partial update payload.
  IF OLD.customer_id IS NOT NULL AND NEW.customer_id IS NULL THEN
    NEW.customer_id := OLD.customer_id;
  END IF;
  IF OLD.title IS NOT NULL AND (NEW.title IS NULL OR btrim(NEW.title) = '') THEN
    NEW.title := OLD.title;
  END IF;
  IF OLD.customer_query IS NOT NULL AND NEW.customer_query IS NULL THEN
    NEW.customer_query := OLD.customer_query;
  END IF;
  IF OLD.estimated_value IS NOT NULL AND NEW.estimated_value IS NULL THEN
    NEW.estimated_value := OLD.estimated_value;
  END IF;
  IF OLD.source IS NOT NULL AND NEW.source IS NULL THEN
    NEW.source := OLD.source;
  END IF;
  IF OLD.source_reference IS NOT NULL AND NEW.source_reference IS NULL THEN
    NEW.source_reference := OLD.source_reference;
  END IF;
  IF OLD.expected_close_date IS NOT NULL AND NEW.expected_close_date IS NULL THEN
    NEW.expected_close_date := OLD.expected_close_date;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_lead_on_reassign ON public.leads;
CREATE TRIGGER trg_protect_lead_on_reassign
BEFORE UPDATE ON public.leads
FOR EACH ROW EXECUTE FUNCTION public.protect_lead_on_reassign();

-- 5. Widen leads SELECT policy: previous assignee retains visibility for 30 days
DROP POLICY IF EXISTS "Lead visibility by role hierarchy" ON public.leads;
CREATE POLICY "Lead visibility by role hierarchy"
ON public.leads FOR SELECT TO authenticated
USING (
  is_my_tenant(tenant_id) AND (
    is_admin_or_above(auth.uid())
    OR assigned_to = auth.uid()
    OR (is_manager_or_above(auth.uid()) AND assigned_to = ANY (get_subordinate_ids(auth.uid())))
    OR (customer_id IS NOT NULL AND customer_id = ANY (get_user_cro_customer_ids(auth.uid())))
    OR id = ANY (get_user_quotation_lead_ids(auth.uid()))
    OR id = ANY (get_user_qualified_lead_ids(auth.uid()))
    OR was_recent_lead_assignee(id, auth.uid())
  )
);
