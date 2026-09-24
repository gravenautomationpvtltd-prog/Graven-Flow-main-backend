# Plan: Interactive sortable columns in Order Frequency report

## Goal
Make the Order Frequency table headers clickable so users can sort by any column (highest-to-lowest and toggle direction), instead of only using the sort dropdown.

## Changes (single file: `src/components/reports/OrderFrequencyTab.tsx`)

1. **Add sort direction state**
   - Extend state: `sortDir: 'asc' | 'desc'` (default `desc`).
   - Extend `SortKey` to include `customer`, `owner`, `first_order`, `last_order`, `expected_next`, `status` so every visible column is sortable.

2. **Make column headers clickable**
   - Replace static `<TableHead>` labels with clickable headers that:
     - Set `sortKey` to that column.
     - Toggle `sortDir` when the same column is clicked again.
     - Show a sort arrow icon (`ArrowUp` / `ArrowDown` from lucide) next to the active column; inactive columns show a faint `ArrowUpDown` hint on hover.
   - Apply to all sortable columns: Customer, Owner, Orders, Total Value, First Order, Last Order, Avg Gap, Days Since, Expected Next, Status.

3. **Update the sort comparator**
   - Handle all new sort keys with correct ascending/descending logic.
   - Numeric columns (Orders, Total Value, Avg Gap, Days Since): numeric compare.
   - Date columns (First Order, Last Order, Expected Next): timestamp compare (nulls last).
   - Text columns (Customer, Owner, Status): locale-aware string compare.
   - Respect `sortDir` (multiply by -1 for asc).

4. **Keep the existing sort dropdown** as a secondary control, synced to the same `sortKey`/`sortDir` (clicking a header updates the dropdown selection and vice-versa). Add an explicit asc/desc option to the dropdown so both controls stay consistent.

## Out of scope
- No changes to the data hook (`useOrderFrequencyReport.ts`).
- No changes to summary cards, filters, export, or navigation behavior.

## Verification
- Build passes (check `/tmp/observability/build-errors.log`).
- Click each header in the preview: rows re-sort, arrow flips on re-click, dropdown reflects the active column.
