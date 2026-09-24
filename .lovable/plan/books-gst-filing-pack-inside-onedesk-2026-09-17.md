# Books & GST filing pack inside OneDesk

Goal: everything the team already records — sales invoices, e-way bills, purchase bills, payments, expenses, assets — rolls up automatically into month-wise GST returns and proper financial statements your CA can use, with no re-keying in Tally or Excel.

The automatic e-invoice/e-way bill generation work is dropped.

## What you and your CA will get

**Accounts → GST Filing (month picker)**
- Outward register: every sales invoice for the month with customer GSTIN, place of supply, taxable value, CGST/SGST/IGST, HSN and invoice type (B2B / B2C / export / credit note).
- Inward register: every purchase bill with supplier GSTIN, taxable value and input tax.
- E-way bill register for the month.
- Summary tiles: output tax, input tax, net payable, and a checklist of rows that would be rejected on the portal (missing GSTIN, missing HSN, missing place of supply) so they can be fixed before filing.
- Downloads: **GSTR-1 JSON** and **GSTR-3B JSON** in the portal's offline-utility format, plus Excel/CSV of every register.

**Accounts → Books**
- Trial balance, Trading account, Profit & Loss and Balance Sheet for any date range, with drill-down from any figure to the documents behind it.
- Day book (all entries by date) and Ledger view per customer, supplier, bank, expense or asset account.
- Each statement downloadable as PDF and Excel.

**New entry screens (so the picture is complete)**
- **Purchase bills** — the purchase team records the supplier's tax invoice (number, date, supplier GSTIN, taxable value, GST split, HSN), optionally linked to a purchase order. This is what feeds input credit; today only purchase orders exist, which is not enough for filing.
- **Expenses** — rent, salaries, freight, travel, etc., with an expense head and optional GST.
- **Assets** — purchases of equipment/vehicles with depreciation rate, so the balance sheet is real.
- **Bank & cash accounts** with opening balances, plus capital/loan entries.

## How it stays automatic

Every document your team already saves posts itself into the books in the background:

| What the team saves | What the books record |
|---|---|
| Sales invoice | Customer debited, sales income and output GST credited |
| Customer payment | Bank debited, customer credited |
| Purchase bill | Purchases/stock and input GST debited, supplier credited |
| Supplier payment | Supplier debited, bank credited |
| Import invoice | Purchase plus customs duty, freight and IGST |
| Expense | Expense head debited, bank or supplier credited |
| Asset purchase | Asset debited |

Nobody types journal entries. A super-admin/CA-only screen allows manual adjustment entries (depreciation, year-end provisions, opening balances).

## Build order

1. **Foundation** — chart of accounts (seeded with a standard Indian trading-company set, editable), ledger entries table, posting rules, opening balances.
2. **Missing entry screens** — purchase bills, expenses, assets, bank accounts.
3. **Back-posting** — post all existing invoices, payments, purchase orders received and import invoices into the ledger so history is present from day one.
4. **GST Filing screen** — registers, validation checklist, GSTR-1 and GSTR-3B JSON, Excel exports.
5. **Books screen** — trial balance, trading, P&L, balance sheet, day book, ledgers, PDF/Excel export.

## Technical notes

- New tables: `chart_of_accounts`, `ledger_entries` (double-entry lines with tenant_id, account_id, debit, credit, source_type, source_id, entry_date), `purchase_bills` + `purchase_bill_items`, `expenses`, `fixed_assets`, `bank_accounts`, `accounting_periods` (for period lock after filing). All tenant-scoped with RLS, accounts/super-admin write, CA read-only role reuse of `accounts`.
- Posting via database triggers on `invoices`, `customer_payments`, `purchase_bills`, `supplier_payments`, `import_invoices`, `expenses` so figures can never drift from the documents; reversal on document delete/cancel.
- GSTR-1 JSON built client-side in `src/lib/gst-returns.ts` following the GSTN offline-utility schema (b2b, b2cl, b2cs, hsn, cdnr sections); GSTR-3B JSON in the same file. Validation reuses the invoice checks already written for e-invoicing (state from GSTIN, HSN 6–8 digits).
- Statements computed in `src/lib/financial-statements.ts` from `ledger_entries` grouped by account type, with a schedule-III style grouping for the balance sheet.
- Existing `GSTSummary.tsx` becomes the summary block of the new GST Filing tab.

## Out of scope for now

- Filing directly to the GST portal via API (JSON upload stays manual, no cost).
- TDS/TCS returns, payroll statutory returns, inventory valuation methods other than the cost already stored.
- Automatic GSTR-2B reconciliation against the portal (can follow once purchase bills exist).
