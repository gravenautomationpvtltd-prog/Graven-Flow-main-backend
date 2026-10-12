-- Migration: Optimize Lead Ingestion and LQT Inbox Queries
-- 1. Index phone and alternate_phone on customers for instant lead-customer matching
CREATE INDEX IF NOT EXISTS idx_customers_phone 
  ON public.customers (phone) 
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_customers_alt_phone 
  ON public.customers (alternate_phone) 
  WHERE deleted_at IS NULL;

-- 2. Index leads by source and created_at DESC for instant sync-worker lookback
CREATE INDEX IF NOT EXISTS idx_leads_source_created_at 
  ON public.leads (source, created_at DESC) 
  WHERE deleted_at IS NULL;

-- 3. Composite index for LQT Pending Inbox queries
CREATE INDEX IF NOT EXISTS idx_leads_lqt_pending 
  ON public.leads (tenant_id, assigned_to, created_at DESC) 
  WHERE deleted_at IS NULL;

-- 4. Fast helper function for batch lead insertion
COMMENT ON INDEX idx_customers_phone IS 'Accelerates IndiaMART and webhook customer phone matching';
COMMENT ON INDEX idx_leads_source_created_at IS 'Accelerates IndiaMART sync worker latest lead lookback';
COMMENT ON INDEX idx_leads_lqt_pending IS 'Accelerates LQT inbox scoped queries per employee';
