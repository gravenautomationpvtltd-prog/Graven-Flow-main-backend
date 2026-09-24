-- Function to preview open work scoped to roles being removed
CREATE OR REPLACE FUNCTION public.get_role_work_summary(
  p_user_id uuid,
  p_roles_removed app_role[]
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_leads int := 0;
  v_customers int := 0;
  v_quotations int := 0;
  v_sales_orders int := 0;
  v_tasks int := 0;
  v_cro_assignments int := 0;
  v_unqualified_leads int := 0;
  v_subordinates int := 0;
  v_price_requests int := 0;
  v_purchase_orders int := 0;
  v_dispatches int := 0;
BEGIN
  -- Authorization: caller must be admin/manager and in same tenant
  IF NOT (public.is_manager_or_above(auth.uid()) AND public.is_same_tenant(p_user_id)) THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;

  IF 'sales'::app_role = ANY(p_roles_removed) THEN
    SELECT count(*) INTO v_leads FROM leads
      WHERE assigned_to = p_user_id AND deleted_at IS NULL
        AND status NOT IN ('won','lost')
        AND COALESCE(has_enquiry, false) = true;
    SELECT count(*) INTO v_customers FROM customers
      WHERE assigned_sales_id = p_user_id AND deleted_at IS NULL;
    SELECT count(*) INTO v_quotations FROM quotations
      WHERE created_by = p_user_id AND deleted_at IS NULL
        AND status NOT IN ('accepted','rejected','expired');
    SELECT count(*) INTO v_sales_orders FROM sales_orders
      WHERE created_by = p_user_id AND status NOT IN ('cancelled','delivered');
    SELECT count(*) INTO v_tasks FROM tasks
      WHERE assigned_to = p_user_id
        AND status NOT IN ('completed','cancelled')
        AND lead_id IS NOT NULL;
  END IF;

  IF 'cro'::app_role = ANY(p_roles_removed) THEN
    SELECT count(*) INTO v_cro_assignments FROM cro_customer_assignments
      WHERE cro_user_id = p_user_id AND status NOT IN ('completed','cancelled');
    SELECT count(*) INTO v_unqualified_leads FROM leads
      WHERE assigned_to = p_user_id AND deleted_at IS NULL
        AND COALESCE(has_enquiry, false) = false;
  END IF;

  IF 'manager'::app_role = ANY(p_roles_removed) THEN
    SELECT count(*) INTO v_subordinates FROM profiles
      WHERE manager_id = p_user_id AND id <> p_user_id AND is_active = true;
  END IF;

  IF 'procurement'::app_role = ANY(p_roles_removed)
     OR 'procurement_manager'::app_role = ANY(p_roles_removed)
     OR 'import_procurement'::app_role = ANY(p_roles_removed) THEN
    SELECT count(*) INTO v_price_requests FROM price_requests
      WHERE assigned_to = p_user_id AND status IN ('pending','in_progress');
    SELECT count(*) INTO v_purchase_orders FROM purchase_orders
      WHERE created_by = p_user_id AND status IN ('draft','sent','partial');
  END IF;

  IF 'warehouse'::app_role = ANY(p_roles_removed) THEN
    SELECT count(*) INTO v_dispatches FROM dispatches
      WHERE created_by = p_user_id AND status NOT IN ('delivered','cancelled');
  END IF;

  RETURN jsonb_build_object(
    'leads', v_leads,
    'customers', v_customers,
    'quotations', v_quotations,
    'sales_orders', v_sales_orders,
    'tasks', v_tasks,
    'cro_assignments', v_cro_assignments,
    'unqualified_leads', v_unqualified_leads,
    'subordinates', v_subordinates,
    'price_requests', v_price_requests,
    'purchase_orders', v_purchase_orders,
    'dispatches', v_dispatches,
    'total', v_leads + v_customers + v_quotations + v_sales_orders + v_tasks
            + v_cro_assignments + v_unqualified_leads + v_subordinates
            + v_price_requests + v_purchase_orders + v_dispatches
  );
END;
$$;

-- Function to perform the reassignment
CREATE OR REPLACE FUNCTION public.delegate_role_work(
  p_from_user_id uuid,
  p_to_user_id uuid,
  p_roles_removed app_role[],
  p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_leads int := 0;
  v_customers int := 0;
  v_quotations int := 0;
  v_sales_orders int := 0;
  v_tasks int := 0;
  v_cro_assignments int := 0;
  v_unqualified_leads int := 0;
  v_subordinates int := 0;
  v_price_requests int := 0;
  v_purchase_orders int := 0;
  v_dispatches int := 0;
  v_result jsonb;
BEGIN
  -- Authorization
  IF NOT (public.is_manager_or_above(auth.uid()) AND public.is_same_tenant(p_from_user_id) AND public.is_same_tenant(p_to_user_id)) THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;

  IF p_from_user_id = p_to_user_id THEN
    RAISE EXCEPTION 'Cannot delegate work to the same user';
  END IF;

  -- SALES role
  IF 'sales'::app_role = ANY(p_roles_removed) THEN
    UPDATE leads SET assigned_to = p_to_user_id
      WHERE assigned_to = p_from_user_id AND deleted_at IS NULL
        AND status NOT IN ('won','lost')
        AND COALESCE(has_enquiry, false) = true;
    GET DIAGNOSTICS v_leads = ROW_COUNT;

    UPDATE customers SET assigned_sales_id = p_to_user_id
      WHERE assigned_sales_id = p_from_user_id AND deleted_at IS NULL;
    GET DIAGNOSTICS v_customers = ROW_COUNT;

    UPDATE quotations SET created_by = p_to_user_id
      WHERE created_by = p_from_user_id AND deleted_at IS NULL
        AND status NOT IN ('accepted','rejected','expired');
    GET DIAGNOSTICS v_quotations = ROW_COUNT;

    UPDATE sales_orders SET created_by = p_to_user_id
      WHERE created_by = p_from_user_id AND status NOT IN ('cancelled','delivered');
    GET DIAGNOSTICS v_sales_orders = ROW_COUNT;

    UPDATE tasks SET assigned_to = p_to_user_id
      WHERE assigned_to = p_from_user_id
        AND status NOT IN ('completed','cancelled')
        AND lead_id IS NOT NULL;
    GET DIAGNOSTICS v_tasks = ROW_COUNT;
  END IF;

  -- CRO role
  IF 'cro'::app_role = ANY(p_roles_removed) THEN
    UPDATE cro_customer_assignments SET cro_user_id = p_to_user_id
      WHERE cro_user_id = p_from_user_id AND status NOT IN ('completed','cancelled');
    GET DIAGNOSTICS v_cro_assignments = ROW_COUNT;

    UPDATE leads SET assigned_to = p_to_user_id
      WHERE assigned_to = p_from_user_id AND deleted_at IS NULL
        AND COALESCE(has_enquiry, false) = false;
    GET DIAGNOSTICS v_unqualified_leads = ROW_COUNT;
  END IF;

  -- MANAGER role
  IF 'manager'::app_role = ANY(p_roles_removed) THEN
    UPDATE profiles SET manager_id = p_to_user_id
      WHERE manager_id = p_from_user_id AND id <> p_from_user_id AND is_active = true;
    GET DIAGNOSTICS v_subordinates = ROW_COUNT;
  END IF;

  -- PROCUREMENT roles
  IF 'procurement'::app_role = ANY(p_roles_removed)
     OR 'procurement_manager'::app_role = ANY(p_roles_removed)
     OR 'import_procurement'::app_role = ANY(p_roles_removed) THEN
    UPDATE price_requests SET assigned_to = p_to_user_id
      WHERE assigned_to = p_from_user_id AND status IN ('pending','in_progress');
    GET DIAGNOSTICS v_price_requests = ROW_COUNT;

    UPDATE purchase_orders SET created_by = p_to_user_id
      WHERE created_by = p_from_user_id AND status IN ('draft','sent','partial');
    GET DIAGNOSTICS v_purchase_orders = ROW_COUNT;
  END IF;

  -- WAREHOUSE / dispatch
  IF 'warehouse'::app_role = ANY(p_roles_removed) THEN
    UPDATE dispatches SET created_by = p_to_user_id
      WHERE created_by = p_from_user_id AND status NOT IN ('delivered','cancelled');
    GET DIAGNOSTICS v_dispatches = ROW_COUNT;
  END IF;

  v_result := jsonb_build_object(
    'leads', v_leads,
    'customers', v_customers,
    'quotations', v_quotations,
    'sales_orders', v_sales_orders,
    'tasks', v_tasks,
    'cro_assignments', v_cro_assignments,
    'unqualified_leads', v_unqualified_leads,
    'subordinates', v_subordinates,
    'price_requests', v_price_requests,
    'purchase_orders', v_purchase_orders,
    'dispatches', v_dispatches
  );

  -- Activity log entry
  BEGIN
    INSERT INTO public.activities (
      activity_type, description, created_by, metadata
    ) VALUES (
      'role_handover',
      format('Role handover: work reassigned from %s to %s for roles [%s]',
        p_from_user_id, p_to_user_id, array_to_string(p_roles_removed, ', ')),
      auth.uid(),
      jsonb_build_object(
        'from_user_id', p_from_user_id,
        'to_user_id', p_to_user_id,
        'roles_removed', to_jsonb(p_roles_removed),
        'counts', v_result,
        'notes', p_notes
      )
    );
  EXCEPTION WHEN OTHERS THEN
    -- non-blocking: activity logging is best-effort
    NULL;
  END;

  RETURN v_result;
END;
$$;