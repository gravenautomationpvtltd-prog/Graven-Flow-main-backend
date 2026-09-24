# Fix: Model number not printing above description on quotations

## What's wrong

Quotation PDFs print the bold code line only when the linked catalog product has a `model_number` value. For the Siemens items in the example quotation, the products were created with the model code stored in the **Product Name** field and `model_number` left empty, so the PDF had nothing to print as the bold first line and fell back to printing the description only.

Confirmed in the data:
- The four SINUMERIK quotation lines all link to catalog products whose `model_number` is empty while `name` holds the code (e.g. `6FC52100DF212AA0`).
- 19,710 of 26,566 catalog products have no `model_number`; 8,811 of those have a single-token name that is clearly the model code.
- The Edit Product dialog has no Model Number field at all, so it cannot be corrected from the UI.
- Quotation line items also never persist a model number of their own (there is no such column), so every print depends entirely on the catalog value.

The ABB lines print correctly because those products do have `model_number` filled.

## Fix

1. **Backfill the catalog** — for products with an empty `model_number`, copy the code out of `name` when the name is a single code-like token (no spaces). For names that start with a code followed by text (e.g. `6FC5403-0AA20-0AA1 SINUMERIK 8 HT ...`), split: leading code goes to `model_number`, the remainder fills the description if the description is empty or duplicated.
2. **Add a Model Number field** to the Add/Edit Product dialog so it can be maintained going forward, shown next to Product Name.
3. **Persist per-line values on quotations** — add `model_number` and `product_description` columns to quotation items, and write them on quotation create and update so a printed quotation stays stable even if the catalog changes later.
4. **Harden the PDF fallback** — when no model number is available, if the product name differs from the description and looks like a code, use the name as the bold first line instead of collapsing to a single description line.

## Result

Every quotation, PI and delivery challan prints the model number in bold on the first line with the description italic underneath, matching the ABB example.

## Technical notes

- Migration: backfill `products.model_number`; add `quotation_items.model_number` and `quotation_items.product_description` (nullable text).
- Code: `src/components/settings/ProductsManagement.tsx` (form field), `src/hooks/useQuotations.ts` (both item insert payloads), `src/lib/quotation-pdf.ts` (`getPrintableItemLines` fallback).
- No change to pricing, tax or layout logic.
