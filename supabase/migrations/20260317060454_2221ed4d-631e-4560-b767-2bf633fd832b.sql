
-- Create a sequence for quotation numbers
CREATE SEQUENCE IF NOT EXISTS quotation_number_seq START WITH 1;

-- Set sequence to current max to avoid conflicts with existing quotation numbers
SELECT setval('quotation_number_seq', 
  COALESCE(
    (SELECT MAX(CAST(SUBSTRING(quotation_number FROM 'QT\d{2}-(\d+)') AS INTEGER)) 
     FROM quotations WHERE quotation_number ~ '^QT\d{2}-\d+$'), 
    0
  )
);

-- Replace the trigger function with sequence-based approach
CREATE OR REPLACE FUNCTION public.generate_quotation_number()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  year_part TEXT;
BEGIN
  year_part := to_char(NOW(), 'YY');
  NEW.quotation_number := 'QT' || year_part || '-' || LPAD(NEXTVAL('quotation_number_seq')::TEXT, 4, '0');
  RETURN NEW;
END;
$function$;
