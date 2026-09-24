-- Create the unique index to prevent future duplicates
CREATE UNIQUE INDEX IF NOT EXISTS idx_leads_source_reference_unique 
ON leads (source, source_reference) 
WHERE source_reference IS NOT NULL;

-- Add comment for documentation
COMMENT ON INDEX idx_leads_source_reference_unique IS 'Prevents duplicate leads from the same source with same reference ID';