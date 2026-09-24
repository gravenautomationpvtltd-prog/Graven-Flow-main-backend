
CREATE OR REPLACE FUNCTION public.auto_segment_customers(p_tenant_id uuid DEFAULT NULL)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_updated integer := 0;
  v_customer record;
  v_order_count integer;
  v_total_value numeric;
  v_lead_count integer;
  v_last_order_date timestamptz;
  v_last_lead_date timestamptz;
  v_new_segment text;
  v_days_since_last_activity integer;
BEGIN
  FOR v_customer IN
    SELECT c.id, c.tenant_id
    FROM customers c
    WHERE c.deleted_at IS NULL
      AND (p_tenant_id IS NULL OR c.tenant_id = p_tenant_id)
  LOOP
    -- Count all-time orders and total value
    SELECT COUNT(*), COALESCE(SUM(so.order_value), 0), MAX(so.created_at)
    INTO v_order_count, v_total_value, v_last_order_date
    FROM sales_orders so
    WHERE so.customer_id = v_customer.id
      AND so.status NOT IN ('cancelled');

    -- Count all-time leads
    SELECT COUNT(*), MAX(l.created_at)
    INTO v_lead_count, v_last_lead_date
    FROM leads l
    WHERE l.customer_id = v_customer.id
      AND l.deleted_at IS NULL;

    -- Days since last activity (order or lead)
    v_days_since_last_activity := EXTRACT(DAY FROM now() - GREATEST(
      COALESCE(v_last_order_date, '1970-01-01'::timestamptz),
      COALESCE(v_last_lead_date, '1970-01-01'::timestamptz)
    ))::integer;

    -- Segmentation logic
    IF v_days_since_last_activity > 90 AND v_order_count < 2 THEN
      v_new_segment := 'inactive';
    ELSIF v_order_count >= 10 OR v_total_value >= 500000 THEN
      v_new_segment := 'platinum';
    ELSIF v_order_count >= 5 OR v_total_value >= 200000 THEN
      v_new_segment := 'gold';
    ELSIF v_order_count >= 2 OR v_total_value >= 50000 THEN
      v_new_segment := 'silver';
    ELSE
      v_new_segment := 'bronze';
    END IF;

    -- Update if changed
    UPDATE customers
    SET segment = v_new_segment::customer_segment
    WHERE id = v_customer.id
      AND (segment IS DISTINCT FROM v_new_segment::customer_segment);

    IF FOUND THEN
      v_updated := v_updated + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'status', 'success',
    'customers_updated', v_updated
  );
END;
$function$;
