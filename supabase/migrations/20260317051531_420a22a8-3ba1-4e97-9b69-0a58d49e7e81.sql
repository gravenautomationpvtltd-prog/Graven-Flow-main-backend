
ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'cancelled';
ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'postponed';

ALTER TABLE public.sales_orders ADD COLUMN IF NOT EXISTS cancellation_reason text;
ALTER TABLE public.sales_orders ADD COLUMN IF NOT EXISTS postponed_until date;
ALTER TABLE public.sales_orders ADD COLUMN IF NOT EXISTS status_change_reason text;
