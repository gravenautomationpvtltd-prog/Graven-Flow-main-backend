
DROP FUNCTION IF EXISTS public.auto_segment_customers(uuid);

CREATE OR REPLACE FUNCTION public.auto_segment_customers(p_tenant_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_updated integer := 0;
  v_customer record;
BEGIN
  FOR v_customer IN
    SELECT 
      c.id,
      c.segment as current_segment,
      COALESCE(order_stats.order_count, 0) as order_count,
      COALESCE(order_stats.total_value, 0) as total_value,
      order_stats.last_order_date,
      COALESCE(lead_stats.lead_count, 0) as lead_count,
      lead_stats.last_lead_date
    FROM customers c
    LEFT JOIN (
      SELECT customer_id,
             count(*) as order_count,
             sum(order_value) as total_value,
             max(created_at) as last_order_date
      FROM sales_orders
      WHERE status != 'cancelled'
      GROUP BY customer_id
    ) order_stats ON order_stats.customer_id = c.id
    LEFT JOIN (
      SELECT customer_id,
             count(*) as lead_count,
             max(created_at) as last_lead_date
      FROM leads
      WHERE deleted_at IS NULL
      GROUP BY customer_id
    ) lead_stats ON lead_stats.customer_id = c.id
    WHERE c.tenant_id = p_tenant_id
      AND c.deleted_at IS NULL
  LOOP
    DECLARE
      v_new_segment customer_segment;
      v_last_activity timestamptz;
    BEGIN
      v_last_activity := GREATEST(v_customer.last_order_date, v_customer.last_lead_date);

      IF v_customer.order_count >= 10 
         OR v_customer.total_value >= 500000
         OR (v_customer.order_count >= 5 AND v_customer.lead_count >= 10) THEN
        v_new_segment := 'platinum';
      ELSIF v_customer.order_count >= 5 
            OR v_customer.total_value >= 200000
            OR v_customer.lead_count >= 8
            OR (v_customer.order_count >= 2 AND v_customer.lead_count >= 5) THEN
        v_new_segment := 'gold';
      ELSIF v_customer.order_count >= 2 
            OR v_customer.total_value >= 50000
            OR v_customer.lead_count >= 3 THEN
        v_new_segment := 'silver';
      ELSIF v_last_activity IS NOT NULL 
            AND v_last_activity < now() - interval '90 days'
            AND v_customer.order_count < 2
            AND v_customer.lead_count < 2 THEN
        v_new_segment := 'inactive';
      ELSE
        v_new_segment := 'bronze';
      END IF;

      IF v_customer.current_segment IS DISTINCT FROM v_new_segment THEN
        UPDATE customers SET segment = v_new_segment WHERE id = v_customer.id;
        v_updated := v_updated + 1;
      END IF;
    END;
  END LOOP;

  RETURN jsonb_build_object('customers_updated', v_updated);
END;
$function$;
