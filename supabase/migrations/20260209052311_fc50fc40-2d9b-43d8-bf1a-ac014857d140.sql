CREATE OR REPLACE FUNCTION public.delete_sales_order_cascade(p_order_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_po_ids uuid[];
  v_grn_ids uuid[];
  v_invoice_ids uuid[];
  v_dispatch_ids uuid[];
BEGIN
  -- Verify caller is admin
  IF NOT is_admin_or_above(auth.uid()) THEN
    RAISE EXCEPTION 'Access denied: only admins can delete sales orders';
  END IF;

  -- 1. Get linked PO IDs
  SELECT array_agg(id) INTO v_po_ids
  FROM purchase_orders WHERE sales_order_id = p_order_id;

  -- 2. Delete PO related data
  IF v_po_ids IS NOT NULL THEN
    -- Get GRN IDs for these POs
    SELECT array_agg(id) INTO v_grn_ids
    FROM goods_receipt_notes WHERE po_id = ANY(v_po_ids);
    
    -- Delete GRN items
    IF v_grn_ids IS NOT NULL THEN
      DELETE FROM grn_items WHERE grn_id = ANY(v_grn_ids);
    END IF;
    
    -- Delete PO related records
    DELETE FROM email_logs WHERE po_id = ANY(v_po_ids);
    DELETE FROM supplier_ratings WHERE po_id = ANY(v_po_ids);
    DELETE FROM supplier_payments WHERE po_id = ANY(v_po_ids);
    DELETE FROM goods_receipt_notes WHERE po_id = ANY(v_po_ids);
    DELETE FROM purchase_order_items WHERE po_id = ANY(v_po_ids);
    DELETE FROM purchase_orders WHERE id = ANY(v_po_ids);
  END IF;

  -- 3. Get and delete invoice items
  SELECT array_agg(id) INTO v_invoice_ids
  FROM invoices WHERE sales_order_id = p_order_id;
  
  IF v_invoice_ids IS NOT NULL THEN
    DELETE FROM invoice_items WHERE invoice_id = ANY(v_invoice_ids);
  END IF;

  -- 4. Get and delete dispatch items/documents
  SELECT array_agg(id) INTO v_dispatch_ids
  FROM dispatches WHERE sales_order_id = p_order_id;
  
  IF v_dispatch_ids IS NOT NULL THEN
    DELETE FROM dispatch_items WHERE dispatch_id = ANY(v_dispatch_ids);
    DELETE FROM dispatch_documents WHERE dispatch_id = ANY(v_dispatch_ids);
  END IF;

  -- 5. Delete direct related records
  DELETE FROM order_documents WHERE sales_order_id = p_order_id;
  DELETE FROM customer_payments WHERE sales_order_id = p_order_id;
  DELETE FROM invoices WHERE sales_order_id = p_order_id;
  DELETE FROM dispatches WHERE sales_order_id = p_order_id;

  -- 6. Unlink quotations (SECURITY DEFINER bypasses RLS)
  UPDATE quotations SET converted_to_order_id = NULL
  WHERE converted_to_order_id = p_order_id;

  -- 7. Delete the sales order
  DELETE FROM sales_orders WHERE id = p_order_id;
  
  -- Verify deletion
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Sales order not found or could not be deleted';
  END IF;
END;
$$;