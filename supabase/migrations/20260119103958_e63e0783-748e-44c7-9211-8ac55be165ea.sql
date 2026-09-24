-- Create a trigger function to update product lead_time_days when supplier quotation is accepted
CREATE OR REPLACE FUNCTION public.update_product_lead_time_from_supplier_quotation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Only trigger when status changes to 'accepted'
  IF NEW.status = 'accepted' AND (OLD.status IS NULL OR OLD.status != 'accepted') THEN
    -- Update lead_time_days for all products in this quotation that match the preferred supplier
    UPDATE public.products p
    SET lead_time_days = NEW.lead_time_days
    FROM public.supplier_quotation_items sqi
    WHERE sqi.quotation_id = NEW.id
      AND sqi.product_id = p.id
      AND p.preferred_supplier_id = NEW.supplier_id
      AND NEW.lead_time_days IS NOT NULL;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create the trigger
DROP TRIGGER IF EXISTS update_product_lead_time_on_quotation_accept ON public.supplier_quotations;
CREATE TRIGGER update_product_lead_time_on_quotation_accept
  AFTER UPDATE ON public.supplier_quotations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_product_lead_time_from_supplier_quotation();

-- Also add a comment for documentation
COMMENT ON FUNCTION public.update_product_lead_time_from_supplier_quotation() IS 
'Automatically updates product lead_time_days when a supplier quotation is accepted, but only for products where this supplier is the preferred supplier';