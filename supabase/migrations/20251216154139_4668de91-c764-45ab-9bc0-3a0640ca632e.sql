-- Create invoices table
CREATE TABLE public.invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number TEXT NOT NULL UNIQUE,
  invoice_date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE,
  
  -- Linked entities
  sales_order_id UUID REFERENCES public.sales_orders(id),
  dispatch_id UUID REFERENCES public.dispatches(id),
  quotation_id UUID REFERENCES public.quotations(id),
  customer_id UUID NOT NULL REFERENCES public.customers(id),
  
  -- Financial details
  subtotal NUMERIC DEFAULT 0,
  total_tax NUMERIC DEFAULT 0,
  total_discount NUMERIC DEFAULT 0,
  grand_total NUMERIC NOT NULL DEFAULT 0,
  amount_paid NUMERIC DEFAULT 0,
  
  -- Status tracking
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'partial', 'paid', 'cancelled', 'overdue')),
  
  -- GST details
  place_of_supply TEXT,
  is_igst BOOLEAN DEFAULT false,
  cgst_amount NUMERIC DEFAULT 0,
  sgst_amount NUMERIC DEFAULT 0,
  igst_amount NUMERIC DEFAULT 0,
  
  -- Metadata
  notes TEXT,
  terms_conditions TEXT,
  sent_at TIMESTAMPTZ,
  sent_by UUID REFERENCES public.profiles(id),
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create invoice_items table
CREATE TABLE public.invoice_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id),
  description TEXT NOT NULL,
  hsn_code TEXT,
  quantity NUMERIC NOT NULL DEFAULT 1,
  unit TEXT DEFAULT 'Nos',
  rate NUMERIC NOT NULL DEFAULT 0,
  discount_percent NUMERIC DEFAULT 0,
  discount_amount NUMERIC DEFAULT 0,
  tax_percent NUMERIC DEFAULT 18,
  tax_amount NUMERIC DEFAULT 0,
  amount NUMERIC NOT NULL DEFAULT 0,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create supplier_payments table
CREATE TABLE public.supplier_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID NOT NULL REFERENCES public.suppliers(id),
  po_id UUID REFERENCES public.purchase_orders(id),
  amount NUMERIC NOT NULL,
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  payment_mode TEXT NOT NULL DEFAULT 'neft' CHECK (payment_mode IN ('cash', 'neft', 'cheque', 'upi', 'card')),
  transaction_reference TEXT,
  bank_name TEXT,
  notes TEXT,
  paid_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Auto-generate invoice numbers
CREATE OR REPLACE FUNCTION public.generate_invoice_number()
RETURNS TRIGGER AS $$
DECLARE
  year_part TEXT;
  seq_num INTEGER;
BEGIN
  year_part := to_char(NOW(), 'YY');
  SELECT COALESCE(MAX(CAST(SUBSTRING(invoice_number FROM 'INV' || year_part || '-(\d+)') AS INTEGER)), 0) + 1
  INTO seq_num
  FROM public.invoices
  WHERE invoice_number LIKE 'INV' || year_part || '-%';
  
  NEW.invoice_number := 'INV' || year_part || '-' || LPAD(seq_num::TEXT, 4, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER set_invoice_number
  BEFORE INSERT ON public.invoices
  FOR EACH ROW
  WHEN (NEW.invoice_number IS NULL)
  EXECUTE FUNCTION public.generate_invoice_number();

-- Update triggers
CREATE TRIGGER update_invoices_updated_at
  BEFORE UPDATE ON public.invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_supplier_payments_updated_at
  BEFORE UPDATE ON public.supplier_payments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Enable RLS
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_payments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for invoices
CREATE POLICY "Invoices viewable by authenticated users"
  ON public.invoices FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can create invoices"
  ON public.invoices FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Creator and managers can update invoices"
  ON public.invoices FOR UPDATE
  USING ((created_by = auth.uid()) OR is_manager_or_above(auth.uid()));

CREATE POLICY "Admins can delete invoices"
  ON public.invoices FOR DELETE
  USING (is_admin_or_above(auth.uid()));

-- RLS Policies for invoice_items
CREATE POLICY "Invoice items viewable by authenticated users"
  ON public.invoice_items FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can manage invoice items"
  ON public.invoice_items FOR ALL
  USING (true);

-- RLS Policies for supplier_payments
CREATE POLICY "Supplier payments viewable by authenticated users"
  ON public.supplier_payments FOR SELECT
  USING (true);

CREATE POLICY "Procurement can create supplier payments"
  ON public.supplier_payments FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Procurement can update supplier payments"
  ON public.supplier_payments FOR UPDATE
  USING (is_procurement_or_above(auth.uid()));

CREATE POLICY "Admins can delete supplier payments"
  ON public.supplier_payments FOR DELETE
  USING (is_admin_or_above(auth.uid()));