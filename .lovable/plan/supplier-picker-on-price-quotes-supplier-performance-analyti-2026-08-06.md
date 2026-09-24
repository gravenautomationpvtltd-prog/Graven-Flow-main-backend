# Supplier picker on price quotes + supplier performance analytics

Today the Supplier field in "Fill prices" and in the supplier-quote form is a plain free-text box. Nothing links a quote to an actual supplier record, so quotes can't be traced, compared or reported on. The `price_request_quotes` table already has an unused `supplier_id` column (0 of the existing quotes use it, and there are 57 suppliers on record).

## 1. Searchable supplier picker

Replace both free-text Supplier inputs with one shared picker:

```text
Supplier
[ Search suppliers...                        v ]
  Siemens India Pvt Ltd        Delhi · approved
  Fuji Electric Trading        Mumbai
  ------------------------------------------
  + Add "Schneider Traders" as a new supplier
```

- Type-to-search over active/approved suppliers (name, city, category).
- Picking one stores both `supplier_id` and the name snapshot.
- If the supplier isn't on record, "Add ... as a new supplier" creates a minimal supplier record (name + category, status pending) right there and links it — so nothing is lost and the vendor team can complete onboarding later.
- Free typing without selecting still works: the name is saved as before, flagged as unlinked.

Used in: the per-item quick fill row in Fill prices, and the "Add a supplier quote" form in the compare panel.

## 2. Tracking thread per quote

Each captured quote gets a lightweight trail so decisions are auditable:

- Who captured it, when, which round, and whether it was pushed to sales (and by whom / when) — shown as a small history line under each quote in the compare panel.
- Every push/re-push writes an activity log entry against the price request and the supplier, so a supplier's page shows "quoted 42 times, won 11".

## 3. Supplier price analytics

New **Supplier price performance** section (Procurement → Analytics tab), driven by linked quotes:

- Per supplier: quotes given, times pushed to sales, win rate, average lead time, average deviation from the lowest quote on the same item, share of quotes that met the sales target.
- Cheapest-supplier leaderboard and a repeat-item price trend (same product text/brand priced over time).
- On the existing supplier detail page: a "Quotes & pricing" card with the same numbers scoped to that vendor.
- Filters by date range, brand, and procurement owner; CSV export.

## Technical notes

**Database (one migration)**
- Backfill nothing; `price_request_quotes.supplier_id` starts being written from now on. Add index on `(supplier_id, created_at)` and `(price_request_id, round)`.
- Add `quoted_by`/`quoted_at` if absent (created_by/created_at already cover this — verify and reuse).
- Add a security-definer reporting function `get_supplier_quote_stats(from_date, to_date)` returning per-supplier aggregates, restricted to procurement/management roles (the quotes table is procurement-only by policy).

**Frontend**
- New `src/components/procurement/SupplierPicker.tsx` (Command + Popover combobox, `useActiveSuppliers`, inline create via `useSuppliers` create mutation).
- `src/components/procurement/QuoteComparePanel.tsx` and `src/components/procurement/PriceResolveSheet.tsx` — swap the Supplier `Input` for `SupplierPicker`; drafts carry `supplierId`.
- `src/hooks/usePriceResolveSheet.ts` and `src/hooks/usePriceRequestQuotes.ts` — persist `supplier_id`; log activity on push.
- New `src/hooks/useSupplierQuoteAnalytics.ts` + `src/components/procurement/SupplierPriceAnalytics.tsx`, mounted in the procurement analytics tab and on `src/pages/SupplierDetail.tsx`.
