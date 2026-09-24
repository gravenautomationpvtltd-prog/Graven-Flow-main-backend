ALTER TABLE public.sales_orders 
ADD COLUMN preferred_supplier_id uuid REFERENCES public.suppliers(id),
ADD COLUMN expected_arrival date;