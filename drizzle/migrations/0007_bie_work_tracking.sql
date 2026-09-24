CREATE OR REPLACE FUNCTION public.is_bie_member(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('bie','bie_manager','super_admin','coo')
  )
$$;

DO $$ BEGIN
  CREATE TYPE public.bie_priority AS ENUM ('low','normal','high','urgent');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.vendor_registrations ADD COLUMN IF NOT EXISTS priority public.bie_priority NOT NULL DEFAULT 'normal';
ALTER TABLE public.vendor_registrations ADD COLUMN IF NOT EXISTS due_date DATE;
ALTER TABLE public.tenders ADD COLUMN IF NOT EXISTS priority public.bie_priority NOT NULL DEFAULT 'normal';
ALTER TABLE public.tenders ADD COLUMN IF NOT EXISTS due_date DATE;
ALTER TABLE public.website_listings ADD COLUMN IF NOT EXISTS priority public.bie_priority NOT NULL DEFAULT 'normal';
ALTER TABLE public.website_listings ADD COLUMN IF NOT EXISTS due_date DATE;

CREATE TABLE IF NOT EXISTS public.bie_work_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID,
  work_type TEXT NOT NULL,
  record_id UUID NOT NULL,
  from_status TEXT,
  to_status TEXT,
  note TEXT,
  changed_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.bie_work_history TO authenticated;
GRANT ALL ON public.bie_work_history TO service_role;

ALTER TABLE public.bie_work_history ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS bie_work_history_record_idx ON public.bie_work_history (record_id, created_at DESC);

DROP POLICY IF EXISTS "BIE can read work history" ON public.bie_work_history;
CREATE POLICY "BIE can read work history" ON public.bie_work_history
  FOR SELECT TO authenticated
  USING (public.is_bie_member(auth.uid()) AND tenant_id = public.get_user_tenant_id(auth.uid()));

DROP POLICY IF EXISTS "BIE can write work history" ON public.bie_work_history;
CREATE POLICY "BIE can write work history" ON public.bie_work_history
  FOR INSERT TO authenticated
  WITH CHECK (public.is_bie_member(auth.uid()) AND tenant_id = public.get_user_tenant_id(auth.uid()) AND changed_by = auth.uid());

CREATE OR REPLACE FUNCTION public.stamp_bie_completion()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE terminal boolean;
BEGIN
  terminal := NEW.status IN ('approved','rejected','awarded','lost','active','removed');
  IF terminal AND NEW.completed_at IS NULL THEN
    NEW.completed_at := now();
  ELSIF NOT terminal THEN
    NEW.completed_at := NULL;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS stamp_bie_completion_vr ON public.vendor_registrations;
CREATE TRIGGER stamp_bie_completion_vr BEFORE INSERT OR UPDATE ON public.vendor_registrations
  FOR EACH ROW EXECUTE FUNCTION public.stamp_bie_completion();
DROP TRIGGER IF EXISTS stamp_bie_completion_td ON public.tenders;
CREATE TRIGGER stamp_bie_completion_td BEFORE INSERT OR UPDATE ON public.tenders
  FOR EACH ROW EXECUTE FUNCTION public.stamp_bie_completion();
DROP TRIGGER IF EXISTS stamp_bie_completion_wl ON public.website_listings;
CREATE TRIGGER stamp_bie_completion_wl BEFORE INSERT OR UPDATE ON public.website_listings
  FOR EACH ROW EXECUTE FUNCTION public.stamp_bie_completion();