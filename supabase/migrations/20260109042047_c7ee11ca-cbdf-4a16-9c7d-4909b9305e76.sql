-- Create enquiry_status enum
CREATE TYPE public.enquiry_status AS ENUM (
  'no_enquiry',
  'pending_prices',
  'partial_prices',
  'ready_to_quote',
  'quoted',
  'price_matched',
  'negotiating',
  'closed'
);

-- Create price_request_status enum
CREATE TYPE public.price_request_status AS ENUM (
  'pending',
  'in_progress',
  'resolved',
  'no_price'
);

-- Add new columns to leads table for enquiry tracking
ALTER TABLE public.leads
ADD COLUMN has_enquiry boolean DEFAULT false,
ADD COLUMN enquiry_status public.enquiry_status DEFAULT 'no_enquiry',
ADD COLUMN first_response_at timestamptz,
ADD COLUMN first_response_minutes integer,
ADD COLUMN quoted_at timestamptz,
ADD COLUMN price_matched_at timestamptz;

-- Add new columns to quotations table for price matching
ALTER TABLE public.quotations
ADD COLUMN is_price_matched boolean DEFAULT false,
ADD COLUMN price_matched_at timestamptz,
ADD COLUMN revision_number integer DEFAULT 1,
ADD COLUMN previous_quotation_id uuid REFERENCES public.quotations(id),
ADD COLUMN price_difference_from_initial numeric;

-- Create enquiry_items table to store parsed product requirements
CREATE TABLE public.enquiry_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  product_query_text text NOT NULL,
  quantity numeric DEFAULT 1,
  matched_product_id uuid REFERENCES public.products(id),
  price_available boolean DEFAULT false,
  price_flagged_to_procurement_at timestamptz,
  price_flagged_by uuid REFERENCES public.profiles(id),
  price_resolved_at timestamptz,
  price_resolved_by uuid REFERENCES public.profiles(id),
  supplier_id uuid REFERENCES public.suppliers(id),
  notes text,
  sort_order integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Create price_requests table for sales to procurement workflow
CREATE TABLE public.price_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  enquiry_item_id uuid REFERENCES public.enquiry_items(id) ON DELETE CASCADE,
  requested_by uuid NOT NULL REFERENCES public.profiles(id),
  requested_at timestamptz NOT NULL DEFAULT now(),
  status public.price_request_status DEFAULT 'pending',
  priority text DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  assigned_to uuid REFERENCES public.profiles(id),
  resolved_at timestamptz,
  resolved_by uuid REFERENCES public.profiles(id),
  supplier_id uuid REFERENCES public.suppliers(id),
  resolved_price numeric,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Create indexes for better query performance
CREATE INDEX idx_leads_has_enquiry ON public.leads(has_enquiry) WHERE has_enquiry = true;
CREATE INDEX idx_leads_enquiry_status ON public.leads(enquiry_status);
CREATE INDEX idx_enquiry_items_lead_id ON public.enquiry_items(lead_id);
CREATE INDEX idx_enquiry_items_price_available ON public.enquiry_items(price_available);
CREATE INDEX idx_price_requests_status ON public.price_requests(status);
CREATE INDEX idx_price_requests_assigned_to ON public.price_requests(assigned_to);
CREATE INDEX idx_quotations_is_price_matched ON public.quotations(is_price_matched) WHERE is_price_matched = true;

-- Enable RLS on new tables
ALTER TABLE public.enquiry_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.price_requests ENABLE ROW LEVEL SECURITY;

-- RLS policies for enquiry_items
CREATE POLICY "Enquiry items viewable by authenticated users"
  ON public.enquiry_items FOR SELECT
  USING (true);

CREATE POLICY "Sales and managers can create enquiry items"
  ON public.enquiry_items FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Sales and managers can update enquiry items"
  ON public.enquiry_items FOR UPDATE
  USING (true);

CREATE POLICY "Admins can delete enquiry items"
  ON public.enquiry_items FOR DELETE
  USING (is_admin_or_above(auth.uid()));

-- RLS policies for price_requests
CREATE POLICY "Price requests viewable by authenticated users"
  ON public.price_requests FOR SELECT
  USING (true);

CREATE POLICY "Sales can create price requests"
  ON public.price_requests FOR INSERT
  WITH CHECK (requested_by = auth.uid());

CREATE POLICY "Procurement and managers can update price requests"
  ON public.price_requests FOR UPDATE
  USING (is_procurement_or_above(auth.uid()) OR requested_by = auth.uid());

CREATE POLICY "Admins can delete price requests"
  ON public.price_requests FOR DELETE
  USING (is_admin_or_above(auth.uid()));

-- Create trigger for updated_at on new tables
CREATE TRIGGER update_enquiry_items_updated_at
  BEFORE UPDATE ON public.enquiry_items
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_price_requests_updated_at
  BEFORE UPDATE ON public.price_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for new tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.enquiry_items;
ALTER PUBLICATION supabase_realtime ADD TABLE public.price_requests;