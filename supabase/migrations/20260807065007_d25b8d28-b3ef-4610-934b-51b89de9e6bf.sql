ALTER TABLE public.price_request_rounds
  ADD COLUMN IF NOT EXISTS sales_decision TEXT,
  ADD COLUMN IF NOT EXISTS sales_decision_notes TEXT,
  ADD COLUMN IF NOT EXISTS sales_decision_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS sales_decision_by UUID;

ALTER TABLE public.price_requests
  ADD COLUMN IF NOT EXISTS sales_outcome_notes TEXT,
  ADD COLUMN IF NOT EXISTS sales_outcome_by UUID;