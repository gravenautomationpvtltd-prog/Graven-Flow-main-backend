# Fix products that can't be saved: merge the duplicate entries

## What is actually wrong

6,572 products in the catalogue were saved without a model number — only a name. When the BIE team opens one of these for editing, the form fills the model number from the name. For 5,504 of them that exact code already belongs to another product, so the save is rejected and you see "duplicate key value violates unique constraint".

So it isn't an access problem: those products are simply the same item stored twice, once properly and once name-only.

## What will be done

1. **Merge the duplicates (one-off clean-up).** Where a name-only product matches an existing product's model number, the two become one record:
   - the properly coded product is kept;
   - any detail it is missing (description, HSN, unit, prices, list price, discounts, weight and dimensions, lead time, category, supplier) is copied across from the duplicate;
   - every linked record — quotations, enquiries, orders, invoices, dispatches, inventory, stock movements, purchase orders and bills, RFQs, price history and BIE product assignments — is repointed to the kept product;
   - the duplicate is then removed.
   Expected result: about 5,504 products removed, catalogue drops from 28,445 to roughly 22,900.

2. **Give the remaining ~1,068 name-only products their model number**, taken from the name, so they stop being half-filled.

3. **Stop it happening again.**
   - Saving a product that would collide now shows a plain message naming the other product, with a link to open it, instead of the raw database error.
   - The edit form no longer silently changes a product's model number when the user hasn't touched it.
   - Adding a product warns before saving if the code already exists.

## Before the clean-up runs

A backup copy of every merged row (and the mapping of old to kept product) is stored in an archive table, so the merge is reversible if a wrong pair ever shows up.

## Technical notes

- New table `product_merge_log` (old_id, kept_id, old_row JSONB, merged_at, merged_by) with RLS + GRANTs, so merges are auditable and reversible.
- Merge SQL runs as a data operation, matched on `tenant_id` + `upper(btrim(name))` = `upper(btrim(model_number))`, only where the duplicate has a NULL/blank `model_number`. Ties (several blanks matching one code) collapse into the same kept product.
- Repoint all 18 FK columns referencing `products` (boq_items, dispatch_items, enquiry_items.matched_product_id, grn_items, import_invoice_items, inventory, invoice_items, pricing_alerts, product_assignments, product_price_history, product_price_versions, purchase_bill_items, purchase_order_items, quotation_item_negotiations, quotation_items, rfq_items, stock_movements, supplier_quotation_items) before deleting, with dedupe on `inventory` (unique product/office) and `product_assignments`.
- Backfill `model_number = upper(btrim(name))` and refresh `search_key` for the remaining blanks; skip any that would still collide.
- `src/hooks/useProducts.ts`: keep the exact-match pre-check, but surface the clashing product's id so the dialog can link to it; ensure `friendlyProductError` wraps every 23505 path.
- `src/components/settings/ProductDialog.tsx`: when a product already has a model number, send it untouched; show the clash as an inline field error with "Open the existing product".

## Verification

- Row counts before/after, zero orphan FK rows, `product_merge_log` row count equals products removed.
- Live check: open several previously failing products (including ones from the screenshot's catalogue page) and save — must succeed.
- Typecheck and build clean.
