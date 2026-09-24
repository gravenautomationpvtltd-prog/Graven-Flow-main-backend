# Drill-down for price gap trend points

Clicking any point (or month) on the Price gap trends chart opens a panel listing every supplier quote behind that month's average, with the arithmetic shown.

## What you'll see

A side sheet titled with the series name and month (e.g. "Sharma Traders — Mar 26"), containing:

- Summary line: number of quotes, average gap % (the exact value plotted), and the metric used (vs lowest quote / vs target rate).
- A table, one row per quote:
  - Date
  - Item (masked customer info stays masked, same privacy rules as elsewhere in procurement)
  - Supplier
  - Quoted price
  - Lowest quote for that request
  - Target rate
  - Gap % (highlighted; the number that feeds the average)
  - Pushed to sales badge
- A footer showing the calculation: `average = (g1 + g2 + …) / n`, with the individual gap values listed, so the plotted point is fully traceable.
- "Export these rows" CSV button, plus a link to open the underlying price request.

Rows with no target rate are shown greyed and excluded from the average when the "vs target" metric is selected — stated explicitly in the footer.

## Technical notes

- No backend or schema change; the drill-down reuses the quotes already loaded by `usePriceGapTrends`.
- Add an optional `onPointClick(period, seriesLabel)` path in `PriceGapTrends.tsx` via Recharts `onClick` on `LineChart` (gives activeLabel) and `Line` dots (gives the series). Clicking the X-axis area with a single selected series falls back to that series; with multiple series, clicking a dot picks the exact series.
- New component `src/components/procurement/PriceGapDrilldown.tsx` — a `Sheet` that takes `quotes: GapQuote[]`, `period`, `seriesLabel`, `metric` and renders the table + calculation footer.
- Add a small helper in `usePriceGapTrends.ts`: `selectGapQuotes(quotes, groupBy, key, period)` that filters the same way `buildGapSeries` aggregates, so the drill-down and the chart can never disagree.
- Map series label back to group key using the existing label map so item/supplier grouping both work.
