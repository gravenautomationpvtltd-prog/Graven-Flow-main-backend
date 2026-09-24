# Fix payment terms on quotations + duplicate to another customer

## 1. Payment terms not appearing

The advance/balance and payment remark are captured in the quotation builder and stored by the auto-save draft path, but the main "create quotation" and "update quotation" save paths do not send these four fields to the database. So on any quotation saved normally the values are lost, which is why nothing prints. The Proforma Invoice PDF also has no payment-terms block yet.

Fix:
- Include advance percent, advance amount, balance amount and payment remark in the create and update quotation payloads (`src/hooks/useQuotations.ts`), so they persist for both new and edited quotations.
- Carry the same fields into the quotation version snapshot so revision history keeps them.
- Add the Advance Payable / Balance Payable rows and the payment remark line to the Proforma Invoice PDF (`src/lib/pi-pdf.ts`), matching the layout already added to the quotation PDF (rows directly under Grand Total, remark under "Amount Chargeable in words").
- Verify end to end on a real quotation: save with 80/20, reopen, download quotation and PI, confirm both show the split.

## 2. Duplicate a quotation to another customer (full or partial)

Today "Duplicate Quotation" copies a quotation for the same lead/customer only.

New behaviour:
- The Duplicate action opens a small step before the builder:
  - **Copy to**: keep the same customer, or search and pick a different customer (with its linked lead if one exists; otherwise the copy is created against the customer only).
  - **Items**: checkbox list of the source line items, all ticked by default, with "select all / none" and editable quantity per selected line. Unticked lines are not copied — this gives the partial-allocation case.
- Continue opens the existing quotation builder pre-filled with the chosen customer and only the selected items, plus subject, notes, terms, currency and payment terms from the source.
- The copy is a brand-new quotation with a fresh number, draft/pending status, no email history; the original is untouched.
- Stays super-admin only, as with the current Duplicate action.

## Technical notes

- New `DuplicateQuotationDialog.tsx` in `src/components/quotations/` holding the customer picker (reusing the existing customer search/combobox used elsewhere) and the item selection table.
- It passes `customerId`, `customerName`, optional `leadId` and the filtered `prePopulatedItems` into `CreateQuotationDialog`, which already supports these props; `duplicateFromId` continues to seed header fields.
- When a different customer is chosen, drop `enquiry_item_id` and any lead-specific links on the copied lines so the new quotation is not bound to the source lead's enquiry rows.
- No database or RLS changes; creation goes through the existing create-quotation path, keeping numbering, tenant scoping and activity logging intact.
