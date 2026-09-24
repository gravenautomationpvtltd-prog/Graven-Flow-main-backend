-- Create quotation_versions table for tracking edit history
CREATE TABLE public.quotation_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quotation_id UUID NOT NULL REFERENCES public.quotations(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES public.profiles(id),
  
  -- Snapshot of quotation data at this version
  subject TEXT,
  notes TEXT,
  terms_conditions TEXT,
  subtotal NUMERIC,
  total_discount NUMERIC,
  total_tax NUMERIC,
  grand_total NUMERIC,
  valid_until DATE,
  currency TEXT,
  exchange_rate NUMERIC,
  
  -- JSON snapshot of items
  items_snapshot JSONB NOT NULL,
  
  -- Optional: reason for edit
  change_reason TEXT
);

-- Index for fast lookups
CREATE INDEX idx_quotation_versions_quotation ON public.quotation_versions(quotation_id, version_number DESC);

-- Enable RLS
ALTER TABLE public.quotation_versions ENABLE ROW LEVEL SECURITY;

-- RLS Policies - same access as quotations
CREATE POLICY "Users can view quotation versions"
ON public.quotation_versions
FOR SELECT
USING (true);

CREATE POLICY "Authenticated users can create quotation versions"
ON public.quotation_versions
FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

-- Add comment
COMMENT ON TABLE public.quotation_versions IS 'Stores version history snapshots for quotations';