
-- Trigger to sync order_value when quotation grand_total changes
CREATE OR REPLACE FUNCTION public.sync_order_value_on_quotation_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF OLD.grand_total IS DISTINCT FROM NEW.grand_total THEN
    UPDATE public.sales_orders
    SET order_value = NEW.grand_total
    WHERE quotation_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER sync_order_value_on_quotation_update
AFTER UPDATE OF grand_total ON public.quotations
FOR EACH ROW
EXECUTE FUNCTION public.sync_order_value_on_quotation_update();
