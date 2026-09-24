-- Create payment mode enum
CREATE TYPE public.payment_mode AS ENUM ('cash', 'neft', 'rtgs', 'cheque', 'upi', 'card', 'other');

-- Create dispatch document type enum
CREATE TYPE public.dispatch_document_type AS ENUM ('invoice', 'eway_bill', 'awb', 'packing_list', 'other');

-- Create customer_payments table
CREATE TABLE public.customer_payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  sales_order_id UUID REFERENCES public.sales_orders(id) ON DELETE SET NULL,
  amount NUMERIC NOT NULL,
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  payment_mode public.payment_mode NOT NULL DEFAULT 'neft',
  transaction_reference TEXT,
  bank_name TEXT,
  receipt_url TEXT,
  received_by UUID REFERENCES public.profiles(id),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create dispatch_documents table
CREATE TABLE public.dispatch_documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  dispatch_id UUID NOT NULL REFERENCES public.dispatches(id) ON DELETE CASCADE,
  document_type public.dispatch_document_type NOT NULL,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  uploaded_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add sales_order_id to dispatches table
ALTER TABLE public.dispatches ADD COLUMN sales_order_id UUID REFERENCES public.sales_orders(id) ON DELETE SET NULL;

-- Create storage bucket for dispatch documents
INSERT INTO storage.buckets (id, name, public) VALUES ('dispatch-documents', 'dispatch-documents', true);

-- Enable RLS on customer_payments
ALTER TABLE public.customer_payments ENABLE ROW LEVEL SECURITY;

-- RLS policies for customer_payments
CREATE POLICY "Customer payments viewable by authenticated users"
ON public.customer_payments FOR SELECT USING (true);

CREATE POLICY "Sales and above can create payments"
ON public.customer_payments FOR INSERT WITH CHECK (true);

CREATE POLICY "Sales and above can update payments"
ON public.customer_payments FOR UPDATE USING (true);

CREATE POLICY "Admins can delete payments"
ON public.customer_payments FOR DELETE USING (is_admin_or_above(auth.uid()));

-- Enable RLS on dispatch_documents
ALTER TABLE public.dispatch_documents ENABLE ROW LEVEL SECURITY;

-- RLS policies for dispatch_documents
CREATE POLICY "Dispatch documents viewable by authenticated users"
ON public.dispatch_documents FOR SELECT USING (true);

CREATE POLICY "Authenticated users can upload documents"
ON public.dispatch_documents FOR INSERT WITH CHECK (true);

CREATE POLICY "Uploader and managers can update documents"
ON public.dispatch_documents FOR UPDATE USING ((uploaded_by = auth.uid()) OR is_manager_or_above(auth.uid()));

CREATE POLICY "Uploader and managers can delete documents"
ON public.dispatch_documents FOR DELETE USING ((uploaded_by = auth.uid()) OR is_manager_or_above(auth.uid()));

-- Storage policies for dispatch-documents bucket
CREATE POLICY "Dispatch documents are publicly accessible"
ON storage.objects FOR SELECT USING (bucket_id = 'dispatch-documents');

CREATE POLICY "Authenticated users can upload dispatch documents"
ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'dispatch-documents' AND auth.role() = 'authenticated');

CREATE POLICY "Users can update their dispatch documents"
ON storage.objects FOR UPDATE USING (bucket_id = 'dispatch-documents' AND auth.role() = 'authenticated');

CREATE POLICY "Users can delete their dispatch documents"
ON storage.objects FOR DELETE USING (bucket_id = 'dispatch-documents' AND auth.role() = 'authenticated');

-- Create updated_at trigger for customer_payments
CREATE TRIGGER update_customer_payments_updated_at
BEFORE UPDATE ON public.customer_payments
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for new tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.customer_payments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.dispatch_documents;