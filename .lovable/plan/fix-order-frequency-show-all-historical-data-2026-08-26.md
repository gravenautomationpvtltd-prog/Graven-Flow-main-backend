# Fix Order Frequency: show all historical data

The Order Frequency tab shows zeros because its query is broken and over-filtered.

## What's wrong

- The query filters `sales_orders` on a `deleted_at` column that does not exist on that table, so the request fails and the tab renders empty.
- It also applies the page's "This Month" date filter, which would only ever consider 35 of the 296 orders — order cadence needs the full history (data runs from Dec 2025 to today, 296 orders across 178 customers).

## What changes

- Remove the non-existent `deleted_at` filter from the order-frequency query.
- Compute frequency over the customer's full order history by default, ignoring the page date filter, so avg gap / expected next order / overdue are meaningful.
- Add a period selector inside the tab: "All time" (default) and "Last 12 months", so the tab controls its own window instead of inheriting the header filter.
- Keep everything else as-is: cancelled orders excluded, summary cards, search/sort/filters, CSV export, row click to customer detail.

## Technical notes

- `src/hooks/useOrderFrequencyReport.ts`: drop `.is('deleted_at', null)`; accept an optional `sinceDate` instead of from/to; keep 1000-row paginated fetch and client-side grouping.
- `src/components/reports/OrderFrequencyTab.tsx`: add the period Select, stop consuming `dateRange` for the query, add an empty-state hint when no orders exist at all.
- `src/pages/Reports.tsx`: no longer needs to pass the date range to this tab.
