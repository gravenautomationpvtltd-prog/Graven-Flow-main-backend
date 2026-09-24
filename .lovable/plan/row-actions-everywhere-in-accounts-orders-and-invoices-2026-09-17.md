# Row actions everywhere in Accounts, Orders and Invoices

Every list in the Accounts section, plus orders and invoices, gets a consistent actions column at the end of each row: View, Edit and Delete. Deleting always asks for confirmation and shows the record details before it removes anything.

## What you will see

An "Actions" column on the right of each table with a small menu per row:

- **Purchase Bills** — edit the bill (reopens the bill form with everything filled in), delete it.
- **Expenses** — edit amount, category, date, vendor; delete.
- **Assets** — edit the asset; delete.
- **Payments** (customer receipts and supplier payments) — edit amount/date/mode/reference; delete. Deleting a receipt restores the customer's outstanding balance.
- **Finance Orders** — open the order, edit order details, delete (leadership only, as today).
- **Invoices** — already has View / PDF / Email / Record Payment; Edit is added alongside Delete.
- **Receivables, Payables, Customers, Books, GST Filing** — these are calculated summaries, not records. Instead of edit/delete, each row gets a "View" action that opens the underlying customer ledger or source documents. Correcting them is done by editing the invoice or payment behind them.

## Permissions

- Accounts team, managers and admins: edit and delete finance records (bills, expenses, assets, payments, invoices).
- Procurement keeps its current ability to edit purchase bills and supplier payments.
- Order deletion stays restricted to leadership, as it cascades.
- Anyone without rights simply does not see the action.

## Deleting

One confirmation dialog, reused everywhere, showing the record's key details (number, party, date, amount) before you confirm. Books entries created from a deleted document are removed automatically, so the trial balance stays correct.

## Technical notes

- Shared `RowActions` component (dropdown with View/Edit/Delete) plus the existing `DoubleConfirmDeleteDialog` for confirmation, wired into `PurchaseBillsTab`, `ExpensesAssetsTab`, `PaymentsHistory`, `FinanceOrdersTab`, `InvoicesTable`, `ReceivablesTable`, `PayablesTable`, `AccountsCustomersTab`.
- Reuse existing mutations: `useDeletePurchaseBill`, `useDeleteExpense`, `useDeleteFixedAsset`, `useSavePurchaseBill`, `useSaveExpense`, `useSaveFixedAsset`, `useDeleteInvoice`, `useUpdateInvoice`.
- New hooks needed: update/delete for `customer_payments` and `supplier_payments`, with invoice/order paid-amount recalculation after the change.
- Edit dialogs: reuse `PurchaseBillDialog` and the expense/asset dialogs in edit mode (prefilled); a new small payment edit dialog.
- Database migration: current DELETE policies on `purchase_bills`, `expenses`, `fixed_assets`, `customer_payments`, `supplier_payments` and `invoices` are admin-only. Add accounts-role DELETE policies (`has_role(auth.uid(),'accounts') OR is_admin_or_above(...)`, tenant-scoped), and an accounts UPDATE policy on `customer_payments`/`supplier_payments`. Sales-order deletion policy is left unchanged.
- Ledger lines are already removed by the existing posting triggers on DELETE, so no extra cleanup is required.
