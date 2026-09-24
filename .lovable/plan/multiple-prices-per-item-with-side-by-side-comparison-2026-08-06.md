# Multiple prices per item, with side-by-side comparison

Today the "Fill prices" sheet gives one price box per item, and extra supplier quotes only exist behind the "Compare quotes" panel one at a time. The goal: procurement can enter as many prices per item as they have, right where they are working, and compare selected ones side by side. No blocking — one price is still fine.

## 1. Add more prices inline, per item

In each item card of the Fill prices sheet:

```text
Sr 1 · 6GK5208-0BA00-2AB2 (Siemens)              Qty 1 · Target —
------------------------------------------------------------------
Price 1  [Supplier v] [Price ₹] [Valid until] [Lead d] [Notes]  [x]
Price 2  [Supplier v] [Price ₹] [Valid until] [Lead d] [Notes]  [x]
                                          [+ Add another price]
```

- A "+ Add another price" button appends a new price row for that item; each row can be removed with the x.
- Row 1 behaves exactly as today, so a single-price flow is unchanged.
- Saving stores every filled row as a supplier quote for that item. The row marked as chosen (defaults to the lowest price) is the one pushed to sales — the rest stay internal to procurement, exactly like the compare panel quotes.
- Each row shows a small "Lowest" marker so the cheapest is obvious.

## 2. Compare selected quotes

In the "Compare quotes" panel for an item:

- Each quote line gets a checkbox. Selecting 2 or more reveals a **Compare selected** view: a side-by-side table of supplier, price, difference vs the lowest, difference vs the sales target, validity, lead time, MOQ, notes.
- The comparison highlights the best price, the fastest lead time, and the longest validity.
- Push to sales stays a single click from the comparison view or the list.
- A "+ Add quote" button collapses/expands the add form so the panel stays compact when reading quotes.

## 3. Visibility rules unchanged

Sales/SPT still only ever see the single pushed price with its validity badge. All the alternate prices stay procurement-only.

## Technical notes

No database change needed — `price_request_quotes` already supports many rows per price request, with `supplier_id`, `valid_until`, `lead_time_days`, `moq`, `notes` and the `is_pushed` flag.

- `src/components/procurement/PriceResolveSheet.tsx` — draft state becomes an array of price rows per request id; add/remove row controls; "chosen" row selection.
- `src/hooks/usePriceResolveSheet.ts` — `ResolveEntry` gains an `alternates` list; the mutation inserts every filled row into `price_request_quotes` (only the chosen one with `is_pushed = true`) and keeps the existing price_request / enquiry_item update for the chosen price.
- `src/components/procurement/QuoteComparePanel.tsx` — per-quote selection checkboxes, new compare table, collapsible add-quote form.
- New `src/components/procurement/QuoteCompareTable.tsx` for the side-by-side view.
