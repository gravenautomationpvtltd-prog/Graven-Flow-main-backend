
-- Create trigger function to auto-assign leads when assigned_to is NULL
CREATE OR REPLACE FUNCTION public.auto_assign_lead_on_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_sales_id uuid;
  v_lucknow_office_id uuid;
  v_last_assigned_id uuid;
  v_next_user_id uuid;
  v_users uuid[];
  v_user_count integer;
  v_index integer := 0;
BEGIN
  -- Only act when assigned_to is NULL
  IF NEW.assigned_to IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- 1. Try customer's assigned salesperson
  IF NEW.customer_id IS NOT NULL THEN
    SELECT assigned_sales_id INTO v_sales_id
    FROM customers WHERE id = NEW.customer_id;
    
    IF v_sales_id IS NOT NULL THEN
      NEW.assigned_to := v_sales_id;
      RETURN NEW;
    END IF;
  END IF;

  -- 2. Fallback: Round-robin among active Lucknow salespeople
  SELECT id INTO v_lucknow_office_id FROM offices WHERE location = 'lucknow' LIMIT 1;
  
  IF v_lucknow_office_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Get active Lucknow users with salesperson role, excluding those on leave today
  SELECT array_agg(p.id ORDER BY p.id)
  INTO v_users
  FROM profiles p
  JOIN user_roles ur ON ur.user_id = p.id AND ur.role = 'salesperson'
  WHERE p.office_id = v_lucknow_office_id
    AND p.is_active = true
    AND NOT EXISTS (
      SELECT 1 FROM leave_requests lr
      WHERE lr.user_id = p.id
        AND lr.status = 'approved'
        AND CURRENT_DATE BETWEEN lr.start_date AND lr.end_date
    );

  v_user_count := COALESCE(array_length(v_users, 1), 0);
  
  IF v_user_count = 0 THEN
    RETURN NEW;
  END IF;

  -- Get last assigned from round_robin_tracker
  SELECT last_assigned_user_id INTO v_last_assigned_id
  FROM round_robin_tracker
  WHERE office_id = v_lucknow_office_id;

  -- Find starting index
  IF v_last_assigned_id IS NOT NULL THEN
    FOR i IN 1..v_user_count LOOP
      IF v_users[i] = v_last_assigned_id THEN
        v_index := i;
        EXIT;
      END IF;
    END LOOP;
  END IF;

  -- Pick next user
  v_index := (v_index % v_user_count) + 1;
  v_next_user_id := v_users[v_index];

  NEW.assigned_to := v_next_user_id;

  -- Update round-robin tracker
  UPDATE round_robin_tracker
  SET last_assigned_user_id = v_next_user_id, updated_at = now()
  WHERE office_id = v_lucknow_office_id;

  RETURN NEW;
END;
$$;

-- Create the trigger
DROP TRIGGER IF EXISTS trg_auto_assign_lead ON leads;
CREATE TRIGGER trg_auto_assign_lead
  BEFORE INSERT ON leads
  FOR EACH ROW
  EXECUTE FUNCTION auto_assign_lead_on_insert();
