-- Add columns to store custom notes for "Other" reasons
ALTER TABLE leads 
  ADD COLUMN won_reason_notes TEXT,
  ADD COLUMN lost_reason_notes TEXT;

-- Add comments for documentation
COMMENT ON COLUMN leads.won_reason_notes IS 'Custom notes when won_reason is "other"';
COMMENT ON COLUMN leads.lost_reason_notes IS 'Custom notes when lost_reason is "other"';