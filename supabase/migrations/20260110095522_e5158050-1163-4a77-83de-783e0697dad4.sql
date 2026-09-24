-- Create product_price_history table to track all price revisions
CREATE TABLE public.product_price_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  old_rate DECIMAL(12,2),
  new_rate DECIMAL(12,2) NOT NULL,
  supplier_id UUID REFERENCES public.suppliers(id),
  changed_by UUID REFERENCES public.profiles(id),
  change_reason TEXT,
  source TEXT DEFAULT 'manual', -- 'manual', 'quotation', 'purchase_order', 'negotiation'
  reference_id UUID, -- link to quotation_id, po_id, etc.
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.product_price_history ENABLE ROW LEVEL SECURITY;

-- Create policies for product_price_history
CREATE POLICY "Managers and above can view price history"
ON public.product_price_history
FOR SELECT
USING (is_manager_or_above(auth.uid()) OR is_procurement_or_above(auth.uid()));

CREATE POLICY "Managers and above can insert price history"
ON public.product_price_history
FOR INSERT
WITH CHECK (is_manager_or_above(auth.uid()) OR is_procurement_or_above(auth.uid()));

CREATE POLICY "Managers and above can update price history"
ON public.product_price_history
FOR UPDATE
USING (is_manager_or_above(auth.uid()) OR is_procurement_or_above(auth.uid()));

CREATE POLICY "Managers and above can delete price history"
ON public.product_price_history
FOR DELETE
USING (is_manager_or_above(auth.uid()));

-- Create indexes for performance
CREATE INDEX idx_product_price_history_product ON public.product_price_history(product_id);
CREATE INDEX idx_product_price_history_created ON public.product_price_history(created_at DESC);
CREATE INDEX idx_product_price_history_supplier ON public.product_price_history(supplier_id);

-- Create function to log product price changes automatically
CREATE OR REPLACE FUNCTION public.log_product_price_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.default_rate IS DISTINCT FROM NEW.default_rate THEN
    INSERT INTO public.product_price_history (
      product_id, old_rate, new_rate, changed_by, source
    ) VALUES (
      NEW.id, OLD.default_rate, NEW.default_rate, NEW.price_updated_by, 'manual'
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger on products table
CREATE TRIGGER trg_product_price_history
  AFTER UPDATE ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.log_product_price_change();