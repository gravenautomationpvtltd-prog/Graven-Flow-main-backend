-- Create quotation_item_negotiations table for tracking pricing journey
CREATE TABLE public.quotation_item_negotiations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID REFERENCES public.products(id),
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  quotation_id UUID NOT NULL REFERENCES public.quotations(id) ON DELETE CASCADE,
  quotation_item_id UUID REFERENCES public.quotation_items(id) ON DELETE CASCADE,
  initial_quoted_rate DECIMAL(12,2) NOT NULL,
  target_rate DECIMAL(12,2),
  final_rate DECIMAL(12,2),
  negotiation_status TEXT NOT NULL DEFAULT 'pending' CHECK (negotiation_status IN ('pending', 'price_matched', 'partial_match', 'no_match')),
  price_gap DECIMAL(12,2),
  final_gap DECIMAL(12,2),
  supplier_id UUID REFERENCES public.suppliers(id),
  outcome TEXT DEFAULT 'pending' CHECK (outcome IN ('won', 'lost', 'pending')),
  product_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.quotation_item_negotiations ENABLE ROW LEVEL SECURITY;

-- Create policies for quotation_item_negotiations - using user_roles table
CREATE POLICY "Users can view negotiations based on role"
ON public.quotation_item_negotiations
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.role IN ('super_admin', 'coo', 'manager', 'procurement')
  )
  OR
  EXISTS (
    SELECT 1 FROM leads l
    WHERE l.id = quotation_item_negotiations.lead_id
    AND l.assigned_to = auth.uid()
  )
);

CREATE POLICY "Authenticated users can insert negotiations"
ON public.quotation_item_negotiations
FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update negotiations"
ON public.quotation_item_negotiations
FOR UPDATE
USING (auth.uid() IS NOT NULL);

-- Create trigger for updated_at
CREATE TRIGGER update_quotation_item_negotiations_updated_at
BEFORE UPDATE ON public.quotation_item_negotiations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for performance
CREATE INDEX idx_negotiations_product_id ON public.quotation_item_negotiations(product_id);
CREATE INDEX idx_negotiations_lead_id ON public.quotation_item_negotiations(lead_id);
CREATE INDEX idx_negotiations_outcome ON public.quotation_item_negotiations(outcome);
CREATE INDEX idx_negotiations_supplier_id ON public.quotation_item_negotiations(supplier_id);