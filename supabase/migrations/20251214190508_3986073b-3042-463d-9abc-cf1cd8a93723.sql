
-- Feature 1: GRN (Goods Receipt Note) Module
CREATE TABLE public.goods_receipt_notes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  grn_number TEXT NOT NULL UNIQUE,
  po_id UUID NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  supplier_id UUID REFERENCES public.suppliers(id),
  received_by UUID REFERENCES public.profiles(id),
  received_date DATE NOT NULL DEFAULT CURRENT_DATE,
  status TEXT NOT NULL DEFAULT 'pending',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE public.grn_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  grn_id UUID NOT NULL REFERENCES public.goods_receipt_notes(id) ON DELETE CASCADE,
  po_item_id UUID NOT NULL REFERENCES public.purchase_order_items(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id),
  ordered_quantity NUMERIC NOT NULL DEFAULT 0,
  received_quantity NUMERIC NOT NULL DEFAULT 0,
  accepted_quantity NUMERIC NOT NULL DEFAULT 0,
  rejected_quantity NUMERIC NOT NULL DEFAULT 0,
  rejection_reason TEXT,
  batch_number TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Auto-generate GRN number
CREATE OR REPLACE FUNCTION public.generate_grn_number()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  year_part TEXT;
  seq_num INTEGER;
BEGIN
  year_part := to_char(NOW(), 'YY');
  SELECT COALESCE(MAX(CAST(SUBSTRING(grn_number FROM 'GRN' || year_part || '-(\d+)') AS INTEGER)), 0) + 1
  INTO seq_num
  FROM public.goods_receipt_notes
  WHERE grn_number LIKE 'GRN' || year_part || '-%';
  
  NEW.grn_number := 'GRN' || year_part || '-' || LPAD(seq_num::TEXT, 4, '0');
  RETURN NEW;
END;
$function$;

CREATE TRIGGER generate_grn_number_trigger
BEFORE INSERT ON public.goods_receipt_notes
FOR EACH ROW
WHEN (NEW.grn_number IS NULL OR NEW.grn_number = '')
EXECUTE FUNCTION public.generate_grn_number();

-- Enable RLS for GRN tables
ALTER TABLE public.goods_receipt_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grn_items ENABLE ROW LEVEL SECURITY;

-- RLS policies for goods_receipt_notes
CREATE POLICY "GRNs viewable by authenticated users" ON public.goods_receipt_notes
FOR SELECT USING (true);

CREATE POLICY "Procurement can create GRNs" ON public.goods_receipt_notes
FOR INSERT WITH CHECK (true);

CREATE POLICY "Procurement can update GRNs" ON public.goods_receipt_notes
FOR UPDATE USING (is_procurement_or_above(auth.uid()));

CREATE POLICY "Admins can delete GRNs" ON public.goods_receipt_notes
FOR DELETE USING (is_admin_or_above(auth.uid()));

-- RLS policies for grn_items
CREATE POLICY "GRN items viewable by authenticated users" ON public.grn_items
FOR SELECT USING (true);

CREATE POLICY "Authenticated users can manage GRN items" ON public.grn_items
FOR ALL USING (true);

-- Feature 2: Send PO Email - Add columns to purchase_orders and email_logs
ALTER TABLE public.purchase_orders 
ADD COLUMN IF NOT EXISTS sent_to_supplier_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS sent_to_supplier_by UUID REFERENCES public.profiles(id);

ALTER TABLE public.email_logs 
ADD COLUMN IF NOT EXISTS po_id UUID REFERENCES public.purchase_orders(id);

-- Feature 3: Supplier Ratings
CREATE TABLE public.supplier_ratings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  supplier_id UUID NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  po_id UUID REFERENCES public.purchase_orders(id),
  grn_id UUID REFERENCES public.goods_receipt_notes(id),
  quality_rating INTEGER CHECK (quality_rating >= 1 AND quality_rating <= 5),
  delivery_rating INTEGER CHECK (delivery_rating >= 1 AND delivery_rating <= 5),
  price_rating INTEGER CHECK (price_rating >= 1 AND price_rating <= 5),
  overall_rating NUMERIC GENERATED ALWAYS AS (
    (COALESCE(quality_rating, 3) + COALESCE(delivery_rating, 3) + COALESCE(price_rating, 3))::NUMERIC / 3
  ) STORED,
  comments TEXT,
  rated_by UUID REFERENCES public.profiles(id),
  rated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.supplier_ratings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Ratings viewable by authenticated users" ON public.supplier_ratings
FOR SELECT USING (true);

CREATE POLICY "Procurement can create ratings" ON public.supplier_ratings
FOR INSERT WITH CHECK (true);

CREATE POLICY "Procurement can update ratings" ON public.supplier_ratings
FOR UPDATE USING (is_procurement_or_above(auth.uid()));

-- Feature 4: Quick PO from Low Stock
ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS preferred_supplier_id UUID REFERENCES public.suppliers(id);

ALTER TABLE public.inventory 
ADD COLUMN IF NOT EXISTS reorder_quantity NUMERIC DEFAULT 0;

-- Create updated_at trigger for GRN
CREATE TRIGGER update_goods_receipt_notes_updated_at
BEFORE UPDATE ON public.goods_receipt_notes
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
