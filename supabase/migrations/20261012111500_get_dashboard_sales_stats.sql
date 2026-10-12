-- Migration: High-performance aggregated sales stats for personal & manager dashboard views
CREATE OR REPLACE FUNCTION public.get_dashboard_sales_stats(
  p_user_id uuid DEFAULT NULL,
  p_from timestamptz DEFAULT NULL,
  p_to timestamptz DEFAULT NULL,
  p_vertical_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_today_start timestamptz;
  v_total_leads bigint;
  v_new_today bigint;
  v_won_leads bigint;
  v_total_customers bigint;
  v_total_revenue numeric;
  v_pending_quotes_val numeric;
  v_caller_id uuid;
  v_is_mgr boolean;
BEGIN
  v_caller_id := auth.uid();
  v_today_start := (date_trunc('day', timezone('Asia/Kolkata', now())) AT TIME ZONE 'Asia/Kolkata');
  
  -- Determine whether caller can view team or target user
  SELECT EXISTS (
    SELECT 1 FROM user_roles WHERE user_id = v_caller_id AND role::text IN ('super_admin', 'coo', 'manager', 'accounts')
  ) INTO v_is_mgr;

  -- If not manager/admin and caller is set, force p_user_id to caller
  IF NOT v_is_mgr AND v_caller_id IS NOT NULL THEN
    p_user_id := v_caller_id;
  END IF;

  -- 1. Total Leads
  SELECT count(*) INTO v_total_leads
  FROM leads
  WHERE deleted_at IS NULL
    AND (p_user_id IS NULL OR assigned_to = p_user_id)
    AND (p_vertical_id IS NULL OR vertical_id = p_vertical_id)
    AND (p_from IS NULL OR created_at >= p_from)
    AND (p_to IS NULL OR created_at <= p_to);

  -- 2. New Leads Today
  SELECT count(*) INTO v_new_today
  FROM leads
  WHERE deleted_at IS NULL
    AND (p_user_id IS NULL OR assigned_to = p_user_id)
    AND (p_vertical_id IS NULL OR vertical_id = p_vertical_id)
    AND created_at >= v_today_start;

  -- 3. Won Leads
  SELECT count(*) INTO v_won_leads
  FROM leads
  WHERE deleted_at IS NULL
    AND status = 'won'
    AND (p_user_id IS NULL OR assigned_to = p_user_id)
    AND (p_vertical_id IS NULL OR vertical_id = p_vertical_id)
    AND (p_from IS NULL OR coalesce(won_at, created_at) >= p_from)
    AND (p_to IS NULL OR coalesce(won_at, created_at) <= p_to);

  -- 4. Total Customers
  SELECT count(*) INTO v_total_customers
  FROM customers
  WHERE deleted_at IS NULL
    AND (p_user_id IS NULL OR assigned_sales_id = p_user_id)
    AND (p_vertical_id IS NULL OR vertical_id = p_vertical_id)
    AND (p_from IS NULL OR created_at >= p_from)
    AND (p_to IS NULL OR created_at <= p_to);

  -- 5. Total Revenue (Sales Orders received)
  SELECT coalesce(sum(payment_amount), 0) INTO v_total_revenue
  FROM sales_orders
  WHERE payment_status = 'received'
    AND (p_user_id IS NULL OR created_by = p_user_id)
    AND (p_vertical_id IS NULL OR vertical_id = p_vertical_id)
    AND (p_from IS NULL OR created_at >= p_from)
    AND (p_to IS NULL OR created_at <= p_to);

  -- 6. Pending Quotations Value
  SELECT coalesce(sum(grand_total), 0) INTO v_pending_quotes_val
  FROM quotations
  WHERE deleted_at IS NULL
    AND status NOT IN ('won', 'lost', 'draft')
    AND (p_user_id IS NULL OR created_by = p_user_id)
    AND (p_vertical_id IS NULL OR vertical_id = p_vertical_id)
    AND (p_from IS NULL OR created_at >= p_from)
    AND (p_to IS NULL OR created_at <= p_to);

  RETURN jsonb_build_object(
    'totalLeads', coalesce(v_total_leads, 0),
    'newLeadsToday', coalesce(v_new_today, 0),
    'wonThisMonth', coalesce(v_won_leads, 0),
    'totalCustomers', coalesce(v_total_customers, 0),
    'totalRevenue', coalesce(v_total_revenue, 0),
    'pendingQuotationsValue', coalesce(v_pending_quotes_val, 0)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_dashboard_sales_stats TO authenticated, anon;
