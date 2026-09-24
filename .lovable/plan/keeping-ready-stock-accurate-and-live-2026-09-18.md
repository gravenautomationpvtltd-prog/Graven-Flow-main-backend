# Keeping Ready Stock accurate and live

## How it works today

"Ready Stock" is not a field on the product form — it is read from warehouse stock. A product shows as Ready Stock whenever its total warehouse quantity is above zero, and the selling rate is then offered 5% higher.

Stock itself is maintained in two places today:

- **Inventory page** — "Add Stock" to create a product/warehouse stock line, and "Adjust Stock" to add, remove or correct quantity (each change is recorded as a stock movement).
- **Goods receipt (GRN)** — when a purchase receipt is verified, the accepted quantity is added to warehouse stock automatically.

Two gaps: nothing removes stock when goods are dispatched, and the product screens only refresh stock when the page is reloaded (up to a minute stale). That is why a product page can show "Available quantity 0" while stock exists elsewhere.

## What changes

**1. Stock goes down automatically on dispatch**
When a dispatch is created (or marked dispatched) for items that exist in warehouse stock, the quantity is deducted from the dispatching office's stock and logged as an "out" movement referencing the dispatch. If there is not enough stock, the dispatch still goes through and the shortfall is flagged in the movement note, so records stay honest.

**2. Stock visible and editable from the product itself**
- Product page: the Warehouse stock card gets an "Adjust stock" button (same dialog as the Inventory page) and a per-warehouse breakdown, plus a link to the product's stock movement history.
- Product catalogue: the existing Stock badge stays as it is, but clicking it opens the same adjust dialog.
- The product Edit dialog stays free of a quantity box — stock is a warehouse figure, not a catalogue attribute, and editing it there would bypass the movement log.

**3. Real time**
Warehouse stock is subscribed to live, so a receipt, adjustment or dispatch anywhere in the company updates the badge, the product page and the quotation picker within a second, without a reload.

**4. Traceability**
Every change keeps its source — manual adjustment, goods receipt, or dispatch — visible in the stock movement history with who did it and when.

## Who can change stock

Adjusting stock stays with warehouse, procurement, accounts and admin roles; sales sees the figure but cannot change it.

## Technical notes

- `src/hooks/useDispatches.ts`: on dispatch create/status change, call the existing `useAdjustStock` logic per dispatch item with `movement_type: 'out'`, `reference_type: 'dispatch'`, `reference_id`, resolving the office from the dispatch. Skip products with no inventory row.
- Migration: `ALTER PUBLICATION supabase_realtime ADD TABLE public.inventory;` (and `stock_movements`).
- New `useInventoryRealtime()` hook subscribed in a top-level layout, invalidating `['inventory']`, `['ready-stock']` and `['stock-movements']` on change; channel torn down on unmount.
- `src/pages/ProductDetail.tsx`: office breakdown from `useProductStock`, plus an "Adjust stock" button reusing `StockAdjustmentDialog`; needs a small variant that accepts a product with no existing inventory row (office picker).
- `src/components/settings/ProductsManagement.tsx`: stock badge becomes a button opening the same dialog for permitted roles.
- No change to the 5% premium rule or to `src/lib/ready-stock.ts`.
