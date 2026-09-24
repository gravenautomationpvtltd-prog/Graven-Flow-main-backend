
-- =========================================================================
-- Phase 2: Per-vertical document numbering
-- =========================================================================

-- Counter table: one row per (vertical, doc_type, fiscal year)
CREATE TABLE IF NOT EXISTS public.vertical_doc_counters (
  vertical_id uuid NOT NULL REFERENCES public.verticals(id) ON DELETE CASCADE,
  doc_type    text NOT NULL,         -- 'Q','SO','INV','PO','DSP'
  year_part   text NOT NULL,         -- 'YY'
  last_seq    integer NOT NULL DEFAULT 0,
  updated_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (vertical_id, doc_type, year_part)
);
ALTER TABLE public.vertical_doc_counters ENABLE ROW LEVEL SECURITY;

-- Service-side only; no policies needed (functions use SECURITY DEFINER).

-- Helper: bump and return next sequence
CREATE OR REPLACE FUNCTION public.next_vertical_doc_seq(_vertical uuid, _doc_type text, _year text)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE next_val integer;
BEGIN
  INSERT INTO public.vertical_doc_counters (vertical_id, doc_type, year_part, last_seq)
  VALUES (_vertical, _doc_type, _year, 1)
  ON CONFLICT (vertical_id, doc_type, year_part)
    DO UPDATE SET last_seq = vertical_doc_counters.last_seq + 1, updated_at = now()
  RETURNING last_seq INTO next_val;
  RETURN next_val;
END;
$$;

-- Helper: resolve the active user's default vertical (used by ensure trigger)
CREATE OR REPLACE FUNCTION public.ensure_vertical_id()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid;
BEGIN
  IF NEW.vertical_id IS NULL THEN
    -- Try the auth user's default vertical
    v_id := public.get_user_default_vertical(auth.uid());
    -- Fall back to tenant's default
    IF v_id IS NULL AND NEW.tenant_id IS NOT NULL THEN
      SELECT id INTO v_id FROM public.verticals
       WHERE tenant_id = NEW.tenant_id AND is_default = true AND is_active = true
       LIMIT 1;
    END IF;
    NEW.vertical_id := v_id;
  END IF;
  RETURN NEW;
END;
$$;

-- Attach ensure_vertical_id trigger to tables that have tenant_id
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'leads','customers','quotations','sales_orders','products',
    'cct_sourcing_decisions','lead_qualification','lead_assignment_rules'
  ] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%I_ensure_vertical ON public.%I', t, t);
    EXECUTE format(
      'CREATE TRIGGER trg_%I_ensure_vertical BEFORE INSERT ON public.%I
       FOR EACH ROW EXECUTE FUNCTION public.ensure_vertical_id()', t, t
    );
  END LOOP;
END$$;

-- For tables without tenant_id, derive from related row
CREATE OR REPLACE FUNCTION public.ensure_vertical_id_from_sales_order()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid;
BEGIN
  IF NEW.vertical_id IS NULL AND NEW.sales_order_id IS NOT NULL THEN
    SELECT vertical_id INTO v_id FROM public.sales_orders WHERE id = NEW.sales_order_id;
    NEW.vertical_id := v_id;
  END IF;
  IF NEW.vertical_id IS NULL THEN
    NEW.vertical_id := public.get_user_default_vertical(auth.uid());
  END IF;
  RETURN NEW;
