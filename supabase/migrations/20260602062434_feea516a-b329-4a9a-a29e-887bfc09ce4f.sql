
CREATE OR REPLACE FUNCTION public.get_loyal_owner(p_customer_id uuid)
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner uuid;
BEGIN
  -- The current open assignment is the loyal owner, provided that user is still active.
  SELECT h.assigned_to INTO v_owner
  FROM customer_assignment_history h
  JOIN profiles p ON p.id = h.assigned_to
  WHERE h.customer_id = p_customer_id
    AND h.assigned_until IS NULL
    AND p.is_active = true
    AND COALESCE(p.employment_status, 'active') = 'active'
  ORDER BY h.assigned_from DESC
  LIMIT 1;
  IF v_owner IS NOT NULL THEN RETURN v_owner; END IF;

  -- Fallback: most recent ever-assigned active user
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

  -- Last resort: earliest active lead assignee
  SELECT l.assigned_to INTO v_owner
  FROM leads l JOIN profiles p ON p.id = l.assigned_to
  WHERE l.customer_id = p_customer_id AND p.is_active = true
  ORDER BY l.created_at ASC LIMIT 1;
  RETURN v_owner;
END;
$$;
