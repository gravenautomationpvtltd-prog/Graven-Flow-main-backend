# Making QC & Receiving actually usable end to end

## What's wrong today

- **"Awaiting receipt" shows 0** even though 63 purchase orders still have material to come in (260 order lines pending). The list is being filtered incorrectly, so QC sees an empty screen and has no way in.
- **No way to receive anything that isn't on a purchase order** — walk-in material, free replacements, returns from a customer, opening stock.
- **No way to add an item that isn't in the catalogue yet** while receiving it.
- **No stock editing inside the QC area** — QC must go to Inventory to correct a figure.
- **Release is all-or-nothing per order** — QC can only release the whole order, not the quantities that are actually ready.

## What gets built

### 1. Receive material (fixed and expanded)

The receive list shows every purchase order with material still due — order number, supplier, expected date, how much is pending, and how much has already been received. Search by order number or supplier, and a filter for "overdue" deliveries. If the list can't load, the screen says so instead of pretending nothing is pending.

Each purchase order opens the receive-and-check form: per line, quantity received, quantity passed, quantity held with a reason. Saving records the goods receipt, marks it checked, updates the purchase order and moves stock, exactly as now — plus a partly received order stays on the list with its remaining balance.

### 2. Receive without a purchase order

A "Direct receipt" button on the same screen: pick the warehouse, optionally a supplier and a reference note, then add as many item lines as needed with quantity received / passed / held. This covers replacements, returns and opening stock. It goes into the stock ledger as a direct receipt, so nothing enters the warehouse untracked.

### 3. Add an item while receiving it

In both the purchase-order and direct receipt forms, the item picker has "Add new item" — model number, description and unit — which creates the catalogue product there and then and uses it on the line. No trip to the Products screen mid-delivery.

### 4. Warehouse stock tab inside QC

A fourth tab, **Warehouse stock**, listing every item that has stock, with warehouse, sellable quantity, held quantity and last movement. Search by model number, filter by warehouse, and adjust any line in place (stock in / stock out / set to, with a note). Every change writes to the ledger and shows up immediately on the product page, the catalogue Ready Stock badge and the quotation picker — no reload.

### 5. Release goods line by line, against the invoice or the quotation

The release screen changes from one button per order to a proper release note:

- Open an order awaiting release and QC sees each item from the order's invoice (or from the quotation if it isn't billed yet): item, quantity ordered, already released, available in the warehouse.
- QC enters the quantity to release per line and confirms. That quantity leaves warehouse stock at that moment, recorded as a release against the order.
- Partly released orders stay on the list with the balance still to go; fully released ones move to "Released".
- Warehouse cannot dispatch an order with nothing released, and a dispatch never deducts a quantity twice — stock now leaves on release, not on dispatch.

### 6. Receipt history

A **Receipts** tab listing goods receipts recorded by QC — number, supplier, date, passed, held, who checked it — so the trail is visible without leaving the workspace.

## Who can do what

Unchanged: QC and leadership receive, hold, adjust and release. Warehouse and procurement see the figures, sales sees Ready Stock only.

## Technical notes

- `usePendingReceipts`: replace the malformed `not in` filter with `.in('status', [...])` over open statuses, surface the query error in the UI, and return per-line remaining quantity. Verified 63 POs / 260 lines qualify.
- Direct receipts do **not** create a `goods_receipt_notes` row — `po_id` is `NOT NULL` and dropping that is a destructive change. Instead they write `inventory` + `stock_movements` with `reference_type: 'direct_receipt'` and the reference note, through a new `useDirectReceipt` hook sharing the same held/passed handling as `useReceiveMaterial`.
- New `qc_releases` + `qc_release_items` tables (tenant-scoped, GRANTs + RLS for QC/leadership read-write, tenant read) holding order_id, invoice_id/quotation_id, per-line product, quantity, office. Release deducts `inventory.quantity` and inserts a `stock_movements` row `movement_type: 'out'`, `reference_type: 'qc_release_dispatch'`. `sales_orders.qc_released_at` is stamped when every line is fully released; partial releases leave it null but record progress.
- `useDispatches.deductStockForDispatch` becomes a no-op for orders that have release records (stock already left at release); it stays for legacy dispatches with no release.
- Release line source: `invoice_items` for the order's invoice, falling back to `quotation_items` via `sales_orders.quotation_id` (there is no sales-order items table).
- Quick-add product reuses the existing product insert path with `model_number` required and name mirrored, honouring the exact-duplicate check.
- Warehouse stock tab reuses `useInventory` + `ProductStockDialog`; realtime invalidation of `['inventory']`, `['ready-stock']`, `['stock-movements']`, `['stock-ledger']` is already in place.
