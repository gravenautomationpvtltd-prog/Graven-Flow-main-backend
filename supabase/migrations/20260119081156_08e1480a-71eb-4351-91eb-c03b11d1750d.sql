-- Drop the existing constraint
ALTER TABLE quotation_item_negotiations 
DROP CONSTRAINT quotation_item_negotiations_negotiation_status_check;

-- Add new constraint with all valid values including closed_won and closed_lost
ALTER TABLE quotation_item_negotiations 
ADD CONSTRAINT quotation_item_negotiations_negotiation_status_check 
CHECK (negotiation_status = ANY (ARRAY[
  'pending'::text, 
  'price_matched'::text, 
  'partial_match'::text, 
  'no_match'::text,
  'closed_won'::text,
  'closed_lost'::text
]));