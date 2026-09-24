ALTER TABLE public.purchase_orders 
ADD COLUMN supplier_quotation_id uuid REFERENCES public.supplier_quotations(id);