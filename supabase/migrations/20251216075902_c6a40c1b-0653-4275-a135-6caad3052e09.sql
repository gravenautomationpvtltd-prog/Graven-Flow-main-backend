-- Add sales_order_id column to purchase_orders to link POs with sales orders
ALTER TABLE public.purchase_orders 
ADD COLUMN IF NOT EXISTS sales_order_id uuid REFERENCES public.sales_orders(id) ON DELETE SET NULL;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_purchase_orders_sales_order_id ON public.purchase_orders(sales_order_id);

-- Add sales_order_id column to dispatches if not exists (for linking dispatches to sales orders)
ALTER TABLE public.dispatches 
ADD COLUMN IF NOT EXISTS sales_order_id uuid REFERENCES public.sales_orders(id) ON DELETE SET NULL;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_dispatches_sales_order_id ON public.dispatches(sales_order_id);