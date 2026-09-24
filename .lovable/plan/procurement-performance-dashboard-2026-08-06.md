# Procurement Performance Dashboard

One dashboard with three lenses on the same data: **Executive** (CEO/COO), **Head** (procurement head), **Executive member** (individual buyer). Everyone sees the same definitions, only the scope and depth change.

## Current data reality (checked)

- 5,667 price requests: 5,411 pending, 197 resolved, 59 no-price. 1,111 are in escalated/critical TAT.
- 0 rows in `price_request_quotes` / `price_request_rounds` (new capture flow, will fill going forward) and 0 target-matched requests.
- 102 purchase orders, 41 GRNs, 6,679 enquiry items, 4,947 quotations, 3,727 escalation logs.
- No procurement targets defined yet.

So the dashboard must lead with the funnel + backlog + TAT metrics (rich data today) and let quote-level metrics grow in as the new capture flow is used.

## Metric catalogue

### 1. Demand and throughput (the core funnel)
- Enquiry items received (from sales)
- Price requests raised
- Requests assigned / still unassigned with the head
- Prices given (resolved)
- No-price / regret count and rate
- Backlog open at end of period, and ageing buckets (0-1d, 1-3d, 3-7d, 7d+)
- Coverage rate = prices given ÷ requests raised
- Net change: raised vs closed in the period (are we digging out or falling behind?)

### 2. Speed
- Average and median first-response time (raised to first price)
- Average and median resolution time
- TAT compliance % (resolved inside deadline)
- Requests breaching TAT, escalated, critical — with count by level
- Oldest open request age

### 3. Commercial quality
- Target-price match rate (requests where price met the sales target)
- Average gap vs target rate %
- Average gap vs lowest quote received %
- Multi-quote discipline: % of items with 2+ supplier quotes captured
- Negotiation impact: first-round price vs final price, saving % and absolute saving
- Price pushed-to-sales count

### 4. Business outcome (procurement's contribution to revenue)
- Quotations enabled by procurement prices
- Won / lost outcome on those quotations, win rate
- Order value linked to procurement-priced items
- Lost-for-price count (where the sales outcome flagged price as the reason)

### 5. Supplier side
- Active suppliers quoted, new suppliers onboarded
- Supplier response rate and average response time
- Best-price share per supplier (who wins most)
- PO count, PO value, average PO value
- On-time delivery % and GRN quality / short-supply count
- Supplier concentration (top 5 supplier share of spend)

### 6. People and workload (head + executive views)
- Per-member: assigned, resolved, no-price, avg resolution time, TAT compliance, quotes captured, POs raised, PO value
- Distribution fairness: open load per member
- Target vs actual per member (uses `procurement_targets`, currently empty — dashboard prompts the head to set them)
- Idle/unlogged: assigned items with no activity in 48h

### 7. Alerts strip (top of dashboard)
- Unassigned requests waiting with the head
- Breached / critical TAT items
- Requests older than 7 days
- Items with only one supplier quote sitting above target
- Members over capacity

## Layout by role

```text
Executive (CEO/COO)      Head                        Member
-----------------------  --------------------------  ---------------------
Funnel + coverage        Same funnel, team scope     My queue + my funnel
TAT + escalations        Per-member leaderboard      My TAT + breaches
Savings + win rate       Assignment/workload split   My savings + matches
Spend + supplier mix     Supplier response board     My suppliers
Trend vs last period     Target vs actual            My target vs actual
Drilldown to member      Drilldown to request        Drilldown to request
```

Every tile is clickable and drills into the filtered request list, so numbers are never dead ends.

## Build steps

1. **Metrics layer** — a single set of Postgres functions returning period-scoped aggregates: funnel/throughput, speed/TAT, quality/savings, outcome, supplier, per-member. Date range + optional member/branch filter as parameters, so the three views share one source of truth.
2. **Hooks** — `useProcurementScorecard` (headline KPIs), `useProcurementFunnel`, `useProcurementTat`, `useProcurementTeamBoard`, reusing the existing quote analytics hooks for the price-gap charts.
3. **Dashboard page** — `/procurement/performance` with a period picker (this month, last month, quarter, custom), a role-aware default scope (member sees self, head sees team, CEO/COO sees everything), the alerts strip, KPI tiles with period-over-period deltas, funnel chart, TAT distribution, savings trend, team table, supplier board.
4. **Drilldowns** — tile clicks open the existing price request queue pre-filtered; member rows open the existing member detail sheet.
5. **Targets** — extend the existing targets dialog so the head can set monthly targets per member for the new metrics (resolutions, TAT %, savings %, match rate), then show target vs actual everywhere.
6. **Export** — CSV export of the team board and the raw metric rows for the period.

## Technical notes

- Aggregates run in SQL, not in the browser — the request table is already at 5.6k rows and growing, so client-side rollups would time out like the old queue did.
- Reuses existing tables: `price_requests`, `price_request_quotes`, `price_request_rounds`, `escalation_logs`, `enquiry_items`, `quotations`, `purchase_orders`, `goods_receipt_notes`, `suppliers`, `procurement_targets`.
- Customer names stay masked for procurement roles, per the existing privacy rule.
- Quote-derived metrics (multi-quote %, gap vs lowest, negotiation savings) will show "no data yet" states until the new quote capture flow accumulates rows.
