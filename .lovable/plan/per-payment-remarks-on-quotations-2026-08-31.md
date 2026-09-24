# Per-Payment Remarks on Quotations

Today there is a single "Payment Remark" box. Users need a separate remark for the advance portion and for the balance portion (e.g. "Advance" for 80%, "Before delivery" for 20%), and both must print on the Quotation / Proforma Invoice / Delivery Challan PDFs.

## What changes

**Quotation builder (Payment Terms card)**
- Under "Advance Payable" add a short text input: "Advance remark" (placeholder: e.g. Advance with PO).
- Under "Balance Payable" add a short text input: "Balance remark" (placeholder: e.g. Before delivery).
- Keep the existing general Payment Remark box as an optional overall note.

**PDF output**
- Payment schedule block prints:
  - `Advance Payable (80%) — Advance with PO` … amount
  - `Balance Payable (20%) — Before delivery` … amount
  - General payment remark below, as today.
- Remarks wrap onto a second line when long; block height adjusts.

**View dialog**
- Shows each remark next to its respective line, matching the PDF.

## Technical notes

- Migration: add `advance_remark text` and `balance_remark text` to `public.quotations` (nullable, no policy changes needed).
- Persist in `useQuotations.ts` (create + update payloads) and `useDraftQuotation.ts` (autosave/draft restore).
- Render in `src/lib/quotation-pdf.ts` payment schedule section (shared by quotation/PI) and in `ViewQuotationDialog.tsx`.
- Duplicate-quotation flow carries the new fields along with existing payment terms.