END;
$$;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['invoices','purchase_orders','dispatches','customer_payments'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%I_ensure_vertical ON public.%I', t, t);
    EXECUTE format(
      'CREATE TRIGGER trg_%I_ensure_vertical BEFORE INSERT ON public.%I
       FOR EACH ROW EXECUTE FUNCTION public.ensure_vertical_id_from_sales_order()', t, t
    );
  END LOOP;
END$$;

-- =========================================================================
-- Replace number generators
-- =========================================================================

CREATE OR REPLACE FUNCTION public.generate_quotation_number()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $function$
DECLARE
  yr text := to_char(NOW(),'YY');
  prefix text := 'QT'; seq int;
BEGIN
  IF NEW.vertical_id IS NOT NULL THEN
    SELECT doc_prefix INTO prefix FROM public.verticals WHERE id = NEW.vertical_id;
    seq := public.next_vertical_doc_seq(NEW.vertical_id, 'Q', yr);
    NEW.quotation_number := COALESCE(prefix,'QT') || '-Q' || yr || '-' || LPAD(seq::text, 4, '0');
  ELSE
    NEW.quotation_number := 'QT' || yr || '-' || LPAD(NEXTVAL('quotation_number_seq')::text, 4, '0');
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.generate_order_number()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $function$
DECLARE
  yr text := to_char(NOW(),'YY');
  prefix text; seq int;
BEGIN
  IF NEW.vertical_id IS NOT NULL THEN
    SELECT doc_prefix INTO prefix FROM public.verticals WHERE id = NEW.vertical_id;
    seq := public.next_vertical_doc_seq(NEW.vertical_id, 'SO', yr);
    NEW.order_number := COALESCE(prefix,'GA') || '-SO' || yr || '-' || LPAD(seq::text, 4, '0');
  ELSE
    NEW.order_number := 'SO-' || to_char(NOW(),'YYYYMMDD') || '-' || LPAD(NEXTVAL('public.sales_order_number_seq')::text, 3, '0');
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.generate_invoice_number()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $function$
DECLARE
  yr text := to_char(NOW(),'YY');
  prefix text; seq int; seq_legacy int;
BEGIN
  IF NEW.vertical_id IS NOT NULL THEN
    SELECT doc_prefix INTO prefix FROM public.verticals WHERE id = NEW.vertical_id;
    seq := public.next_vertical_doc_seq(NEW.vertical_id, 'INV', yr);
    NEW.invoice_number := COALESCE(prefix,'INV') || '-INV' || yr || '-' || LPAD(seq::text, 4, '0');
  ELSE
    SELECT COALESCE(MAX(CAST(SUBSTRING(invoice_number FROM 'INV' || yr || '-(\d+)') AS INTEGER)),0) + 1
      INTO seq_legacy FROM public.invoices WHERE invoice_number LIKE 'INV' || yr || '-%';
    NEW.invoice_number := 'INV' || yr || '-' || LPAD(seq_legacy::text, 4, '0');
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.generate_po_number()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $function$
DECLARE
  yr text := to_char(NOW(),'YY');
  prefix text; seq int; seq_legacy int;
BEGIN
  IF NEW.vertical_id IS NOT NULL THEN
    SELECT doc_prefix INTO prefix FROM public.verticals WHERE id = NEW.vertical_id;
    seq := public.next_vertical_doc_seq(NEW.vertical_id, 'PO', yr);
    NEW.po_number := COALESCE(prefix,'PO') || '-PO' || yr || '-' || LPAD(seq::text, 4, '0');
  ELSE
    SELECT COALESCE(MAX(CAST(SUBSTRING(po_number FROM 'PO' || yr || '-(\d+)') AS INTEGER)),0) + 1
      INTO seq_legacy FROM public.purchase_orders WHERE po_number LIKE 'PO' || yr || '-%';
    NEW.po_number := 'PO' || yr || '-' || LPAD(seq_legacy::text, 4, '0');
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.generate_dispatch_number()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $function$
DECLARE
  yr text := to_char(NOW(),'YY');
  prefix text; seq int; seq_legacy int;
BEGIN
  IF NEW.vertical_id IS NOT NULL THEN
    SELECT doc_prefix INTO prefix FROM public.verticals WHERE id = NEW.vertical_id;
    seq := public.next_vertical_doc_seq(NEW.vertical_id, 'DSP', yr);
    NEW.dispatch_number := COALESCE(prefix,'DSP') || '-DSP' || yr || '-' || LPAD(seq::text, 4, '0');
  ELSE
    SELECT COALESCE(MAX(CAST(SUBSTRING(dispatch_number FROM 'DSP' || yr || '-(\d+)') AS INTEGER)),0) + 1
      INTO seq_legacy FROM public.dispatches WHERE dispatch_number LIKE 'DSP' || yr || '-%';
    NEW.dispatch_number := 'DSP' || yr || '-' || LPAD(seq_legacy::text, 4, '0');
  END IF;
  RETURN NEW;
END;
$function$;

-- Ensure the ensure_vertical_id trigger fires BEFORE the number trigger.
-- PostgreSQL fires BEFORE triggers in alphabetical order; our trg_* names start
-- with 'trg_' which sorts before 'set_' but after 'generate_' -- recreate the
-- existing number triggers with names that sort AFTER 'trg_' to be safe.
DROP TRIGGER IF EXISTS set_quotation_number ON public.quotations;
CREATE TRIGGER zzz_set_quotation_number BEFORE INSERT ON public.quotations
  FOR EACH ROW WHEN (((new.quotation_number IS NULL) OR (new.quotation_number = '') OR (new.quotation_number LIKE 'QT-TEMP-%')))
  EXECUTE FUNCTION public.generate_quotation_number();

DROP TRIGGER IF EXISTS generate_sales_order_number ON public.sales_orders;
CREATE TRIGGER zzz_generate_sales_order_number BEFORE INSERT ON public.sales_orders
  FOR EACH ROW WHEN (((new.order_number IS NULL) OR (new.order_number = '')))
  EXECUTE FUNCTION public.generate_order_number();

DROP TRIGGER IF EXISTS set_invoice_number ON public.invoices;
CREATE TRIGGER zzz_set_invoice_number BEFORE INSERT ON public.invoices
  FOR EACH ROW WHEN (new.invoice_number IS NULL)
  EXECUTE FUNCTION public.generate_invoice_number();

DROP TRIGGER IF EXISTS generate_po_number_trigger ON public.purchase_orders;
CREATE TRIGGER zzz_generate_po_number_trigger BEFORE INSERT ON public.purchase_orders
  FOR EACH ROW WHEN (((new.po_number IS NULL) OR (new.po_number = '')))
  EXECUTE FUNCTION public.generate_po_number();

DROP TRIGGER IF EXISTS generate_dispatch_number_trigger ON public.dispatches;
CREATE TRIGGER zzz_generate_dispatch_number_trigger BEFORE INSERT ON public.dispatches
  FOR EACH ROW WHEN (((new.dispatch_number IS NULL) OR (new.dispatch_number = '')))
  EXECUTE FUNCTION public.generate_dispatch_number();
