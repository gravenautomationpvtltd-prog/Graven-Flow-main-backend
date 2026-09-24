
-- Fix trigger to handle QT-TEMP prefix
DROP TRIGGER IF EXISTS set_quotation_number ON public.quotations;

CREATE OR REPLACE FUNCTION public.generate_quotation_number()
RETURNS TRIGGER AS $$
DECLARE
  year_part TEXT;
  seq_num INTEGER;
BEGIN
  year_part := to_char(NOW(), 'YY');
  SELECT COALESCE(MAX(CAST(SUBSTRING(quotation_number FROM 'QT' || year_part || '-(\d+)') AS INTEGER)), 0) + 1
  INTO seq_num
  FROM public.quotations
  WHERE quotation_number LIKE 'QT' || year_part || '-%';
  
  NEW.quotation_number := 'QT' || year_part || '-' || LPAD(seq_num::TEXT, 4, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER set_quotation_number
BEFORE INSERT ON public.quotations
FOR EACH ROW
WHEN (NEW.quotation_number IS NULL OR NEW.quotation_number = '' OR NEW.quotation_number LIKE 'QT-TEMP-%')
EXECUTE FUNCTION public.generate_quotation_number();
