CREATE OR REPLACE FUNCTION public.generate_po_number()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $function$
DECLARE
  yr text := to_char(NOW(),'YY');
  prefix text;
  is_default_vertical boolean := false;
  seq int;
  seq_legacy int;
BEGIN
  IF NEW.vertical_id IS NOT NULL THEN
    SELECT doc_prefix, is_default
      INTO prefix, is_default_vertical
      FROM public.verticals WHERE id = NEW.vertical_id;
  END IF;

  IF NEW.vertical_id IS NOT NULL AND COALESCE(is_default_vertical, false) = false THEN
    -- Non-default vertical: prefixed format with its own counter
    seq := public.next_vertical_doc_seq(NEW.vertical_id, 'PO', yr);
    NEW.po_number := COALESCE(prefix,'PO') || '-PO' || yr || '-' || LPAD(seq::text, 4, '0');
  ELSE
    -- Default vertical OR no vertical: continue legacy PO<YY>-<seq>
    SELECT COALESCE(MAX(CAST(SUBSTRING(po_number FROM '^PO' || yr || '-(\d+)$') AS INTEGER)),0) + 1
      INTO seq_legacy
      FROM public.purchase_orders
      WHERE po_number ~ ('^PO' || yr || '-\d+$');
    NEW.po_number := 'PO' || yr || '-' || LPAD(seq_legacy::text, 4, '0');
  END IF;
  RETURN NEW;
END;
$function$;