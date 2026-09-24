CREATE OR REPLACE FUNCTION public.delegate_employee_work_multi(
  p_from_user_id uuid,
  p_to_user_ids uuid[]
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_n int;
  v_leads int := 0;
  v_tasks int := 0;
  v_customers int := 0;
  v_subordinates int := 0;
  v_cro int := 0;
  v_quotations int := 0;
  v_sales_orders int := 0;
BEGIN
  IF p_to_user_ids IS NULL OR array_length(p_to_user_ids, 1) IS NULL THEN
    RAISE EXCEPTION 'At least one delegate must be provided';
  END IF;

  v_n := array_length(p_to_user_ids, 1);

  -- Leads
  WITH ordered AS (
    SELECT id, ROW_NUMBER() OVER (ORDER BY created_at, id) - 1 AS rn
    FROM leads
    WHERE assigned_to = p_from_user_id AND status NOT IN ('won', 'lost')
  ), mapped AS (
    SELECT id, p_to_user_ids[(rn % v_n) + 1] AS new_owner FROM ordered
  )
  UPDATE leads l SET assigned_to = m.new_owner
  FROM mapped m WHERE l.id = m.id;
  GET DIAGNOSTICS v_leads = ROW_COUNT;

  -- Tasks (open)
  WITH ordered AS (
    SELECT id, ROW_NUMBER() OVER (ORDER BY created_at, id) - 1 AS rn
    FROM tasks
    WHERE assigned_to = p_from_user_id AND status NOT IN ('completed', 'cancelled')
  ), mapped AS (
    SELECT id, p_to_user_ids[(rn % v_n) + 1] AS new_owner FROM ordered
  )
  UPDATE tasks t SET assigned_to = m.new_owner
  FROM mapped m WHERE t.id = m.id;
  GET DIAGNOSTICS v_tasks = ROW_COUNT;

  -- Customers
  WITH ordered AS (
    SELECT id, ROW_NUMBER() OVER (ORDER BY created_at, id) - 1 AS rn
    FROM customers
    WHERE assigned_sales_id = p_from_user_id
  ), mapped AS (
    SELECT id, p_to_user_ids[(rn % v_n) + 1] AS new_owner FROM ordered
  )
  UPDATE customers c SET assigned_sales_id = m.new_owner
  FROM mapped m WHERE c.id = m.id;
  GET DIAGNOSTICS v_customers = ROW_COUNT;

  -- Subordinates
  WITH ordered AS (
    SELECT id, ROW_NUMBER() OVER (ORDER BY created_at, id) - 1 AS rn
    FROM profiles
    WHERE manager_id = p_from_user_id AND id != p_from_user_id AND is_active = true
  ), mapped AS (
    SELECT id, p_to_user_ids[(rn % v_n) + 1] AS new_manager FROM ordered
  )
  UPDATE profiles p SET manager_id = m.new_manager
  FROM mapped m WHERE p.id = m.id;
  GET DIAGNOSTICS v_subordinates = ROW_COUNT;

  -- CRO assignments
  WITH ordered AS (
    SELECT id, ROW_NUMBER() OVER (ORDER BY created_at, id) - 1 AS rn
    FROM cro_customer_assignments
    WHERE cro_user_id = p_from_user_id AND status NOT IN ('completed', 'cancelled')
  ), mapped AS (
    SELECT id, p_to_user_ids[(rn % v_n) + 1] AS new_owner FROM ordered
  )
  UPDATE cro_customer_assignments c SET cro_user_id = m.new_owner
  FROM mapped m WHERE c.id = m.id;
  GET DIAGNOSTICS v_cro = ROW_COUNT;

  -- Quotations (authorship)
  WITH ordered AS (
    SELECT id, ROW_NUMBER() OVER (ORDER BY created_at, id) - 1 AS rn
    FROM quotations
    WHERE created_by = p_from_user_id AND deleted_at IS NULL
  ), mapped AS (
    SELECT id, p_to_user_ids[(rn % v_n) + 1] AS new_owner FROM ordered
  )
  UPDATE quotations q SET created_by = m.new_owner
  FROM mapped m WHERE q.id = m.id;
  GET DIAGNOSTICS v_quotations = ROW_COUNT;

  -- Sales orders (authorship)
  WITH ordered AS (
    SELECT id, ROW_NUMBER() OVER (ORDER BY created_at, id) - 1 AS rn
    FROM sales_orders
    WHERE created_by = p_from_user_id AND status != 'cancelled'
  ), mapped AS (
    SELECT id, p_to_user_ids[(rn % v_n) + 1] AS new_owner FROM ordered
  )
  UPDATE sales_orders s SET created_by = m.new_owner
  FROM mapped m WHERE s.id = m.id;
  GET DIAGNOSTICS v_sales_orders = ROW_COUNT;

  RETURN jsonb_build_object(
    'leads_reassigned', v_leads,
    'tasks_reassigned', v_tasks,
    'customers_reassigned', v_customers,
    'subordinates_reassigned', v_subordinates,
    'cro_reassigned', v_cro,
    'quotations_reassigned', v_quotations,
    'sales_orders_reassigned', v_sales_orders,
    'recipient_count', v_n
  );
END;
$$;