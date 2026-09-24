-- Phase 1: Auto-populate quotation_item_negotiations when leads change status
-- This trigger creates negotiation records from quotation items when a lead is won/lost

CREATE OR REPLACE FUNCTION public.auto_create_negotiations_on_lead_status()
RETURNS TRIGGER AS $$
DECLARE
  quotation_record RECORD;
  item_record RECORD;
BEGIN
  -- Only trigger when status changes to 'won' or 'lost'
  IF (NEW.status IN ('won', 'lost') AND OLD.status NOT IN ('won', 'lost')) THEN
    -- Find quotations for this lead
    FOR quotation_record IN 
      SELECT q.id, q.quotation_number 
      FROM quotations q 
      WHERE q.lead_id = NEW.id
    LOOP
      -- Create negotiation records for each quotation item
      FOR item_record IN
        SELECT qi.id, qi.product_id, qi.description, qi.quantity, qi.unit_price, qi.total_price, p.name as product_name
        FROM quotation_items qi
        LEFT JOIN products p ON p.id = qi.product_id
        WHERE qi.quotation_id = quotation_record.id
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
          quotation_record.id,
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
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create the trigger
DROP TRIGGER IF EXISTS trigger_auto_create_negotiations ON leads;
CREATE TRIGGER trigger_auto_create_negotiations
  AFTER UPDATE ON leads
  FOR EACH ROW
  EXECUTE FUNCTION auto_create_negotiations_on_lead_status();