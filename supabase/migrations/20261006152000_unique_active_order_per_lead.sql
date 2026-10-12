-- Migration: 20261006152000_unique_active_order_per_lead.sql
-- Description: Enforce database-level uniqueness to prevent duplicate orders for the same lead.

CREATE UNIQUE INDEX IF NOT EXISTS idx_sales_orders_unique_active_lead
ON public.sales_orders (lead_id)
WHERE lead_id IS NOT NULL AND status != 'cancelled';
