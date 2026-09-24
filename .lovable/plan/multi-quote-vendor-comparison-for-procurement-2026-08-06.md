# Multi-quote vendor comparison for procurement

Procurement often collects several supplier quotes for the same item. Today the "Fill prices" sheet takes only one price per line, and the quotes that do get stored are readable by anyone in the tenant. This plan turns each line item into a small quote basket that only procurement and management can see.

## What procurement will get

- **Multiple quotes per line item.** In the "Fill prices" sheet, each row expands into a compare panel where several supplier quotes can be added: supplier, price, lead time, MOQ, validity, notes.
- **One quote is "pushed".** Procurement marks which quote goes to sales. Only that number reaches SPT — sales never sees the others, nor how many exist.
- **Revision-friendly.** When sales asks for a better price, procurement reopens the same basket, sees all previously captured quotes (including ones never pushed), and can push a different one in one click. The previously pushed quote is unmarked automatically.
- **Quote history.** Each quote keeps who entered it and when, plus a badge for the currently pushed one and for quotes that beat the sales target.
- **Cheapest highlighted** so the best option is obvious at a glance.

## What sales will see

No change to their view: a single resolved price on the enquiry item. The comparison table, supplier names, and non-pushed quotes are hidden from sales roles both in the UI and at the database level.

## Technical notes

**Database**
- Replace the tenant-wide read policy on `price_request_quotes` with one scoped to procurement roles (`procurement`, `procurement_manager`, `import_procurement`, `cct`) plus `super_admin` / `coo` / `platform_admin`. Sales, CRO, TST, SPT lose direct read access.
- Sales continues to read the final number from `price_requests.resolved_price` and `enquiry_items.procurement_price`, which are already populated on push — so nothing breaks for them.
- Same read-scoping applied to `price_request_rounds` supplier-level notes is not needed; rounds stay visible since sales initiates them.

**Frontend**
- `src/components/procurement/PriceResolveSheet.tsx`: each row gets an expand toggle opening a `QuoteCompareRow` — list of existing quotes for that request plus an inline "add quote" form. The single-price input stays as the fast path for one-quote items (it creates a quote and pushes it in one step, current behaviour).
- New `src/components/procurement/QuoteComparePanel.tsx` renders the quote table with Push / Delete actions, cheapest and pushed badges, and target-match indicator.
- Reuse existing `usePriceQuotes`, `useAddPriceQuote`, `useDeletePriceQuote`, `usePushQuoteToSales` from `src/hooks/usePriceRequestQuotes.ts`; no new push logic needed since it already unmarks other quotes, updates the request and enquiry item, and notifies sales.
- `src/components/procurement/PriceRequestDetailSheet.tsx`: show the same compare panel so re-pushing during a revision round works from the detail view too.
- Gate every quote-comparison surface behind a `useIsProcurementOrManagement()` check added to `src/lib/procurement-privacy.ts`.
