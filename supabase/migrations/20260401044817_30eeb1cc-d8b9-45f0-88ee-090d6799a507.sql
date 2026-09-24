
-- Add employment status tracking columns to profiles
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS employment_status TEXT NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS exit_date DATE,
  ADD COLUMN IF NOT EXISTS exit_reason TEXT;

-- Backfill: set inactive profiles to 'inactive' status
UPDATE public.profiles SET employment_status = 'inactive' WHERE is_active = false;

-- Create the delegate_employee_work function
CREATE OR REPLACE FUNCTION public.delegate_employee_work(
  p_from_user_id UUID,
  p_to_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_leads_count INT := 0;
  v_tasks_count INT := 0;
  v_customers_count INT := 0;
  v_subordinates_count INT := 0;
  v_cro_assignments_count INT := 0;
BEGIN
  -- Reassign leads
  UPDATE leads SET assigned_to = p_to_user_id
  WHERE assigned_to = p_from_user_id
    AND status NOT IN ('won', 'lost', 'cancelled');
  GET DIAGNOSTICS v_leads_count = ROW_COUNT;

  -- Reassign tasks
  UPDATE tasks SET assigned_to = p_to_user_id
  WHERE assigned_to = p_from_user_id
    AND status NOT IN ('completed', 'cancelled');
  GET DIAGNOSTICS v_tasks_count = ROW_COUNT;

  -- Reassign CRO customer assignments
  UPDATE cro_customer_assignments SET cro_user_id = p_to_user_id
  WHERE cro_user_id = p_from_user_id
    AND status = 'active';
  GET DIAGNOSTICS v_cro_assignments_count = ROW_COUNT;

  -- Reassign customers (assigned_sales_id)
  UPDATE customers SET assigned_sales_id = p_to_user_id
  WHERE assigned_sales_id = p_from_user_id;
  GET DIAGNOSTICS v_customers_count = ROW_COUNT;

  -- Reassign subordinates (manager_id)
  UPDATE profiles SET manager_id = p_to_user_id
  WHERE manager_id = p_from_user_id
    AND id != p_from_user_id;
  GET DIAGNOSTICS v_subordinates_count = ROW_COUNT;

  RETURN jsonb_build_object(
    'leads_reassigned', v_leads_count,
    'tasks_reassigned', v_tasks_count,
    'customers_reassigned', v_customers_count,
    'cro_assignments_reassigned', v_cro_assignments_count,
    'subordinates_reassigned', v_subordinates_count
  );
END;
$$;
