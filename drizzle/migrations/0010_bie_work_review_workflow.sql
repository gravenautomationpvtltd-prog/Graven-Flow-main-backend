-- Review workflow columns for BIE work tables
ALTER TABLE public.vendor_registrations
  ADD COLUMN IF NOT EXISTS review_status text NOT NULL DEFAULT 'not_submitted',
  ADD COLUMN IF NOT EXISTS submitted_at timestamptz,
  ADD COLUMN IF NOT EXISTS reviewed_by uuid,
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS rework_note text;

ALTER TABLE public.tenders
  ADD COLUMN IF NOT EXISTS review_status text NOT NULL DEFAULT 'not_submitted',
  ADD COLUMN IF NOT EXISTS submitted_at timestamptz,
  ADD COLUMN IF NOT EXISTS reviewed_by uuid,
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS rework_note text;

ALTER TABLE public.website_listings
  ADD COLUMN IF NOT EXISTS review_status text NOT NULL DEFAULT 'not_submitted',
  ADD COLUMN IF NOT EXISTS submitted_at timestamptz,
  ADD COLUMN IF NOT EXISTS reviewed_by uuid,
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS rework_note text;

ALTER TABLE public.product_assignments
  ADD COLUMN IF NOT EXISTS review_status text NOT NULL DEFAULT 'not_submitted',
  ADD COLUMN IF NOT EXISTS submitted_at timestamptz,
  ADD COLUMN IF NOT EXISTS reviewed_by uuid,
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS rework_note text;

-- Staff may not change ownership, priority or deadline of their work
CREATE OR REPLACE FUNCTION public.bie_guard_staff_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.is_bie_manager(auth.uid()) OR public.is_admin_or_above(auth.uid()) THEN
    RETURN NEW;
  END IF;
  IF NEW.assigned_to IS DISTINCT FROM OLD.assigned_to THEN
    RAISE EXCEPTION 'Only a BIE manager can reassign work';
  END IF;
  IF NEW.priority IS DISTINCT FROM OLD.priority THEN
    RAISE EXCEPTION 'Only a BIE manager can change priority';
  END IF;
  IF NEW.due_date IS DISTINCT FROM OLD.due_date THEN
    RAISE EXCEPTION 'Only a BIE manager can change the due date';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_bie_guard_vendor_registrations ON public.vendor_registrations;
CREATE TRIGGER trg_bie_guard_vendor_registrations
BEFORE UPDATE ON public.vendor_registrations
FOR EACH ROW EXECUTE FUNCTION public.bie_guard_staff_fields();

DROP TRIGGER IF EXISTS trg_bie_guard_tenders ON public.tenders;
CREATE TRIGGER trg_bie_guard_tenders
BEFORE UPDATE ON public.tenders
FOR EACH ROW EXECUTE FUNCTION public.bie_guard_staff_fields();

DROP TRIGGER IF EXISTS trg_bie_guard_website_listings ON public.website_listings;
CREATE TRIGGER trg_bie_guard_website_listings
BEFORE UPDATE ON public.website_listings
FOR EACH ROW EXECUTE FUNCTION public.bie_guard_staff_fields();

DROP TRIGGER IF EXISTS trg_bie_guard_product_assignments ON public.product_assignments;
CREATE TRIGGER trg_bie_guard_product_assignments
BEFORE UPDATE ON public.product_assignments
FOR EACH ROW EXECUTE FUNCTION public.bie_guard_staff_fields();