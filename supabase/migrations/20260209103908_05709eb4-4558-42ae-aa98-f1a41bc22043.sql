-- Add sent_by_user_id column to track who performed the outreach action
ALTER TABLE customer_outreach 
ADD COLUMN sent_by_user_id uuid REFERENCES profiles(id);

-- Create index for analytics queries by user
CREATE INDEX idx_customer_outreach_sent_by ON customer_outreach(sent_by_user_id);

-- Add comment for documentation
COMMENT ON COLUMN customer_outreach.sent_by_user_id IS 'The user who performed this outreach action (WhatsApp or Email)';