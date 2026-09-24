# Product form: drop Product Name, require Model Number, Description right below

Applies to the shared product dialog (`src/components/settings/ProductDialog.tsx`) used by both "Add Product" and "Edit Product".

## Changes
1. **Remove the Product Name field** from the form (no label, no input, no validation error).
   - The database still requires a `name`, so it is filled automatically and silently: `name = model number` (uppercased, trimmed). If a quick-create prefilled name exists it is kept when no model number change applies — but model number is required, so in practice name always mirrors the model number.
2. **Model Number becomes required** — schema changes from optional to `min(1, 'Model number is required')` with the `*` marker on the label. The helper text ("Printed in bold as the first line…") stays.
3. **Description moves directly below Model Number** (above Product Status / Replacement row), rows bumped to 3 so it's comfortable to type.
4. Form defaults/resets: drop `name` from the visible defaults (still computed on submit); keep everything else unchanged.

## Submit logic
- On save: `name: data.model_number.trim().toUpperCase()`; `model_number` same value; `description` as typed. No other submit changes.

## Out of scope
- Existing products keep their current stored names — nothing is rewritten in the catalog.
- Other screens that show the product name in lists/pickers stay as-is.

## Verification
- `npx tsgo --noEmit -p tsconfig.app.json` clean.
- Playwright: open Add Product — no name field, model required (submit without model shows the error), description sits directly under model; edit the currently open product (20F11ND5P0AA0NNNNN), save, confirm the product page still shows correctly.
