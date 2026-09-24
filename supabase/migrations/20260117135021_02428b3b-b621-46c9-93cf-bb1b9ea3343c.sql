-- Add is_converted column to quotations table
ALTER TABLE public.quotations ADD COLUMN IF NOT EXISTS is_converted BOOLEAN DEFAULT false;

-- Add converted_to_order_id for tracking which order was created
ALTER TABLE public.quotations ADD COLUMN IF NOT EXISTS converted_to_order_id UUID REFERENCES public.sales_orders(id);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_quotations_is_converted ON public.quotations(is_converted) WHERE is_converted = true;

-- Update the auto_create_negotiations trigger to only process the CONVERTED quotation (linked to order)
-- For won leads: only use the quotation linked to the sales order
-- For lost leads: only use the LATEST quotation (most recent revision)
CREATE OR REPLACE FUNCTION public.auto_create_negotiations_on_lead_status()
RETURNS TRIGGER AS $$
DECLARE
  target_quotation_id UUID;
  quotation_record RECORD;
  item_record RECORD;
BEGIN
  -- Only trigger when status changes to 'won' or 'lost'
  IF (NEW.status IN ('won', 'lost') AND OLD.status NOT IN ('won', 'lost')) THEN
    
    -- For WON leads: Use the quotation linked to the sales order
    IF NEW.status = 'won' THEN
      SELECT quotation_id INTO target_quotation_id
      FROM sales_orders
      WHERE lead_id = NEW.id AND quotation_id IS NOT NULL
      ORDER BY created_at DESC
      LIMIT 1;
    END IF;
    
    -- If no quotation linked to order, or for LOST leads: use the LATEST quotation
    IF target_quotation_id IS NULL THEN
      SELECT id INTO target_quotation_id
      FROM quotations
      WHERE lead_id = NEW.id
      ORDER BY created_at DESC
      LIMIT 1;
    END IF;
    
    -- Only proceed if we found a quotation
    IF target_quotation_id IS NOT NULL THEN
      -- Delete any existing negotiations for OTHER quotations of this lead
      -- This handles cases where a lead was previously marked won/lost with wrong quotations
      DELETE FROM quotation_item_negotiations
      WHERE lead_id = NEW.id AND quotation_id != target_quotation_id;
      
      -- Get the target quotation details
      SELECT id, quotation_number INTO quotation_record
      FROM quotations
      WHERE id = target_quotation_id;
      
      -- Create negotiation records for each quotation item
      FOR item_record IN
        SELECT qi.id, qi.product_id, qi.description, qi.quantity, qi.unit_price, qi.total_price, p.name as product_name
        FROM quotation_items qi
        LEFT JOIN products p ON p.id = qi.product_id
        WHERE qi.quotation_id = target_quotation_id
          AND qi.product_id IS NOT NULL
      LOOP
        -- Insert negotiation record if not exists
        INSERT INTO quotation_item_negotiations (
          quotation_item_id,
          quotation_id,
          product_id,
          lead_id,
          product_name,
          initial_quoted_rate,
          final_rate,
          outcome,
          negotiation_status
        )
        SELECT 
          item_record.id,
          target_quotation_id,
          item_record.product_id,
          NEW.id,
          item_record.product_name,
          item_record.unit_price,
          CASE WHEN NEW.status = 'won' THEN item_record.unit_price ELSE NULL END,
          NEW.status,
          CASE WHEN NEW.status = 'won' THEN 'closed_won' ELSE 'closed_lost' END
        WHERE NOT EXISTS (
          SELECT 1 FROM quotation_item_negotiations qin
          WHERE qin.quotation_item_id = item_record.id
            AND qin.lead_id = NEW.id
        );
      END LOOP;
      
      -- Mark the quotation as converted if won
      IF NEW.status = 'won' THEN
        UPDATE quotations SET is_converted = true WHERE id = target_quotation_id;
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Recreate the trigger
DROP TRIGGER IF EXISTS trigger_auto_create_negotiations ON leads;
CREATE TRIGGER trigger_auto_create_negotiations
  AFTER UPDATE ON leads
  FOR EACH ROW
  EXECUTE FUNCTION auto_create_negotiations_on_lead_status();

-- BACKFILL: Fix existing data
-- Step 1: For orders with quotation_id set, mark those quotations as converted
UPDATE quotations q
SET is_converted = true, converted_to_order_id = so.id
FROM sales_orders so
WHERE so.quotation_id = q.id;

-- Step 2: For orders WITHOUT quotation_id, try to find matching quotation by lead_id
-- and link them (use the quotation with closest grand_total to order_value)
WITH order_quotation_matches AS (
  SELECT DISTINCT ON (so.id)
    so.id as order_id,
    q.id as quotation_id
  FROM sales_orders so
  JOIN quotations q ON q.lead_id = so.lead_id
  WHERE so.quotation_id IS NULL
    AND so.lead_id IS NOT NULL
  ORDER BY so.id, ABS(q.grand_total - so.order_value) ASC
)
UPDATE sales_orders so
SET quotation_id = oqm.quotation_id
FROM order_quotation_matches oqm
WHERE so.id = oqm.order_id;

-- Step 3: Now mark these newly linked quotations as converted
UPDATE quotations q
SET is_converted = true, converted_to_order_id = so.id
FROM sales_orders so
WHERE so.quotation_id = q.id AND q.is_converted = false;

-- Step 4: Delete duplicate negotiation records for leads with multiple quotations
-- Keep only records from the converted quotation (for won leads) or latest quotation (for lost)
WITH correct_quotations AS (
  -- For won leads with orders: use the order's quotation_id
  SELECT l.id as lead_id, so.quotation_id
  FROM leads l
  JOIN sales_orders so ON so.lead_id = l.id
  WHERE l.status = 'won' AND so.quotation_id IS NOT NULL
  
  UNION ALL
  
  -- For lost leads or won leads without order quotation: use latest quotation
  SELECT l.id as lead_id, (
    SELECT q.id FROM quotations q WHERE q.lead_id = l.id ORDER BY q.created_at DESC LIMIT 1
  ) as quotation_id
  FROM leads l
  WHERE l.status IN ('won', 'lost')
    AND NOT EXISTS (
      SELECT 1 FROM sales_orders so WHERE so.lead_id = l.id AND so.quotation_id IS NOT NULL
    )
)
DELETE FROM quotation_item_negotiations qin
WHERE EXISTS (
  SELECT 1 FROM correct_quotations cq
  WHERE cq.lead_id = qin.lead_id
    AND cq.quotation_id IS NOT NULL
    AND qin.quotation_id != cq.quotation_id
);