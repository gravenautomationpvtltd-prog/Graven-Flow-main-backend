# Fix and complete the Procurement price-request system

## What is broken today (verified)

- The Price Requests screen loads **every** request at once with 5 nested joins (lead, customer, enquiry item, two profiles, supplier). With 5,396 pending rows the backend cancels it: `500 / statement timeout`. The screen then silently renders "No pending price requests" while the header card (a light count query) correctly shows 5396. Nothing is actually missing from the database.
- Resolutions **do** save (152 of 197 resolved requests carry a price), but they are invisible because the same broken query feeds the list and every KPI on the tab.
- A request can only hold **one** price. There is no purchase-vs-sale split, no history of multiple quotes, no record of which price was pushed to sales, and no loop back when sales comes with a target price.
- Assignment exists as a column but there is no UI to own, reassign, or see "my queue".

## What we will build

### 1. Make the queue actually load
- Paginated, server-side queue: 50 rows per page, search/status/priority/assignee/age filters applied in the database, not in the browser.
- Slim the row query (drop deep nesting; fetch names in a second lightweight lookup).
- KPI cards move to count-only queries so they never depend on the big list.
- Show a real error state instead of "Great job!" when a query fails.
- Add the missing indexes the new filters need.

### 2. Assignment & ownership
- Assign / reassign a request to a procurement member; bulk assign selected rows.
- "My queue" vs "All requests" toggle, with per-member open/overdue counts.
- Every assignment change recorded with who and when.

### 3. Multiple prices per request, with purchase and sale price
- New quote lines under each price request: supplier, purchase price, proposed sale price, currency, validity, lead time, notes, attachments.
- Procurement can record several quotes for the same item and mark **one** as the price pushed to sales.
- The pushed price flows to the enquiry item / quotation and the product catalog exactly as today, plus a visible history of every price ever pushed.

### 4. Target-price negotiation loop
- When sales (SPT) responds with a target price, the request re-opens as a **revision round** and routes back to the *same* procurement person who gave the price — not to round-robin.
- That person can submit a revised price or decline; this can repeat any number of rounds, each round stored with who, when, target asked, price offered, outcome.
- Full round-by-round timeline on the request.

### 5. Matched-price tracking
- Automatic flag when a pushed price meets or beats the target.
- Dedicated **"Target matched"** filter/tab so procurement and management can chase sales for the outcome (quoted / won / lost / no response) on matched items.
- Status of each matched item is recorded back on the request, closing the loop end to end.

### 6. Backlog
- Nothing deleted. The 5,396 pending requests stay and become workable through paging, filters, age sorting and bulk assign.

## Technical notes

- New tables: `price_request_quotes` (multi-price per request, purchase + sale, is_pushed flag) and `price_request_rounds` (target asked, responder, revised price, outcome). Both tenant-scoped with RLS and GRANTs; procurement + sales roles read, procurement writes quotes, sales writes target rounds.
- New columns on `price_requests`: `current_round`, `target_matched_at`, `sales_outcome`, `last_priced_by` (used to route revisions back to the same person).
- Frontend: rewrite `usePriceRequests` into a paged/filtered hook (`.range()`, server-side `ilike`, `.returns<T>()` typing), split `PriceRequestsTab` into queue + filters + row, extend `ResolvePriceDialog` into a quote-entry panel supporting multiple quotes and push-to-sales, add an assignment popover and a request detail sheet with the round timeline.
- Indexes on `(tenant_id, status, requested_at)`, `(assigned_to, status)`, `target_matched_at`.

## Verification

- Price Requests tab loads under 2s with the full 5,396-row backlog, KPIs match the header count.
- Record two quotes on one request, push one, confirm it lands on the quotation and product, and that the other stays in history.
- Send a target price from sales, confirm it returns to the same procurement user, submit a revised price, confirm round 2 is logged.
- Confirm a matched item appears under the "Target matched" filter and its sales outcome can be recorded.
