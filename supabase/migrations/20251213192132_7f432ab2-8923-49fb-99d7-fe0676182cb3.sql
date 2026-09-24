-- Create suppliers table
CREATE TABLE public.suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  contact_person TEXT,
  email TEXT,
  phone TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  pincode TEXT,
  gst_number TEXT,
  payment_terms TEXT,
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Create purchase_orders table
CREATE TABLE public.purchase_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  po_number TEXT NOT NULL UNIQUE,
  supplier_id UUID REFERENCES public.suppliers(id),
  lead_id UUID REFERENCES public.leads(id),
  quotation_id UUID REFERENCES public.quotations(id),
  status TEXT DEFAULT 'draft' NOT NULL,
  order_date DATE DEFAULT CURRENT_DATE,
  expected_delivery DATE,
  subtotal NUMERIC DEFAULT 0,
  total_tax NUMERIC DEFAULT 0,
  grand_total NUMERIC DEFAULT 0,
  notes TEXT,
  terms_conditions TEXT,
  created_by UUID REFERENCES public.profiles(id),
  approved_by UUID REFERENCES public.profiles(id),
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Create purchase_order_items table
CREATE TABLE public.purchase_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  po_id UUID REFERENCES public.purchase_orders(id) ON DELETE CASCADE NOT NULL,
  product_id UUID REFERENCES public.products(id),
  description TEXT NOT NULL,
  hsn_code TEXT,
  quantity NUMERIC DEFAULT 1 NOT NULL,
  rate NUMERIC DEFAULT 0 NOT NULL,
  tax_percent NUMERIC DEFAULT 18,
  tax_amount NUMERIC DEFAULT 0,
  amount NUMERIC DEFAULT 0 NOT NULL,
  received_quantity NUMERIC DEFAULT 0,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Create inventory table
CREATE TABLE public.inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES public.products(id) NOT NULL,
  office_id UUID REFERENCES public.offices(id) NOT NULL,
  quantity NUMERIC DEFAULT 0 NOT NULL,
  min_stock_level NUMERIC DEFAULT 0,
  max_stock_level NUMERIC,
  last_restocked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE(product_id, office_id)
);

-- Create stock_movements table
CREATE TABLE public.stock_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inventory_id UUID REFERENCES public.inventory(id),
  product_id UUID REFERENCES public.products(id) NOT NULL,
  office_id UUID REFERENCES public.offices(id) NOT NULL,
  movement_type TEXT NOT NULL,
  quantity NUMERIC NOT NULL,
  reference_type TEXT,
  reference_id UUID,
  notes TEXT,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Create dispatches table
CREATE TABLE public.dispatches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dispatch_number TEXT NOT NULL UNIQUE,
  quotation_id UUID REFERENCES public.quotations(id),
  customer_id UUID REFERENCES public.customers(id),
  lead_id UUID REFERENCES public.leads(id),
  status TEXT DEFAULT 'pending' NOT NULL,
  dispatch_date DATE,
  courier_name TEXT,
  tracking_number TEXT,
  shipping_address TEXT,
  notes TEXT,
  dispatched_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Create dispatch_items table
CREATE TABLE public.dispatch_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dispatch_id UUID REFERENCES public.dispatches(id) ON DELETE CASCADE NOT NULL,
  product_id UUID REFERENCES public.products(id),
  description TEXT NOT NULL,
  quantity NUMERIC DEFAULT 1 NOT NULL,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Enable RLS on all tables
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dispatches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dispatch_items ENABLE ROW LEVEL SECURITY;

-- RLS Policies for suppliers
CREATE POLICY "Suppliers viewable by authenticated users"
ON public.suppliers FOR SELECT USING (true);

CREATE POLICY "Procurement and managers can manage suppliers"
ON public.suppliers FOR ALL
USING (is_manager_or_above(auth.uid()));

CREATE POLICY "Procurement can create suppliers"
ON public.suppliers FOR INSERT
WITH CHECK (true);

-- RLS Policies for purchase_orders
CREATE POLICY "POs viewable by authenticated users"
ON public.purchase_orders FOR SELECT USING (true);

CREATE POLICY "Procurement can create POs"
ON public.purchase_orders FOR INSERT
WITH CHECK (true);

CREATE POLICY "Creator and managers can update POs"
ON public.purchase_orders FOR UPDATE
USING ((created_by = auth.uid()) OR is_manager_or_above(auth.uid()));

