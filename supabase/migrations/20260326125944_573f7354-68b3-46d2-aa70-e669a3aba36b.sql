
CREATE OR REPLACE FUNCTION public.auto_segment_customers()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec RECORD;
  v_total_value numeric;
  v_first_order timestamptz;
  v_months_active numeric;
  v_annual_potential numeric;
  v_last_activity timestamptz;
  v_new_segment customer_segment;
BEGIN
  FOR rec IN
    SELECT id FROM customers
    WHERE (segment_locked IS NULL OR segment_locked = false)
      AND deleted_at IS NULL
  LOOP
    -- Get order stats
    SELECT COALESCE(SUM(order_value), 0), MIN(created_at)
    INTO v_total_value, v_first_order
    FROM sales_orders
    WHERE customer_id = rec.id
      AND status != 'cancelled';

    -- Get last activity date (latest of: last order, last lead, customer updated_at)
    SELECT GREATEST(
      (SELECT MAX(created_at) FROM sales_orders WHERE customer_id = rec.id AND status != 'cancelled'),
      (SELECT MAX(created_at) FROM leads WHERE customer_id = rec.id),
      (SELECT updated_at FROM customers WHERE id = rec.id)
    ) INTO v_last_activity;

    -- Calculate annual potential
    IF v_first_order IS NOT NULL AND v_total_value > 0 THEN
      v_months_active := GREATEST(
        3,
        EXTRACT(EPOCH FROM (now() - v_first_order)) / (30.44 * 24 * 3600)
      );
      v_annual_potential := (v_total_value / v_months_active) * 12;
    ELSE
      v_annual_potential := 0;
    END IF;

    -- Apply thresholds
    IF v_annual_potential >= 2500000 THEN
      v_new_segment := 'platinum';
    ELSIF v_annual_potential >= 1500000 THEN
      v_new_segment := 'gold';
    ELSIF v_annual_potential >= 800000 THEN
      v_new_segment := 'silver';
    ELSIF v_annual_potential >= 300000 THEN
      v_new_segment := 'bronze';
    ELSIF v_annual_potential < 300000 AND (v_last_activity IS NULL OR v_last_activity < now() - interval '90 days') THEN
      v_new_segment := 'inactive';
    ELSE
      v_new_segment := 'bronze';
    END IF;

    -- Update only if segment changed
    UPDATE customers
    SET segment = v_new_segment, updated_at = now()
    WHERE id = rec.id
      AND (segment IS DISTINCT FROM v_new_segment);

  END LOOP;
END;
$$;
