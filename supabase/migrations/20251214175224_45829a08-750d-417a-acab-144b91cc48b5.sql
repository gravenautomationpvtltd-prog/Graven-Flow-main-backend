-- Backfill sent_by from quotation's created_by for historical records
UPDATE public.email_logs el
SET sent_by = q.created_by
FROM public.quotations q
WHERE el.quotation_id = q.id
  AND el.sent_by IS NULL
  AND q.created_by IS NOT NULL;