CREATE POLICY "Admins can delete POs"
ON public.purchase_orders FOR DELETE
USING (is_admin_or_above(auth.uid()));

-- RLS Policies for purchase_order_items
CREATE POLICY "PO items viewable by authenticated users"
ON public.purchase_order_items FOR SELECT USING (true);

CREATE POLICY "Authenticated users can manage PO items"
ON public.purchase_order_items FOR ALL USING (true);

-- RLS Policies for inventory
CREATE POLICY "Inventory viewable by authenticated users"
ON public.inventory FOR SELECT USING (true);

CREATE POLICY "Managers can manage inventory"
ON public.inventory FOR ALL
USING (is_manager_or_above(auth.uid()));

CREATE POLICY "Procurement can create inventory"
ON public.inventory FOR INSERT
WITH CHECK (true);

CREATE POLICY "Procurement can update inventory"
ON public.inventory FOR UPDATE USING (true);

-- RLS Policies for stock_movements
CREATE POLICY "Stock movements viewable by authenticated users"
ON public.stock_movements FOR SELECT USING (true);

CREATE POLICY "Authenticated users can create stock movements"
ON public.stock_movements FOR INSERT
WITH CHECK (true);

-- RLS Policies for dispatches
CREATE POLICY "Dispatches viewable by authenticated users"
ON public.dispatches FOR SELECT USING (true);

CREATE POLICY "Authenticated users can create dispatches"
ON public.dispatches FOR INSERT
WITH CHECK (true);

CREATE POLICY "Creator and managers can update dispatches"
ON public.dispatches FOR UPDATE
USING ((dispatched_by = auth.uid()) OR is_manager_or_above(auth.uid()));

CREATE POLICY "Admins can delete dispatches"
ON public.dispatches FOR DELETE
USING (is_admin_or_above(auth.uid()));

-- RLS Policies for dispatch_items
CREATE POLICY "Dispatch items viewable by authenticated users"
ON public.dispatch_items FOR SELECT USING (true);

CREATE POLICY "Authenticated users can manage dispatch items"
ON public.dispatch_items FOR ALL USING (true);

-- Function to generate PO number
CREATE OR REPLACE FUNCTION public.generate_po_number()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  year_part TEXT;
  seq_num INTEGER;
BEGIN
  year_part := to_char(NOW(), 'YY');
  SELECT COALESCE(MAX(CAST(SUBSTRING(po_number FROM 'PO' || year_part || '-(\d+)') AS INTEGER)), 0) + 1
  INTO seq_num
  FROM public.purchase_orders
  WHERE po_number LIKE 'PO' || year_part || '-%';
  
  NEW.po_number := 'PO' || year_part || '-' || LPAD(seq_num::TEXT, 4, '0');
  RETURN NEW;
END;
$$;

-- Trigger for auto PO number
CREATE TRIGGER generate_po_number_trigger
BEFORE INSERT ON public.purchase_orders
FOR EACH ROW
WHEN (NEW.po_number IS NULL OR NEW.po_number = '')
EXECUTE FUNCTION public.generate_po_number();

-- Function to generate dispatch number
CREATE OR REPLACE FUNCTION public.generate_dispatch_number()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  year_part TEXT;
  seq_num INTEGER;
BEGIN
  year_part := to_char(NOW(), 'YY');
  SELECT COALESCE(MAX(CAST(SUBSTRING(dispatch_number FROM 'DSP' || year_part || '-(\d+)') AS INTEGER)), 0) + 1
  INTO seq_num
  FROM public.dispatches
  WHERE dispatch_number LIKE 'DSP' || year_part || '-%';
  
  NEW.dispatch_number := 'DSP' || year_part || '-' || LPAD(seq_num::TEXT, 4, '0');
  RETURN NEW;
END;
$$;

-- Trigger for auto dispatch number
CREATE TRIGGER generate_dispatch_number_trigger
BEFORE INSERT ON public.dispatches
FOR EACH ROW
WHEN (NEW.dispatch_number IS NULL OR NEW.dispatch_number = '')
EXECUTE FUNCTION public.generate_dispatch_number();

-- Updated_at triggers
CREATE TRIGGER update_suppliers_updated_at
BEFORE UPDATE ON public.suppliers
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_purchase_orders_updated_at
BEFORE UPDATE ON public.purchase_orders
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_inventory_updated_at
BEFORE UPDATE ON public.inventory
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_dispatches_updated_at
BEFORE UPDATE ON public.dispatches
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();