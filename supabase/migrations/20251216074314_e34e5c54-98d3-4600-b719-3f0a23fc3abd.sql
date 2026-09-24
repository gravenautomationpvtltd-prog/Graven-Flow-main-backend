-- 1) Backfill sales_orders.customer_id from the linked lead
UPDATE public.sales_orders so
SET customer_id = l.customer_id
FROM public.leads l
WHERE so.lead_id = l.id
  AND so.customer_id IS NULL
  AND l.customer_id IS NOT NULL;

-- 2) Backfill customer_payments for orders that already have payment_amount but no payment rows
INSERT INTO public.customer_payments (
  customer_id,
  sales_order_id,
  amount,
  payment_date,
  payment_mode,
  received_by,
  notes
)
SELECT
  so.customer_id,
  so.id,
  COALESCE(so.payment_amount, 0) AS amount,
  COALESCE(so.created_at::date, CURRENT_DATE) AS payment_date,
  'neft'::public.payment_mode AS payment_mode,
  so.created_by AS received_by,
  CONCAT(
    'Backfilled from order ',
    so.order_number,
    ' (payment_status=',
    so.payment_status::text,
    ')'
  ) AS notes
FROM public.sales_orders so
WHERE COALESCE(so.payment_amount, 0) > 0
  AND so.customer_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.customer_payments cp
    WHERE cp.sales_order_id = so.id
  );
