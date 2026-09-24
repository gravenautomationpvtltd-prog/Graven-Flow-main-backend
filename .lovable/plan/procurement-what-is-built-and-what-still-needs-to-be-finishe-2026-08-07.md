# Procurement: what is built and what still needs to be finished

## Verified current state

- **Schema is ready**: `price_requests`, `price_request_quotes`, `price_request_rounds`, `performance_benchmarks`, `procurement_targets` all exist with the columns the new flows need.
- **Head-first routing is live in the DB**: `auto_assign_enquiry_item_brand_owner` now sends every new request to the procurement head (`get_procurement_head`) and sets `routed_via = 'head'`.
- **New paginated queue hook exists**: `src/hooks/usePriceRequestQueue.ts` uses server-side pagination, search, status/assignee/priority filters and lightweight hydration.
- **Multi-quote capture exists**: `PriceResolveSheet.tsx` + `QuoteComparePanel.tsx` let procurement enter several supplier quotes per item and push one to sales.
- **Supplier picker exists**: `SupplierPicker.tsx` links quotes to real suppliers or creates pending ones.
- **Privacy gating exists**: `src/lib/procurement-privacy.ts` hides customer names from procurement-only roles.
- **Performance dashboard exists**: `/procurement/performance` with scorecard, funnel, ageing, TAT, team board, benchmarks and variance.
- **Price-gap analytics exist**: `PriceGapTrends.tsx` with drill-down sheet and CSV export.
- **Supplier analytics exist**: `SupplierPriceAnalytics.tsx` and `useSupplierQuoteAnalytics.ts`.
- **Bulk import/approval exists**: `/procurement/bulk-prices` and `/procurement/price-approvals` for the China employee workflow.

## Verified gaps that are still broken or unfinished

1. **The main procurement queue page still uses the old, broken fetch**
   - `src/pages/procurement/ProcurementQueue.tsx` calls `useProcurementQueue`, which does `supabase.from('price_requests').select(...nested joins...).limit(500)`.
   - With 5,421 pending rows this still times out (statement timeout / 504), so users see empty or stale lists.
   - The new `usePriceRequestQueue.ts` is not wired into the main workspace yet.

2. **The old `usePriceRequests.ts` hook is still used elsewhere**
   - It fetches every row with 5 nested joins (`lead`, `customer`, `enquiry_item`, two `profiles`, `supplier`).
   - Any page/dialog still importing it will hit the same timeout.

3. **No price request detail / revision-round UI exists**
   - `price_request_rounds` has 0 rows.
   - A search for `PriceRequestDetailSheet`, `price_request_rounds`, `sales_outcome`, `target_matched` in `src/` returns no files.
   - Sales cannot yet respond with a target price that re-opens a request as a revision round.
   - Procurement cannot see a round-by-round timeline.

4. **Target-matched workflow is not wired**
   - `target_matched_at` is null on all 5,719 requests.
   - The "matched" filter exists in `usePriceRequestQueue.ts`, but there is no UI to record the sales outcome (quoted / won / lost / no response) on matched items.

5. **No data has flowed through the new quote model yet**
   - `price_request_quotes` has 0 rows.
   - All 197 resolved requests were resolved the old way (single `resolved_price` on `price_requests`), so supplier analytics, gap trends and multi-quote history have nothing to display.

6. **Assignment UI is incomplete for the head**
   - Bulk assign exists in `useAssignPriceRequests`, but the main queue page does not expose a search/filter bar, an "Unassigned / with me" quick filter, or bulk selection for the head.
   - The "My queue" vs "All requests" toggle from the approved plan is not on the main page.

7. **Two competing queue pages**
   - `/procurement` (Procurement.tsx) and `/procurement/queue` (ProcurementQueue.tsx) appear to be separate; the new paginated design needs to become the single queue.

## What we will build to finish procurement

### Phase 1: Make the main queue load and usable
- Replace `ProcurementQueue.tsx` with the new paginated/filtered design from `usePriceRequestQueue.ts`.
- Add filters: status, priority, assignee (with "me" / "unassigned" / "all" / member), search, age sort.
- Add bulk selection + bulk assign for the procurement head.
- Show model number + brand + quantity per row; hide customer name for procurement-only roles.
- Add real error and empty states.
- Audit and replace remaining usages of `usePriceRequests.ts` with the paginated hook or count-only variants.

### Phase 2: Finish the request detail and revision loop
- Build `PriceRequestDetailSheet.tsx`:
  - Item details (model, brand, qty, target).
  - Quote history from `price_request_quotes`.
  - Round-by-round timeline from `price_request_rounds`.
  - Assignment log.
- Build the sales-side "Request revision" action:
  - Sales enters a target price.
  - This creates a `price_request_rounds` row with `outcome = 'pending'`.
  - Request status returns to `in_progress`, `current_round` increments, and it routes back to `last_priced_by` (or head if none).
- Build the procurement-side revision response:
  - See the target price and previous quotes.
  - Submit a revised price or decline.
  - Record the response on the round.

### Phase 3: Target-matched and sales outcome loop
- When a pushed price meets or beats the target, set `target_matched_at`.
- Add a "Target matched" tab/filter to the queue.
- Add a sales-outcome picker on matched items (`quoted`, `won`, `lost`, `no_response`) with a lost-reason field.
- Reflect matched/outcome counts in the performance dashboard.

### Phase 4: Migrate existing resolved requests into the new quote model
- Backfill `price_request_quotes` rows from the 197 resolved requests using their `resolved_price`, `supplier_id`, `resolved_by`, `resolved_at`.
- Mark those rows as `is_pushed = true`.
- This unlocks supplier analytics and gap trends immediately instead of waiting for new flow adoption.

### Phase 5: Polish and reconcile
- Remove or redirect the old `/procurement` landing so `/procurement/queue` is the single workspace.
- Update realtime subscription to invalidate the new queue query keys.
- Add the head-first routing verification and a setting to change the procurement head.
- Add notifications on assignment and when a revision round arrives.

## Verification

- `/procurement/queue` loads in under 2s with all 5,421 pending rows.
- Filters (status, priority, assignee, search) return results without timeout.
- Recording two quotes on one request and pushing one updates the enquiry item and keeps the other in history.
- A sales revision request creates a round and routes back to the same procurement user.
- A matched target appears in the "Target matched" filter and its outcome can be recorded.
- The performance dashboard shows non-zero quote/supplier analytics after the resolved-request backfill.
