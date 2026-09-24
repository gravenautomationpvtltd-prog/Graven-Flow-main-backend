
-- 1. Engagements table
CREATE TABLE public.cst_engagements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  channel TEXT NOT NULL CHECK (channel IN ('call','whatsapp','email','meeting','note','system')),
  direction TEXT NOT NULL DEFAULT 'out' CHECK (direction IN ('in','out')),
  outcome TEXT CHECK (outcome IN ('connected','no_answer','not_interested','interested','order_promise','do_not_contact','info_shared','other')),
  summary TEXT,
  next_action_at TIMESTAMPTZ,
  next_action_type TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_cst_engagements_customer ON public.cst_engagements(customer_id, created_at DESC);
CREATE INDEX idx_cst_engagements_tenant ON public.cst_engagements(tenant_id, created_at DESC);
CREATE INDEX idx_cst_engagements_user ON public.cst_engagements(user_id);
CREATE INDEX idx_cst_engagements_next_action ON public.cst_engagements(next_action_at) WHERE next_action_at IS NOT NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.cst_engagements TO authenticated;
GRANT ALL ON public.cst_engagements TO service_role;

ALTER TABLE public.cst_engagements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cst_engagements select same tenant"
  ON public.cst_engagements FOR SELECT
  TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid()));

CREATE POLICY "cst_engagements insert same tenant"
  ON public.cst_engagements FOR INSERT
  TO authenticated
  WITH CHECK (
    tenant_id = public.get_user_tenant_id(auth.uid())
    AND auth.uid() IS NOT NULL
  );

CREATE POLICY "cst_engagements update own or manager"
  ON public.cst_engagements FOR UPDATE
  TO authenticated
  USING (
    tenant_id = public.get_user_tenant_id(auth.uid())
    AND (user_id = auth.uid() OR public.is_manager_or_above(auth.uid()))
  );

CREATE POLICY "cst_engagements delete manager"
  ON public.cst_engagements FOR DELETE
  TO authenticated
  USING (
    tenant_id = public.get_user_tenant_id(auth.uid())
    AND public.is_manager_or_above(auth.uid())
  );

CREATE TRIGGER update_cst_engagements_updated_at
  BEFORE UPDATE ON public.cst_engagements
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-create a reminder when next_action_at is set
CREATE OR REPLACE FUNCTION public.cst_engagement_sync_reminder()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.next_action_at IS NOT NULL AND NEW.user_id IS NOT NULL THEN
    INSERT INTO public.reminders (
      tenant_id, user_id, customer_id, title, description, remind_at, type, status
    ) VALUES (
      NEW.tenant_id,
      NEW.user_id,
      NEW.customer_id,
      COALESCE(NEW.next_action_type, 'Follow-up') || ' — reconnect',
      NEW.summary,
      NEW.next_action_at,
      'follow_up',
      'pending'
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_cst_engagement_reminder
  AFTER INSERT ON public.cst_engagements
  FOR EACH ROW
  WHEN (NEW.next_action_at IS NOT NULL)
  EXECUTE FUNCTION public.cst_engagement_sync_reminder();

-- 2. Customer flags
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS cst_favourite BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS cst_dnc BOOLEAN NOT NULL DEFAULT FALSE;
