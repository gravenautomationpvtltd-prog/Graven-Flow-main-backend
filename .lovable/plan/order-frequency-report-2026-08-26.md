# Order Frequency Report

Add a new "Order Frequency" tab in the Reports Hub showing how often each customer orders, so repeat buyers and slipping customers are visible at a glance.

## What you get

A table of customers with at least one order, showing:

- Customer (company name) + owner (assigned salesperson)
- Total orders and total order value
- First order date, last order date
- Avg gap between orders (days) — same formula already used on the customer detail page: span between first and last order divided by (orders - 1)
- Days since last order
- Expected next order date (last order + avg gap)
- Status badge: On track / Due now / Overdue (past expected date by more than 25% of the avg gap) / Single order (no frequency yet)

Controls:

- Uses the existing page date filter for the orders considered
- Sort by avg gap, days since last order, order count, or value
- Search by customer name, and a filter for Repeat customers only / Overdue only
- Summary cards on top: repeat customers, average order gap across customers, customers overdue
- CSV export of the table

Clicking a row opens that customer's detail page.

## Technical notes

- New hook `src/hooks/useOrderFrequencyReport.ts`: paginated fetch (1000-row chunks) of `sales_orders` (`customer_id, order_value, created_at, status`, `deleted_at is null`) joined to `customers(company_name, assigned_sales_id)` plus owner name, grouped client-side per customer. Cancelled orders excluded, consistent with existing order analytics status filters.
- New component `src/components/reports/OrderFrequencyTab.tsx` — table + summary cards, receives `dateRange`, reuses existing card/table/badge components and semantic tokens.
- `src/pages/Reports.tsx`: add the tab trigger and content; no changes to existing tabs.
- INR values rounded with `Math.round`; RLS/branch scoping applies automatically, so each user only sees their permitted customers.
