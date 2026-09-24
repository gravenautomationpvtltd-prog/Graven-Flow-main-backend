# Payment Terms & Advance/Balance Split on Quotations

Today a quotation only shows one figure — the full grand total. There is no way to record that, say, 80% is advance and 20% is due before dispatch. This adds a payment-schedule block to the quotation (and PI/proforma), so the customer document shows Advance Payable and Balance Payable plus a free-text payment remark.

## What the user gets

In the quotation builder, below the totals, a new "Payment Terms" section:

- Advance % input (e.g. 80). Balance % auto-fills to the remainder (20).
- Live computed amounts in the quotation's currency:
  - Advance Payable: 80% of grand total
  - Balance Payable: remaining amount
- Optional switch to enter fixed amounts instead of percentages (for cases like "USD 5,000 on order, rest on dispatch"), with the balance auto-derived.
- A "Payment Remark" text box, e.g. "20% before dispatch against proforma invoice".
- Leaving advance blank/100% keeps the current behaviour — no extra block is printed.

On the PDF (quotation, proforma invoice, and the same block in the delivery-challan-style layout where relevant), directly under Grand Total:

```text
Grand Total                USD 10,000.00
Advance Payable (80%)      USD  8,000.00
Balance Payable (20%)      USD  2,000.00
Payment Remark: 20% before dispatch
```

Values are rounded consistently with existing currency rules and always sum exactly to the grand total (rounding difference absorbed into the balance line).

## Technical notes

- Database: add to `public.quotations` — `advance_percent numeric`, `advance_amount numeric`, `balance_amount numeric`, `payment_remark text`. All nullable, no default; existing quotations are unaffected. No new table, so no new RLS/grants needed.
- Regenerate types, then extend the quotation insert/update payloads in `QuotationBuilder.tsx` (create, edit, draft-autosave and duplicate paths all read the same state object).
- New UI block in `QuotationBuilder.tsx` next to the totals summary; derived amounts computed from `grandTotal` in the same memo that produces the totals, so currency and exchange-rate changes recalculate automatically.
- PDF: in `src/lib/quotation-pdf.ts` and `src/lib/pi-pdf.ts`, render the advance/balance rows immediately after the grand-total row and the remark under "Amount Chargeable (in words)"; skip the block entirely when no advance is set.
- Read-only display of the same three lines in `ViewQuotationDialog.tsx`.
