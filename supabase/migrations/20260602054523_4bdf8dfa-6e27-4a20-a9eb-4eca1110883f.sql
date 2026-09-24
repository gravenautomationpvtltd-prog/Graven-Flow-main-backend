-- 1. Helper: resolve the loyal owner for a customer using earliest history (excluding backfill spike dates),
-- then earliest lead/quote/order assignee.
CREATE OR REPLACE FUNCTION public.get_loyal_owner(_customer_id uuid)
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner uuid;
BEGIN
  -- Earliest history row, ignoring known backfill spike days
  SELECT h.assigned_to INTO v_owner
  FROM public.customer_assignment_history h
  JOIN public.profiles p ON p.id = h.assigned_to
  WHERE h.customer_id = _customer_id
    AND h.assigned_to IS NOT NULL
    AND p.is_active = true
    AND date(h.assigned_from) NOT IN (DATE '2026-05-02', DATE '2026-05-04', DATE '2026-05-29', DATE '2026-06-02')
  ORDER BY h.assigned_from ASC
  LIMIT 1;
  IF v_owner IS NOT NULL THEN RETURN v_owner; END IF;

  -- Earliest lead
  SELECT l.assigned_to INTO v_owner
  FROM public.leads l
  JOIN public.profiles p ON p.id = l.assigned_to
  WHERE l.customer_id = _customer_id AND l.assigned_to IS NOT NULL AND p.is_active = true
  ORDER BY l.created_at ASC LIMIT 1;
  IF v_owner IS NOT NULL THEN RETURN v_owner; END IF;

  -- Earliest quotation
  SELECT q.created_by INTO v_owner
  FROM public.quotations q
  JOIN public.profiles p ON p.id = q.created_by
  WHERE q.customer_id = _customer_id AND q.created_by IS NOT NULL AND p.is_active = true
  ORDER BY q.created_at ASC LIMIT 1;
  IF v_owner IS NOT NULL THEN RETURN v_owner; END IF;

  -- Earliest sales order
  SELECT s.created_by INTO v_owner
  FROM public.sales_orders s
  JOIN public.profiles p ON p.id = s.created_by
  WHERE s.customer_id = _customer_id AND s.created_by IS NOT NULL AND p.is_active = true
  ORDER BY s.created_at ASC LIMIT 1;

  RETURN v_owner;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_loyal_owner(uuid) TO authenticated, service_role;

-- 2. Trigger: protect loyal owner from silent reassignment by sales reps / automation.
CREATE OR REPLACE FUNCTION public.protect_loyal_customer_owner()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_loyal uuid;
  v_prev_active boolean;
  v_prev_optout boolean;
BEGIN
  -- Only care when assigned_sales_id is actually changing
  IF NEW.assigned_sales_id IS NOT DISTINCT FROM OLD.assigned_sales_id THEN
    RETURN NEW;
  END IF;

  -- Admins / managers / COO / super_admin can always reassign
  IF v_uid IS NOT NULL AND (
    public.has_role(v_uid, 'super_admin') OR
    public.has_role(v_uid, 'coo') OR
    public.has_role(v_uid, 'manager')
  ) THEN
    RETURN NEW;
  END IF;

  -- If previous owner is inactive or opted out, allow the change
  SELECT is_active, lead_assignment_opt_out INTO v_prev_active, v_prev_optout
  FROM public.profiles WHERE id = OLD.assigned_sales_id;
  IF OLD.assigned_sales_id IS NULL OR v_prev_active = false OR v_prev_optout = true THEN
    RETURN NEW;
  END IF;

  -- Otherwise, only allow if NEW matches the loyal owner
  v_loyal := public.get_loyal_owner(NEW.id);
  IF v_loyal IS NOT NULL AND NEW.assigned_sales_id <> v_loyal THEN
    RAISE EXCEPTION 'LOYALTY_VIOLATION: customer % is owned by % (loyal owner). Only a manager/COO/super_admin can reassign.', NEW.id, OLD.assigned_sales_id
      USING HINT = 'Ask a manager to reassign this customer.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS customers_protect_loyal_owner ON public.customers;
CREATE TRIGGER customers_protect_loyal_owner
BEFORE UPDATE OF assigned_sales_id ON public.customers
FOR EACH ROW EXECUTE FUNCTION public.protect_loyal_customer_owner();