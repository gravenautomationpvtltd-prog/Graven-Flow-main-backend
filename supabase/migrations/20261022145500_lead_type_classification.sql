-- Migration: 20261022145500_lead_type_classification.sql
-- Description: Add lead_type column and indexes for separate Contacts and Buyleads tabs

ALTER TABLE public.leads 
ADD COLUMN IF NOT EXISTS lead_type text DEFAULT 'contact';

CREATE INDEX IF NOT EXISTS idx_leads_lead_type ON public.leads (lead_type) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_leads_tenant_lead_type ON public.leads (tenant_id, lead_type) WHERE deleted_at IS NULL;

-- Backfill classification for existing TradeIndia buy leads
UPDATE public.leads
SET lead_type = 'buylead'
WHERE source = 'tradeindia'
  AND (
    title ILIKE '%buy lead%' 
    OR customer_query ILIKE '%buy lead%'
    OR title ILIKE '%is looking for suppliers%'
    OR customer_query ILIKE '%specification:%'
  )
  AND lead_type != 'buylead';

-- Backfill classification for existing IndiaMART buyer calls
UPDATE public.leads
SET lead_type = 'call'
WHERE source = 'indiamart'
  AND title ILIKE 'Buyer Call%'
  AND lead_type != 'call';

-- Backfill classification for existing IndiaMART buy leads
UPDATE public.leads
SET lead_type = 'buylead'
WHERE source = 'indiamart'
  AND lead_type = 'contact'
  AND (
    customer_query ILIKE '%Probable Order Value%'
    OR customer_query ILIKE '%Quantity :%'
    OR customer_query ILIKE '%Probable Requirement Type%'
  );
