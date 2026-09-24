
CREATE OR REPLACE FUNCTION public.auto_create_cct_decision_on_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item record;
  v_inserted int := 0;
BEGIN
  -- Per-line decisions from the linked quotation
  IF NEW.quotation_id IS NOT NULL THEN
    FOR v_item IN
      SELECT qi.id, qi.description, qi.quantity, qi.amount, qi.enquiry_item_id,
             COALESCE(ei.brand, NULL) AS brand
      FROM quotation_items qi
      LEFT JOIN enquiry_items ei ON ei.id = qi.enquiry_item_id
      WHERE qi.quotation_id = NEW.quotation_id
      ORDER BY qi.sort_order, qi.created_at
    LOOP
      INSERT INTO cct_sourcing_decisions (
        tenant_id, sales_order_id, order_item_id, lead_id,
        product_description, brand, quantity, selling_price, status
      )
      SELECT NEW.tenant_id, NEW.id, v_item.id, NEW.lead_id,
             v_item.description, v_item.brand, v_item.quantity, v_item.amount, 'pending'
      WHERE NOT EXISTS (
        SELECT 1 FROM cct_sourcing_decisions
        WHERE sales_order_id = NEW.id AND order_item_id = v_item.id
      );
      v_inserted := v_inserted + 1;
    END LOOP;
  END IF;

  -- Fallback: no quotation/items → keep legacy single-row behaviour
  IF v_inserted = 0 THEN
    INSERT INTO cct_sourcing_decisions (
      tenant_id, sales_order_id, lead_id, selling_price, status
    )
    SELECT NEW.tenant_id, NEW.id, NEW.lead_id, NEW.order_value, 'pending'
    WHERE NOT EXISTS (
      SELECT 1 FROM cct_sourcing_decisions
      WHERE sales_order_id = NEW.id AND order_item_id IS NULL
    );
  END IF;

  RETURN NEW;
END;
$$;

-- Backfill existing empty decisions: populate from first quotation item, then add rows for the rest
DO $$
DECLARE
  d record;
  qi record;
  is_first boolean;
BEGIN
  FOR d IN
    SELECT cd.id AS decision_id, cd.sales_order_id, cd.tenant_id, cd.lead_id,
           so.quotation_id
    FROM cct_sourcing_decisions cd
    JOIN sales_orders so ON so.id = cd.sales_order_id
    WHERE cd.product_description IS NULL
      AND cd.order_item_id IS NULL
      AND so.quotation_id IS NOT NULL
      AND cd.status = 'pending'
  LOOP
    is_first := true;
    FOR qi IN
      SELECT q.id, q.description, q.quantity, q.amount, q.enquiry_item_id,
             COALESCE(ei.brand, NULL) AS brand
      FROM quotation_items q
      LEFT JOIN enquiry_items ei ON ei.id = q.enquiry_item_id
      WHERE q.quotation_id = d.quotation_id
      ORDER BY q.sort_order, q.created_at
    LOOP
      IF is_first THEN
        UPDATE cct_sourcing_decisions
        SET product_description = qi.description,
            brand = qi.brand,
            quantity = qi.quantity,
            selling_price = qi.amount,
            order_item_id = qi.id,
            updated_at = now()
        WHERE id = d.decision_id;
        is_first := false;
      ELSE
        INSERT INTO cct_sourcing_decisions (
          tenant_id, sales_order_id, order_item_id, lead_id,
          product_description, brand, quantity, selling_price, status
        )
        SELECT d.tenant_id, d.sales_order_id, qi.id, d.lead_id,
               qi.description, qi.brand, qi.quantity, qi.amount, 'pending'
        WHERE NOT EXISTS (
          SELECT 1 FROM cct_sourcing_decisions
          WHERE sales_order_id = d.sales_order_id AND order_item_id = qi.id
        );
      END IF;
    END LOOP;
  END LOOP;
END $$;
