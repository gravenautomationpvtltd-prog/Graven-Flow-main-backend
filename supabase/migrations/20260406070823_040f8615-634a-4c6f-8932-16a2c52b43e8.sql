
CREATE OR REPLACE FUNCTION public.delegate_employee_work(p_from_user_id uuid, p_to_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_leads_reassigned int;
  v_tasks_reassigned int;
  v_customers_reassigned int;
  v_subordinates_reassigned int;
  v_cro_reassigned int;
  v_quotations_reassigned int;
  v_sales_orders_reassigned int;
BEGIN
  -- Reassign leads
  UPDATE leads SET assigned_to = p_to_user_id WHERE assigned_to = p_from_user_id AND status NOT IN ('won', 'lost');
  GET DIAGNOSTICS v_leads_reassigned = ROW_COUNT;

  -- Reassign tasks
  UPDATE tasks SET assigned_to = p_to_user_id WHERE assigned_to = p_from_user_id AND status NOT IN ('completed', 'cancelled');
  GET DIAGNOSTICS v_tasks_reassigned = ROW_COUNT;

  -- Reassign customers
  UPDATE customers SET assigned_sales_id = p_to_user_id WHERE assigned_sales_id = p_from_user_id;
  GET DIAGNOSTICS v_customers_reassigned = ROW_COUNT;

  -- Reassign subordinates
  UPDATE profiles SET manager_id = p_to_user_id WHERE manager_id = p_from_user_id AND id != p_from_user_id AND is_active = true;
  GET DIAGNOSTICS v_subordinates_reassigned = ROW_COUNT;

  -- Reassign CRO assignments
  UPDATE cro_customer_assignments SET cro_user_id = p_to_user_id WHERE cro_user_id = p_from_user_id AND status NOT IN ('completed', 'cancelled');
  GET DIAGNOSTICS v_cro_reassigned = ROW_COUNT;

  -- Reassign quotations
  UPDATE quotations SET created_by = p_to_user_id WHERE created_by = p_from_user_id AND deleted_at IS NULL;
  GET DIAGNOSTICS v_quotations_reassigned = ROW_COUNT;

  -- Reassign sales orders
  UPDATE sales_orders SET created_by = p_to_user_id WHERE created_by = p_from_user_id AND status != 'cancelled';
  GET DIAGNOSTICS v_sales_orders_reassigned = ROW_COUNT;

  RETURN jsonb_build_object(
    'leads_reassigned', v_leads_reassigned,
    'tasks_reassigned', v_tasks_reassigned,
    'customers_reassigned', v_customers_reassigned,
    'subordinates_reassigned', v_subordinates_reassigned,
    'cro_reassigned', v_cro_reassigned,
    'quotations_reassigned', v_quotations_reassigned,
    'sales_orders_reassigned', v_sales_orders_reassigned
  );
END;
$$;
