# Ready Stock: warehouse items flagged and priced with a 5% premium

Inventory (what is physically in a warehouse) and the product list (everything we deal in) become linked. Any product with stock in any warehouse is automatically shown as **Ready Stock**, and its selling price is offered 5% higher because it can be dispatched immediately.

## What changes

**Product list**
- A green "Ready Stock" badge with the available quantity next to products that have stock in any warehouse.
- A filter to show only ready-stock products.
- The badge and quantity come straight from inventory — nothing to maintain by hand.

**Quotation building**
- Product search results show the same "Ready Stock · qty" marker.
- Picking a ready-stock product fills the rate as the normal selling price plus 5%.
- A small note on the line reads: "Ready stock — 5% premium applied (base ₹X)".
- The salesperson can overwrite the rate manually at any time; the note then says the premium was removed/changed. Existing margin-floor and lifecycle warnings keep working against the base price.
- Non-stock products behave exactly as today.

**Product detail page**
- A stock line showing total available quantity and a per-warehouse breakdown, plus the ready-stock selling price (base + 5%).

## Rules

- Ready stock = total inventory quantity across all offices > 0.
- Premium = fixed 5%, applied on top of the auto-filled selling price (`sales_price`, falling back to `default_rate`).
- Premium is a suggestion at quote time only — nothing is written back to the product catalogue, and the price stored on the quotation line is whatever the salesperson finally leaves in the rate box.
- PDFs are unaffected: they print the final rate as always, with no mention of the premium.

## Technical notes

- New hook `src/hooks/useReadyStock.ts`:
  - `useReadyStockMap(productIds)` — one aggregated query on `inventory` (`product_id`, `quantity`, `office_id`) returning `Map<product_id, { qty, byOffice }>` for a set of product ids; used by the product list and the quotation search results.
  - `useProductStock(productId)` — single product, used on the product detail page.
- New `src/lib/ready-stock.ts` with `READY_STOCK_PREMIUM_PCT = 5` and `applyReadyStockPremium(base)` (rounded with the existing INR rounding rule).
- `src/components/quotations/QuotationLineItem.tsx`: extend `handleSelectProduct` to look up the ready-stock map for `searchResults`, apply the premium to `autoRate`, and store `basePrice`/`isReadyStock` in the existing `productLP` state to drive the note. Search result rows get the badge.
- `src/components/settings/ProductsManagement.tsx` (and the products page list): badge column + "Ready stock only" filter toggle, filtering client-side against the ready-stock map for the currently loaded page of products.
- `src/pages/ProductDetail.tsx`: stock section using `useProductStock`.
- No schema changes; `inventory` already holds `product_id`, `office_id`, `quantity`.
