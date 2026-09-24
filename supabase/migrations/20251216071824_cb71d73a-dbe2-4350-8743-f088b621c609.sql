-- Fix NULL customer_ids in existing sales_orders by populating from their linked lead's customer_id
UPDATE public.sales_orders so
SET customer_id = l.customer_id
FROM public.leads l
WHERE so.lead_id = l.id
  AND so.customer_id IS NULL
  AND l.customer_id IS NOT NULL;