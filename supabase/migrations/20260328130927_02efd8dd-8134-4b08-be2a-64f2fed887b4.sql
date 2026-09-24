
-- 1. Create assignment history table
CREATE TABLE public.customer_assignment_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  assigned_to uuid REFERENCES public.profiles(id),
  assigned_from timestamptz NOT NULL DEFAULT now(),
  assigned_until timestamptz,
  tenant_id uuid REFERENCES public.tenants(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Indexes
CREATE INDEX idx_cah_customer_id ON public.customer_assignment_history(customer_id);
CREATE INDEX idx_cah_assigned_to ON public.customer_assignment_history(assigned_to);
CREATE INDEX idx_cah_tenant_id ON public.customer_assignment_history(tenant_id);

-- 3. RLS
ALTER TABLE public.customer_assignment_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant users can view assignment history"
ON public.customer_assignment_history
FOR SELECT
TO authenticated
USING (
  is_my_tenant(tenant_id)
);

-- 4. Trigger function to auto-log assignment changes
CREATE OR REPLACE FUNCTION public.track_customer_assignment_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF OLD.assigned_sales_id IS DISTINCT FROM NEW.assigned_sales_id THEN
    -- Close previous assignment
    UPDATE customer_assignment_history
    SET assigned_until = now()
    WHERE customer_id = NEW.id
      AND assigned_until IS NULL;

    -- Insert new assignment (if new value is not null)
    IF NEW.assigned_sales_id IS NOT NULL THEN
      INSERT INTO customer_assignment_history (customer_id, assigned_to, assigned_from, tenant_id)
      VALUES (NEW.id, NEW.assigned_sales_id, now(), NEW.tenant_id);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_customer_assignment_change
AFTER UPDATE OF assigned_sales_id ON public.customers
FOR EACH ROW
EXECUTE FUNCTION public.track_customer_assignment_change();

-- 5. Backfill current assignments
INSERT INTO customer_assignment_history (customer_id, assigned_to, assigned_from, tenant_id)
SELECT id, assigned_sales_id, created_at, tenant_id
FROM customers
WHERE assigned_sales_id IS NOT NULL AND deleted_at IS NULL;
