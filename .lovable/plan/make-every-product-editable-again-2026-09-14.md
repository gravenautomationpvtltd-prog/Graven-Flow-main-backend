# Make every product editable again

## What is going wrong

The duplicate check added for product saving is far too strict, so it blocks edits that the database itself would happily accept.

The check compares codes after removing dashes/spaces and folding look-alike characters (O to 0, I/L to 1). That "loose" form is right for *searching*, but wrong for *blocking a save*. Example from your screenshot:

- `6SL3210-5FB10-4UF1` (the product you were editing)
- `6SL32105FB104UF1` (a separate product imported without dashes)

These are two different entries that have always coexisted. The loose comparison treats them as the same, so neither can be saved.

Across the catalogue, **1,718 code groups covering 3,470 products** collide under that loose comparison — every one of them currently refuses to save. That is why it looks like "every product shows its own error".

## The fix

1. **Block only real duplicates.** The save check matches the database rule: the exact code, ignoring letter case only. Dashes, spaces and look-alike characters no longer merge two different codes.
2. **Don't check when nothing changed.** If the code in the box is the same as what is already stored, the save goes straight through — no lookup at all. This covers price-only or description-only edits on any product, including the 3,470 affected ones.
3. **Same rule when adding a product**, so new items follow one consistent rule.
4. **Clear message when it is a genuine clash**, naming the other product's code, instead of the raw database error.
5. Deleting is untouched — it never went through this check.
6. **Every existing value is prefilled when you open Edit.** The form already loads the saved code, description, status, prices and other fields; the plan adds a check that every field in the dialog (including price validity, preferred supplier, weight/dimensions and discounts) is populated from the stored product, so an edit usually means changing only the one thing you came to change.

## Verification

- Confirm in the live app: edit `6SL3210-5FB10-4UF1` (change a price), save — succeeds; the separate `6SL32105FB104UF1` entry also saves.
- Try to save a code that exactly matches another product — friendly message appears, no raw database text.
- Add a brand-new product with a fresh code — succeeds.
- Count how many products would still be blocked after the change (expected: only the 18 exact case-variant groups, which are true duplicates).

## Technical notes

- `src/hooks/useProducts.ts` → `assertModelNumberFree`: drop the `match_key.eq.<folded>` branch and the folded comparison; query `model_number.ilike.<typed>` only (escaping `%`/`_`), keep `.neq('id', excludeId)`, keep the `23505` / `products_tenant_model_number_key` mapping in `friendlyProductError` as the backstop.
- `useUpdateProduct`: skip `assertModelNumberFree` entirely when the submitted `model_number` equals the stored one case-insensitively — pass the current value through from the dialog, or re-read it in the mutation.
- `useCreateProduct`: same exact-match-only rule, still falling back to `product.name` when `model_number` is absent.
- No migration; the `(tenant_id, model_number)` unique constraint stays as is.
