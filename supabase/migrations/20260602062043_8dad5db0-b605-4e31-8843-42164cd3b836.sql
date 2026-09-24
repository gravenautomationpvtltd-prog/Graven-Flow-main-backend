
DROP FUNCTION IF EXISTS public.get_loyal_owner(uuid);

CREATE FUNCTION public.get_loyal_owner(p_customer_id uuid)
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner uuid;
BEGIN
  SELECT h.assigned_to INTO v_owner
  FROM customer_assignment_history h
  JOIN profiles p ON p.id = h.assigned_to
  WHERE h.customer_id = p_customer_id
    AND h.assigned_to IS NOT NULL
    AND p.is_active = true
    AND COALESCE(p.employment_status, 'active') = 'active'
    AND DATE(h.assigned_from) NOT IN (DATE '2026-05-02', DATE '2026-05-04', DATE '2026-05-29', DATE '2026-06-02')
  ORDER BY h.assigned_from ASC
  LIMIT 1;
  IF v_owner IS NOT NULL THEN RETURN v_owner; END IF;

  SELECT h.assigned_to INTO v_owner
  FROM customer_assignment_history h
  JOIN profiles p ON p.id = h.assigned_to
  WHERE h.customer_id = p_customer_id
    AND h.assigned_to IS NOT NULL
    AND p.is_active = true
    AND COALESCE(p.employment_status, 'active') = 'active'
  ORDER BY h.assigned_from DESC
  LIMIT 1;
  IF v_owner IS NOT NULL THEN RETURN v_owner; END IF;

  SELECT l.assigned_to INTO v_owner
  FROM leads l JOIN profiles p ON p.id = l.assigned_to
  WHERE l.customer_id = p_customer_id AND p.is_active = true
  ORDER BY l.created_at ASC LIMIT 1;
  RETURN v_owner;
END;
$$;

ALTER TABLE public.customers DISABLE TRIGGER customers_protect_loyal_owner;

DO $$
DECLARE
  recipients uuid[] := ARRAY[
    'a5786ad0-a2f9-4deb-a2f7-d2fd27b79e78'::uuid,
    '0fcbe4e7-add5-4190-8dec-03448caba162'::uuid,
    '12e9b819-2649-431d-ae95-9afe9a1e48c6'::uuid,
    'b9e6a74e-659a-429d-b7a2-f3f34eb600a1'::uuid
  ];
  n_recipients int := 4;
BEGIN
  CREATE TEMP TABLE _redist AS
  WITH first_owner AS (
    SELECT DISTINCT ON (h.customer_id) h.customer_id, h.assigned_to
    FROM customer_assignment_history h
    WHERE h.assigned_to IS NOT NULL
    ORDER BY h.customer_id, h.assigned_from ASC
  ),
  orphaned AS (
    SELECT c.id AS customer_id, c.tenant_id, c.created_at
    FROM customers c
    JOIN first_owner f ON f.customer_id = c.id
    JOIN profiles p ON p.id = f.assigned_to
    WHERE p.is_active = false OR COALESCE(p.employment_status, 'active') <> 'active'
  ),
  numbered AS (
    SELECT customer_id, tenant_id,
           (ROW_NUMBER() OVER (ORDER BY created_at, customer_id) - 1) % n_recipients AS slot
    FROM orphaned
  )
  SELECT customer_id, tenant_id, recipients[slot + 1] AS new_owner
  FROM numbered;

  UPDATE customer_assignment_history h
  SET assigned_until = now()
  FROM _redist r
  WHERE h.customer_id = r.customer_id AND h.assigned_until IS NULL;

  INSERT INTO customer_assignment_history (customer_id, tenant_id, assigned_to, assigned_from)
  SELECT customer_id, tenant_id, new_owner, now()
  FROM _redist;

  UPDATE customers c SET assigned_sales_id = r.new_owner
  FROM _redist r WHERE c.id = r.customer_id;

  UPDATE leads l SET assigned_to = r.new_owner
  FROM _redist r WHERE l.customer_id = r.customer_id;

  UPDATE quotations q SET created_by = r.new_owner
  FROM _redist r WHERE q.customer_id = r.customer_id;

  UPDATE sales_orders s SET created_by = r.new_owner
  FROM _redist r WHERE s.customer_id = r.customer_id;

  DROP TABLE _redist;
END $$;

ALTER TABLE public.customers ENABLE TRIGGER customers_protect_loyal_owner;
