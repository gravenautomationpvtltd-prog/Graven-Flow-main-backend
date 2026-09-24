# Print only Model Number + Description on quotations — never the product name

## What happens today
All documents (Quotation, PI, Delivery Challan) share one line formatter in `src/lib/quotation-pdf.ts` (`getPrintableItemLines`): model number in bold on the first line, description in italic below. That part is correct.

The product name leaks in at the point a product is picked on a quotation line: when the catalog product has no description, the code falls back to the product **name** and stores it as the line's printable description:

- `src/components/quotations/QuotationLineItem.tsx:143,149` — `product.description || product.name || null` and `description = productDescription || product.name || product.model_number || ''`
- `src/components/quotations/QuotationBuilder.tsx:362-371` — same fallback pattern
- `src/components/quotations/QuotationLineItem.tsx:128` — quick-create product sets `description = newProduct.name`

So any product without a catalog description prints its name on the document.

## Fix
1. **Remove the product-name fallback everywhere a printable description is composed:**
   - `QuotationLineItem.tsx` — compose `productDescription` from `product.description` only (no `|| product.name`); `description` falls back to the model number when no description exists, never the name. Quick-create path sets the description from the new product's description/model, not its name.
   - `QuotationBuilder.tsx` (lines ~362-371) — same change.
   - `src/hooks/useQuotations.ts` (lines ~268, ~489) — verify `pickBestDescription` inputs never pass the product name; remove if present.
2. **Defensive guard in the PDF layer:** in `getPrintableItemLines` (`src/lib/quotation-pdf.ts`), when the resulting description is empty after cleanup, print only the model-number line (already the behavior) — ensure no name can arrive there.
3. On-screen editing keeps showing the product name in the picker/dropdown for identification (that's search UI, not the document); only the stored/printed text changes.

## Verification
- `npx tsgo --noEmit -p tsconfig.app.json` clean.
- Playwright: pick a product with no catalog description (e.g. one of the name-only products) on a quotation, open the quotation PDF, and confirm the lines show model number + description only — no product name anywhere.

## Not changed
- Model-number-first two-line print layout (already correct).
- `ViewQuotationDialog` on-screen display, packing list, invoice (invoice prints the saved line description as-is; this fix changes what gets saved).
