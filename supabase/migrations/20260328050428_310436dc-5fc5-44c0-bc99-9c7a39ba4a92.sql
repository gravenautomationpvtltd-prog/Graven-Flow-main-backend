
-- Create sequence for order numbers (concurrency-safe)
CREATE SEQUENCE IF NOT EXISTS public.sales_order_number_seq START WITH 1;

-- Initialize sequence to current max suffix across all dates
DO $$
DECLARE
  v_max_suffix integer;
BEGIN
  SELECT COALESCE(MAX(CAST(SUBSTRING(order_number FROM 'SO-\d{8}-(\d+)') AS INTEGER)), 0)
  INTO v_max_suffix
  FROM public.sales_orders
  WHERE order_number ~ '^SO-\d{8}-\d+$';
  
  IF v_max_suffix > 0 THEN
    PERFORM setval('public.sales_order_number_seq', v_max_suffix);
  END IF;
END $$;

-- Replace generate_order_number function with sequence-based version
CREATE OR REPLACE FUNCTION public.generate_order_number()
  RETURNS trigger
  LANGUAGE plpgsql
  SET search_path TO 'public'
AS $function$
DECLARE
  date_part TEXT;
  seq_val INTEGER;
BEGIN
  date_part := to_char(NOW(), 'YYYYMMDD');
  seq_val := nextval('public.sales_order_number_seq');
  NEW.order_number := 'SO-' || date_part || '-' || LPAD(seq_val::TEXT, 3, '0');
  RETURN NEW;
END;
$function$;
