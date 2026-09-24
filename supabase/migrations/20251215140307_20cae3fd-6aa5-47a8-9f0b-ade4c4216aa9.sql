
-- Create enum for order status
CREATE TYPE order_status AS ENUM ('pending_documents', 'ready_for_procurement', 'in_procurement', 'partially_fulfilled', 'fulfilled');

-- Create enum for payment status
CREATE TYPE payment_status AS ENUM ('pending', 'partial', 'received');

-- Create enum for document type
CREATE TYPE order_document_type AS ENUM ('customer_po', 'payment_receipt', 'other');

-- Create sales_orders table
CREATE TABLE public.sales_orders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_number TEXT NOT NULL UNIQUE,
  lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  quotation_id UUID REFERENCES public.quotations(id) ON DELETE SET NULL,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  status order_status NOT NULL DEFAULT 'pending_documents',
  order_value NUMERIC DEFAULT 0,
  payment_status payment_status NOT NULL DEFAULT 'pending',
  payment_amount NUMERIC DEFAULT 0,
  notes TEXT,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  assigned_procurement UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create order_documents table
CREATE TABLE public.order_documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sales_order_id UUID NOT NULL REFERENCES public.sales_orders(id) ON DELETE CASCADE,
  document_type order_document_type NOT NULL,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  uploaded_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create storage bucket for order documents
INSERT INTO storage.buckets (id, name, public) VALUES ('order-documents', 'order-documents', true);

-- Create function to generate order number
CREATE OR REPLACE FUNCTION public.generate_order_number()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  date_part TEXT;
  seq_num INTEGER;
BEGIN
  date_part := to_char(NOW(), 'YYYYMMDD');
  SELECT COALESCE(MAX(CAST(SUBSTRING(order_number FROM 'SO-' || date_part || '-(\d+)') AS INTEGER)), 0) + 1
  INTO seq_num
  FROM public.sales_orders
  WHERE order_number LIKE 'SO-' || date_part || '-%';
  
  NEW.order_number := 'SO-' || date_part || '-' || LPAD(seq_num::TEXT, 3, '0');
  RETURN NEW;
END;
$$;

-- Create trigger for auto-generating order number
CREATE TRIGGER generate_sales_order_number
BEFORE INSERT ON public.sales_orders
FOR EACH ROW
WHEN (NEW.order_number IS NULL OR NEW.order_number = '')
EXECUTE FUNCTION public.generate_order_number();

-- Create trigger for updating updated_at
CREATE TRIGGER update_sales_orders_updated_at
BEFORE UPDATE ON public.sales_orders
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Enable RLS
ALTER TABLE public.sales_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_documents ENABLE ROW LEVEL SECURITY;

-- RLS policies for sales_orders
CREATE POLICY "Sales orders viewable by authenticated users"
ON public.sales_orders FOR SELECT
USING (true);

CREATE POLICY "Sales can create orders"
ON public.sales_orders FOR INSERT
WITH CHECK (true);

CREATE POLICY "Creator and managers can update orders"
ON public.sales_orders FOR UPDATE
USING (created_by = auth.uid() OR is_manager_or_above(auth.uid()) OR is_procurement_or_above(auth.uid()));

CREATE POLICY "Admins can delete orders"
ON public.sales_orders FOR DELETE
USING (is_admin_or_above(auth.uid()));

-- RLS policies for order_documents
CREATE POLICY "Order documents viewable by authenticated users"
ON public.order_documents FOR SELECT
USING (true);

CREATE POLICY "Authenticated users can upload documents"
ON public.order_documents FOR INSERT
WITH CHECK (true);

CREATE POLICY "Uploader and managers can delete documents"
ON public.order_documents FOR DELETE
USING (uploaded_by = auth.uid() OR is_manager_or_above(auth.uid()));

-- Storage policies for order-documents bucket
CREATE POLICY "Order documents are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'order-documents');

CREATE POLICY "Authenticated users can upload order documents"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'order-documents' AND auth.role() = 'authenticated');

CREATE POLICY "Users can update their uploaded documents"
ON storage.objects FOR UPDATE
USING (bucket_id = 'order-documents' AND auth.role() = 'authenticated');

CREATE POLICY "Users can delete their uploaded documents"
ON storage.objects FOR DELETE
USING (bucket_id = 'order-documents' AND auth.role() = 'authenticated');

-- Enable realtime for sales_orders
ALTER PUBLICATION supabase_realtime ADD TABLE public.sales_orders;
