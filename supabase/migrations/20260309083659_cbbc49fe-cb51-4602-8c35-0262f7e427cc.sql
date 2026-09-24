
-- Create import_invoices table
CREATE TABLE public.import_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  internal_ref text NOT NULL,
  invoice_number text NOT NULL,
  supplier_id uuid REFERENCES public.suppliers(id) NOT NULL,
  po_id uuid REFERENCES public.purchase_orders(id),
  invoice_date date NOT NULL DEFAULT CURRENT_DATE,
  due_date date,
  currency text NOT NULL DEFAULT 'USD',
  exchange_rate numeric NOT NULL DEFAULT 1,
  subtotal numeric NOT NULL DEFAULT 0,
  shipping_charges numeric NOT NULL DEFAULT 0,
  insurance numeric NOT NULL DEFAULT 0,
  customs_duty numeric NOT NULL DEFAULT 0,
  igst_amount numeric NOT NULL DEFAULT 0,
  other_charges numeric NOT NULL DEFAULT 0,
  grand_total numeric NOT NULL DEFAULT 0,
  grand_total_inr numeric NOT NULL DEFAULT 0,
  amount_paid numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  bill_of_entry_number text,
  awb_bl_number text,
  notes text,
  created_by uuid REFERENCES public.profiles(id),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Create import_invoice_items table
CREATE TABLE public.import_invoice_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  import_invoice_id uuid NOT NULL REFERENCES public.import_invoices(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id),
  description text NOT NULL,
  quantity numeric NOT NULL DEFAULT 1,
  unit text,
  unit_price numeric NOT NULL DEFAULT 0,
  total numeric NOT NULL DEFAULT 0,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.import_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.import_invoice_items ENABLE ROW LEVEL SECURITY;

-- RLS for import_invoices
CREATE POLICY "Tenant users can view import invoices"
  ON public.import_invoices FOR SELECT TO authenticated
  USING (public.is_my_tenant(tenant_id));

CREATE POLICY "Tenant users can insert import invoices"
  ON public.import_invoices FOR INSERT TO authenticated
  WITH CHECK (public.is_my_tenant(tenant_id));

CREATE POLICY "Tenant users can update import invoices"
  ON public.import_invoices FOR UPDATE TO authenticated
  USING (public.is_my_tenant(tenant_id))
  WITH CHECK (public.is_my_tenant(tenant_id));

CREATE POLICY "Tenant users can delete import invoices"
  ON public.import_invoices FOR DELETE TO authenticated
  USING (public.is_my_tenant(tenant_id));

-- RLS for import_invoice_items (via parent)
CREATE POLICY "Tenant users can view import invoice items"
  ON public.import_invoice_items FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.import_invoices ii
    WHERE ii.id = import_invoice_id AND public.is_my_tenant(ii.tenant_id)
  ));

CREATE POLICY "Tenant users can insert import invoice items"
  ON public.import_invoice_items FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.import_invoices ii
    WHERE ii.id = import_invoice_id AND public.is_my_tenant(ii.tenant_id)
  ));

CREATE POLICY "Tenant users can update import invoice items"
  ON public.import_invoice_items FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.import_invoices ii
    WHERE ii.id = import_invoice_id AND public.is_my_tenant(ii.tenant_id)
  ));

CREATE POLICY "Tenant users can delete import invoice items"
  ON public.import_invoice_items FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.import_invoices ii
    WHERE ii.id = import_invoice_id AND public.is_my_tenant(ii.tenant_id)
  ));

-- Auto-number trigger for internal_ref (IMP25-0001 format)
CREATE OR REPLACE FUNCTION public.generate_import_invoice_number()
  RETURNS trigger
  LANGUAGE plpgsql
  SET search_path TO 'public'
AS $function$
DECLARE
  year_part TEXT;
  seq_num INTEGER;
BEGIN
  year_part := to_char(NOW(), 'YY');
  SELECT COALESCE(MAX(CAST(SUBSTRING(internal_ref FROM 'IMP' || year_part || '-(\d+)') AS INTEGER)), 0) + 1
  INTO seq_num
  FROM public.import_invoices
  WHERE internal_ref LIKE 'IMP' || year_part || '-%';
  
  NEW.internal_ref := 'IMP' || year_part || '-' || LPAD(seq_num::TEXT, 4, '0');
  RETURN NEW;
END;
$function$;

CREATE TRIGGER set_import_invoice_number
  BEFORE INSERT ON public.import_invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_import_invoice_number();
