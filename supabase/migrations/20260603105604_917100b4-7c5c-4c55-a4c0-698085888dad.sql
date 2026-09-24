
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_protected_owner BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS owner_locked BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_customers_owner_locked ON public.customers(owner_locked) WHERE owner_locked = true;
CREATE INDEX IF NOT EXISTS idx_profiles_is_protected_owner ON public.profiles(is_protected_owner) WHERE is_protected_owner = true;

-- Auto-lock when assigning to a protected owner; auto-unlock when moving to a non-protected owner via admin clearing the flag is manual.
CREATE OR REPLACE FUNCTION public.auto_lock_protected_owner_customers()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_protected BOOLEAN;
BEGIN
  IF NEW.assigned_sales_id IS NOT NULL THEN
    SELECT is_protected_owner INTO v_protected
    FROM public.profiles WHERE id = NEW.assigned_sales_id;
    IF COALESCE(v_protected, false) = true THEN
      NEW.owner_locked := true;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_lock_protected_owner ON public.customers;
CREATE TRIGGER trg_auto_lock_protected_owner
BEFORE INSERT OR UPDATE OF assigned_sales_id ON public.customers
FOR EACH ROW EXECUTE FUNCTION public.auto_lock_protected_owner_customers();

-- Enforce: locked customers cannot have their assignment changed
CREATE OR REPLACE FUNCTION public.enforce_owner_lock_on_customers()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.owner_locked = true
     AND NEW.owner_locked = true
     AND NEW.assigned_sales_id IS DISTINCT FROM OLD.assigned_sales_id THEN
    RAISE EXCEPTION 'Customer % is locked to a protected owner and cannot be reassigned. Unlock owner_locked first.', OLD.id
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_owner_lock ON public.customers;
CREATE TRIGGER trg_enforce_owner_lock
BEFORE UPDATE ON public.customers
FOR EACH ROW EXECUTE FUNCTION public.enforce_owner_lock_on_customers();

-- Backfill Aditi Mishra
UPDATE public.profiles
SET is_protected_owner = true
WHERE full_name ILIKE 'Aditi Mishra';

UPDATE public.customers c
SET owner_locked = true
FROM public.profiles p
WHERE c.assigned_sales_id = p.id
  AND p.is_protected_owner = true
  AND c.owner_locked = false;
