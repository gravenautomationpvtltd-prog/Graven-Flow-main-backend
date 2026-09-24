ALTER TABLE public.sales_orders
  ADD CONSTRAINT sales_orders_qc_released_by_fkey
  FOREIGN KEY (qc_released_by) REFERENCES public.profiles(id) ON DELETE SET NULL;