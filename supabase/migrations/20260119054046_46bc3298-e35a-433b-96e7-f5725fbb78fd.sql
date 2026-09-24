-- Fix column name references in auto_create_negotiations_on_lead_status function
-- The quotation_items table uses 'rate' not 'unit_price' and 'amount' not 'total_price'

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
      DELETE FROM quotation_item_negotiations
      WHERE lead_id = NEW.id AND quotation_id != target_quotation_id;
      
      -- Get the target quotation details
      SELECT id, quotation_number INTO quotation_record
      FROM quotations
      WHERE id = target_quotation_id;
      
      -- Create negotiation records for each quotation item
      -- FIXED: Changed 'unit_price' to 'rate' and 'total_price' to 'amount'
      FOR item_record IN
        SELECT qi.id, qi.product_id, qi.description, qi.quantity, qi.rate, qi.amount, p.name as product_name
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
          item_record.rate,
          CASE WHEN NEW.status = 'won' THEN item_record.rate ELSE NULL END,
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