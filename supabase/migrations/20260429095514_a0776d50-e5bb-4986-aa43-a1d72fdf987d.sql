
-- Preview function: counts of work items currently on a user
CREATE OR REPLACE FUNCTION public.preview_user_book(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_result jsonb;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT (
    public.has_role(v_caller, 'super_admin')
    OR public.has_role(v_caller, 'coo')
    OR public.has_role(v_caller, 'cct')
  ) THEN
    RAISE EXCEPTION 'Insufficient permissions';
  END IF;

  SELECT jsonb_build_object(
    'leads', (SELECT count(*) FROM leads WHERE assigned_to = p_user_id AND deleted_at IS NULL),
    'customers', (SELECT count(*) FROM customers WHERE assigned_sales_id = p_user_id AND deleted_at IS NULL),
    'escalations', (SELECT count(*) FROM escalation_logs WHERE user_id = p_user_id AND resolved_at IS NULL),
    'tasks', (SELECT count(*) FROM tasks WHERE assigned_to = p_user_id AND status IN ('pending','in_progress')),
    'quotations_authored', (SELECT count(*) FROM quotations WHERE created_by = p_user_id AND deleted_at IS NULL),
    'sales_orders_authored', (SELECT count(*) FROM sales_orders WHERE created_by = p_user_id)
  ) INTO v_result;

  RETURN v_result;
END;
$$;

-- Redistribute function: round-robin reassignment across recipients
CREATE OR REPLACE FUNCTION public.redistribute_user_book(
  p_from_user_id uuid,
  p_to_user_ids uuid[],
  p_entities text[],
  p_include_quotation_authorship boolean DEFAULT false,
  p_include_order_authorship boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_batch_id uuid := gen_random_uuid();
  v_from_tenant uuid;
  v_recipient_count int;
  v_invalid_recipients int;
  v_leads_moved int := 0;
  v_customers_moved int := 0;
  v_escalations_moved int := 0;
  v_tasks_moved int := 0;
  v_quotations_moved int := 0;
  v_orders_moved int := 0;
  v_per_recipient jsonb := '{}'::jsonb;
  v_recipient_id uuid;
BEGIN
  -- Auth check
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT (
    public.has_role(v_caller, 'super_admin')
    OR public.has_role(v_caller, 'coo')
    OR public.has_role(v_caller, 'cct')
  ) THEN
    RAISE EXCEPTION 'Insufficient permissions';
  END IF;

  -- Basic validations
  IF p_from_user_id IS NULL THEN
    RAISE EXCEPTION 'Source user is required';
  END IF;

  v_recipient_count := COALESCE(array_length(p_to_user_ids, 1), 0);
  IF v_recipient_count = 0 THEN
    RAISE EXCEPTION 'At least one recipient is required';
  END IF;

  IF p_from_user_id = ANY(p_to_user_ids) THEN
    RAISE EXCEPTION 'Source user cannot also be a recipient';
  END IF;

  -- Tenant of source user
  SELECT tenant_id INTO v_from_tenant FROM profiles WHERE id = p_from_user_id;
  IF v_from_tenant IS NULL THEN
    RAISE EXCEPTION 'Source user not found';
  END IF;

  -- Verify recipients: same tenant, active, has sales role
  SELECT count(*) INTO v_invalid_recipients
  FROM unnest(p_to_user_ids) AS uid
  WHERE NOT EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = uid
      AND p.tenant_id = v_from_tenant
      AND COALESCE(p.is_active, true) = true
      AND COALESCE(p.employment_status, 'active') = 'active'
      AND p.exit_date IS NULL
      AND EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = p.id AND ur.role = 'sales')
  );

  IF v_invalid_recipients > 0 THEN
    RAISE EXCEPTION 'One or more recipients are not active sales users in the same tenant';
  END IF;

  -- Initialize per-recipient counter
  FOREACH v_recipient_id IN ARRAY p_to_user_ids LOOP
    v_per_recipient := v_per_recipient || jsonb_build_object(v_recipient_id::text,
      jsonb_build_object('leads',0,'customers',0,'escalations',0,'tasks',0,'quotations',0,'sales_orders',0));
  END LOOP;

  -- LEADS
  IF 'leads' = ANY(p_entities) THEN
    WITH ordered AS (
      SELECT id, ROW_NUMBER() OVER (ORDER BY created_at, id) - 1 AS rn
      FROM leads
      WHERE assigned_to = p_from_user_id AND deleted_at IS NULL
    ),
    mapped AS (
      SELECT id, p_to_user_ids[(rn % v_recipient_count) + 1] AS new_owner
      FROM ordered
    ),
    upd AS (
      UPDATE leads l
      SET assigned_to = m.new_owner, updated_at = now()
      FROM mapped m
      WHERE l.id = m.id
      RETURNING l.id, m.new_owner
    ),
    log AS (
      INSERT INTO activities (user_id, activity_type, description, metadata, entity_type, entity_id)
      SELECT v_caller, 'bulk_redistribution',
        'Lead reassigned via bulk redistribution',
        jsonb_build_object('batch_id',v_batch_id,'from_user_id',p_from_user_id,'to_user_id',u.new_owner,'entity','lead','source','admin_redistribute_tool'),
        'lead', u.id
      FROM upd u
      RETURNING 1
    )
    SELECT count(*) INTO v_leads_moved FROM upd;

    -- per recipient counts
    FOR v_recipient_id IN SELECT unnest(p_to_user_ids) LOOP
      v_per_recipient := jsonb_set(
        v_per_recipient,
        ARRAY[v_recipient_id::text,'leads'],
        to_jsonb((SELECT count(*) FROM leads WHERE assigned_to = v_recipient_id AND updated_at >= now() - interval '5 minutes'
                   AND id IN (SELECT id FROM leads WHERE assigned_to = v_recipient_id)))
      );
    END LOOP;
  END IF;

  -- CUSTOMERS
  IF 'customers' = ANY(p_entities) THEN
    WITH ordered AS (
      SELECT id, ROW_NUMBER() OVER (ORDER BY created_at, id) - 1 AS rn
      FROM customers
      WHERE assigned_sales_id = p_from_user_id AND deleted_at IS NULL
    ),
    mapped AS (
      SELECT id, p_to_user_ids[(rn % v_recipient_count) + 1] AS new_owner FROM ordered
    ),
    upd AS (
      UPDATE customers c
      SET assigned_sales_id = m.new_owner, updated_at = now()
      FROM mapped m
      WHERE c.id = m.id
      RETURNING c.id, m.new_owner
    ),
    log AS (
      INSERT INTO activities (user_id, activity_type, description, metadata, entity_type, entity_id)
      SELECT v_caller, 'bulk_redistribution',
        'Customer reassigned via bulk redistribution',
        jsonb_build_object('batch_id',v_batch_id,'from_user_id',p_from_user_id,'to_user_id',u.new_owner,'entity','customer','source','admin_redistribute_tool'),
        'customer', u.id
      FROM upd u
      RETURNING 1
    )
    SELECT count(*) INTO v_customers_moved FROM upd;
  END IF;

  -- ESCALATIONS (open only)
  IF 'escalations' = ANY(p_entities) THEN
    WITH ordered AS (
      SELECT id, ROW_NUMBER() OVER (ORDER BY created_at, id) - 1 AS rn
      FROM escalation_logs
      WHERE user_id = p_from_user_id AND resolved_at IS NULL
    ),
    mapped AS (
      SELECT id, p_to_user_ids[(rn % v_recipient_count) + 1] AS new_owner FROM ordered
    ),
    upd AS (
      UPDATE escalation_logs e
      SET user_id = m.new_owner
      FROM mapped m
      WHERE e.id = m.id
      RETURNING e.id, m.new_owner
    ),
    log AS (
      INSERT INTO activities (user_id, activity_type, description, metadata, entity_type, entity_id)
      SELECT v_caller, 'bulk_redistribution',
        'Escalation reassigned via bulk redistribution',
        jsonb_build_object('batch_id',v_batch_id,'from_user_id',p_from_user_id,'to_user_id',u.new_owner,'entity','escalation','source','admin_redistribute_tool'),
        'escalation', u.id
      FROM upd u
      RETURNING 1
    )
    SELECT count(*) INTO v_escalations_moved FROM upd;
  END IF;

  -- TASKS (open only)
  IF 'tasks' = ANY(p_entities) THEN
    WITH ordered AS (
      SELECT id, ROW_NUMBER() OVER (ORDER BY created_at, id) - 1 AS rn
      FROM tasks
      WHERE assigned_to = p_from_user_id AND status IN ('pending','in_progress')
    ),
    mapped AS (
      SELECT id, p_to_user_ids[(rn % v_recipient_count) + 1] AS new_owner FROM ordered
    ),
    upd AS (
      UPDATE tasks t
      SET assigned_to = m.new_owner, updated_at = now()
      FROM mapped m
      WHERE t.id = m.id
      RETURNING t.id, m.new_owner
    ),
    log AS (
      INSERT INTO activities (user_id, activity_type, description, metadata, entity_type, entity_id)
      SELECT v_caller, 'bulk_redistribution',
        'Task reassigned via bulk redistribution',
        jsonb_build_object('batch_id',v_batch_id,'from_user_id',p_from_user_id,'to_user_id',u.new_owner,'entity','task','source','admin_redistribute_tool'),
        'task', u.id
      FROM upd u
      RETURNING 1
    )
    SELECT count(*) INTO v_tasks_moved FROM upd;
  END IF;

  -- QUOTATIONS authorship (optional)
  IF p_include_quotation_authorship THEN
    WITH ordered AS (
      SELECT id, ROW_NUMBER() OVER (ORDER BY created_at, id) - 1 AS rn
      FROM quotations
      WHERE created_by = p_from_user_id AND deleted_at IS NULL
    ),
    mapped AS (
      SELECT id, p_to_user_ids[(rn % v_recipient_count) + 1] AS new_owner FROM ordered
    ),
    upd AS (
      UPDATE quotations q
      SET created_by = m.new_owner, updated_at = now()
      FROM mapped m
      WHERE q.id = m.id
      RETURNING q.id, m.new_owner
    ),
    log AS (
      INSERT INTO activities (user_id, activity_type, description, metadata, entity_type, entity_id)
      SELECT v_caller, 'bulk_redistribution',
        'Quotation authorship reassigned via bulk redistribution',
        jsonb_build_object('batch_id',v_batch_id,'from_user_id',p_from_user_id,'to_user_id',u.new_owner,'entity','quotation','source','admin_redistribute_tool'),
        'quotation', u.id
      FROM upd u
      RETURNING 1
    )
    SELECT count(*) INTO v_quotations_moved FROM upd;
  END IF;

  -- SALES ORDERS authorship (optional)
  IF p_include_order_authorship THEN
    WITH ordered AS (
      SELECT id, ROW_NUMBER() OVER (ORDER BY created_at, id) - 1 AS rn
      FROM sales_orders
      WHERE created_by = p_from_user_id
    ),
    mapped AS (
      SELECT id, p_to_user_ids[(rn % v_recipient_count) + 1] AS new_owner FROM ordered
    ),
    upd AS (
      UPDATE sales_orders s
      SET created_by = m.new_owner, updated_at = now()
      FROM mapped m
      WHERE s.id = m.id
      RETURNING s.id, m.new_owner
    ),
    log AS (
      INSERT INTO activities (user_id, activity_type, description, metadata, entity_type, entity_id)
      SELECT v_caller, 'bulk_redistribution',
        'Sales order authorship reassigned via bulk redistribution',
        jsonb_build_object('batch_id',v_batch_id,'from_user_id',p_from_user_id,'to_user_id',u.new_owner,'entity','sales_order','source','admin_redistribute_tool'),
        'sales_order', u.id
      FROM upd u
      RETURNING 1
    )
    SELECT count(*) INTO v_orders_moved FROM upd;
  END IF;

  -- Summary activity row
  INSERT INTO activities (user_id, activity_type, description, metadata)
  VALUES (
    v_caller,
    'bulk_redistribution_summary',
    'Bulk workload redistribution completed',
    jsonb_build_object(
      'batch_id', v_batch_id,
      'from_user_id', p_from_user_id,
      'to_user_ids', p_to_user_ids,
      'entities', p_entities,
      'leads_moved', v_leads_moved,
      'customers_moved', v_customers_moved,
      'escalations_moved', v_escalations_moved,
      'tasks_moved', v_tasks_moved,
      'quotations_moved', v_quotations_moved,
      'sales_orders_moved', v_orders_moved,
      'source', 'admin_redistribute_tool'
    )
  );

  RETURN jsonb_build_object(
    'batch_id', v_batch_id,
    'leads', v_leads_moved,
    'customers', v_customers_moved,
    'escalations', v_escalations_moved,
    'tasks', v_tasks_moved,
    'quotations', v_quotations_moved,
    'sales_orders', v_orders_moved,
    'recipient_count', v_recipient_count
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.preview_user_book(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.redistribute_user_book(uuid, uuid[], text[], boolean, boolean) TO authenticated;
