-- Phase 1: Decision Deck Schema Extensions

-- 1.1 Add industry_tag to customers for market segmentation
ALTER TABLE public.customers 
  ADD COLUMN IF NOT EXISTS industry_tag TEXT;

-- 1.2 Add loss_reason to quotations for price-loss attribution
ALTER TABLE public.quotations 
  ADD COLUMN IF NOT EXISTS loss_reason TEXT CHECK (
    loss_reason IS NULL OR 
    loss_reason IN ('high_price', 'budget_constraint', 'competition_lower_price', 
                    'technical_mismatch', 'delivery_timeline', 'no_response', 'other')
  );

-- 1.3 Add product intelligence fields
ALTER TABLE public.products 
  ADD COLUMN IF NOT EXISTS brand TEXT,
  ADD COLUMN IF NOT EXISTS supplier_dependency_pct NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS lead_time_days INTEGER DEFAULT 0;

-- Add helpful index for loss reason queries
CREATE INDEX IF NOT EXISTS idx_quotations_loss_reason ON public.quotations(loss_reason) WHERE loss_reason IS NOT NULL;

-- Add index for industry tag queries
CREATE INDEX IF NOT EXISTS idx_customers_industry_tag ON public.customers(industry_tag) WHERE industry_tag IS NOT NULL;