# Make model-number search work with any spacing, dashes or look-alikes

## What is actually wrong

Two separate problems, both confirmed against the live catalog:

1. **8,257 of 28,265 products have no model number stored at all.** Their code only lives in the product name field (some even with stray tab characters around it, e.g. `\t1FK7032-2AK71-1UA0\t`). The look-alike match key is built from the model number only, so for these rows the key is empty — nothing can ever match them except a literal text search.
2. **The Product Catalog search screen never uses the match key.** It only does plain text matching on name, description, model number, brand and HSN. That is why `20-750-APS` finds 2 products but `20750APS` finds 0, even though that product's key is correctly stored as `20750APS`.

So the earlier work was real, but it was only wired into the quotation product picker and lead matching — not into the catalog screen, and not for the 8,257 name-only rows.

## The fix

**A. Make the match key cover every product**
- Rebuild the key so it falls back to the product name when the model number is blank, and trim stray whitespace/tabs first.
- Backfill the model number from the name for the name-only rows where the name is clearly a part code, so those products behave like every other product going forward.

**B. Use the key in every search box**
Wire the folded key into all the places a person types a part number:
- Product Catalog (search + bulk import duplicate check)
- Quotation / PI line item product picker (already partly done — make it consistent)
- Enquiry and lead product matching
- Bulk price dumping and price-request screens
- Product CSV / list-price imports

Each search will try, in order: exact key, key starting with the typed text, key containing it, then the existing text search — so exact hits always rank first.

**C. Tolerant typing**
Typing `6ES7 511-1AK02-0AB0`, `6es7511/1ak02.0ab0`, `6ES75111AK020AB0` or `6ES7511-1AK02-OABO` will all land on the same product. Commas and any other punctuation are stripped too, and a pasted comma-separated list is treated as separate part numbers.

The original model number as stored is never altered on screen or in print — the folded key is only used for finding things.

## Technical detail

- Migration: drop and recreate the generated columns
  `products.match_key = translate(upper(regexp_replace(COALESCE(NULLIF(btrim(model_number),''), btrim(name), ''), '[^a-zA-Z0-9]', '', 'g')), 'OIL', '011')`
  and keep `brand_match_key` as is; recreate the three indexes (`match_key`, `text_pattern_ops`, `(tenant_id, brand_match_key, match_key)`).
- Backfill: `UPDATE products SET model_number = btrim(name) WHERE model_number IS NULL AND btrim(name) ~ '^[A-Za-z0-9][A-Za-z0-9 ._/-]{3,60}$' AND btrim(name) ~ '[0-9]'`; also `UPDATE products SET name = btrim(name) WHERE name <> btrim(name)`.
- `src/lib/model-normalize.ts`: `stripModel` already removes all non-alphanumerics (commas included); add `splitModelList(text)` to split pasted comma/newline lists into separate probes.
- `src/hooks/useProducts.ts`: add `match_key.ilike.%<folded>%` to the `.or()` in both `useProductsInfinite` (line 27) and `useProductsAdmin` (line 113), folded via `normalizeModel`, and re-rank exact-key hits to the top client-side.
- `src/hooks/useQuotations.ts` (line 167-174): keep, plus exact-key probe first.
- `src/hooks/useProductMatch.ts`: probes already include `match_key`; extend to the comma-split candidates.
- `src/lib/catalog-price-sync.ts` and the two edge functions (`import-products-csv`, `import-list-prices`): resolve by folded key with the new name fallback; redeploy both functions.
- Duplicate report (`ModelDuplicatesDialog`) will pick up the new name-derived keys automatically; nothing is merged automatically.

## Verification

Search each of these in the Product Catalog and confirm the same product is returned:
`1FK7032-2AK71-1UA0`, `1FK70322AK711UA0`, `1FK7032 2AK71 1UA0`,
`20-750-APS`, `20750APS`, `20,750,APS`,
`6E57288-2DT16-0AA0`, `6E572882DT160AA0`, `6E572882DT160AAO`.
