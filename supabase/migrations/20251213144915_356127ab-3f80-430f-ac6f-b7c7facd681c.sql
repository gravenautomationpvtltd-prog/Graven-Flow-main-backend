-- Create products table for catalog
CREATE TABLE public.products (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  hsn_code TEXT,
  unit TEXT DEFAULT 'Nos',
  default_rate NUMERIC DEFAULT 0,
  tax_rate NUMERIC DEFAULT 18,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create quotations table
CREATE TABLE public.quotations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  quotation_number TEXT NOT NULL UNIQUE,
  lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  subject TEXT,
  notes TEXT,
  terms_conditions TEXT,
  subtotal NUMERIC DEFAULT 0,
  total_discount NUMERIC DEFAULT 0,
  total_tax NUMERIC DEFAULT 0,
  grand_total NUMERIC DEFAULT 0,
  valid_until DATE,
  sent_at TIMESTAMP WITH TIME ZONE,
  sent_via TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create quotation line items table
CREATE TABLE public.quotation_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  quotation_id UUID NOT NULL REFERENCES public.quotations(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
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
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quotation_items ENABLE ROW LEVEL SECURITY;

-- Products policies (viewable by all, manageable by managers+)
CREATE POLICY "Products viewable by authenticated users"
ON public.products FOR SELECT USING (true);

CREATE POLICY "Managers can manage products"
ON public.products FOR ALL USING (is_manager_or_above(auth.uid()));

-- Quotations policies
CREATE POLICY "Quotations viewable by authenticated users"
ON public.quotations FOR SELECT USING (true);

CREATE POLICY "Authenticated users can create quotations"
ON public.quotations FOR INSERT WITH CHECK (true);

CREATE POLICY "Creator and managers can update quotations"
ON public.quotations FOR UPDATE USING (created_by = auth.uid() OR is_manager_or_above(auth.uid()));

CREATE POLICY "Admins can delete quotations"
ON public.quotations FOR DELETE USING (is_admin_or_above(auth.uid()));

-- Quotation items policies
CREATE POLICY "Quotation items viewable by authenticated users"
ON public.quotation_items FOR SELECT USING (true);

CREATE POLICY "Authenticated users can manage quotation items"
ON public.quotation_items FOR ALL USING (true);

-- Create function to generate quotation number
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

-- Create trigger for auto quotation number
CREATE TRIGGER set_quotation_number
BEFORE INSERT ON public.quotations
FOR EACH ROW
WHEN (NEW.quotation_number IS NULL OR NEW.quotation_number = '')
EXECUTE FUNCTION public.generate_quotation_number();

-- Update triggers
CREATE TRIGGER update_products_updated_at
BEFORE UPDATE ON public.products
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_quotations_updated_at
BEFORE UPDATE ON public.quotations
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();