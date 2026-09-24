# Confusion-tolerant model number recognition

Today the system already ignores case, spaces and dashes, so `6ES7 511-1AK02-0AB0` and `6ES75111AK020AB0` are treated as the same item. What it does not handle is the letter/digit look-alikes in your list — the final `0AB0` typed as `OABO`. Those variants currently fail to find the product.

## What will change

One canonical "match key" applied everywhere a model number is read or written:

1. Uppercase.
2. Remove every separator (space, dash, slash, dot).
3. Fold look-alike characters: letter `O` becomes digit `0`, letter `I` and lower `l` become digit `1`.

With that, all 32 variants you listed collapse to a single key and resolve to the same product.

Where the key is used:
- Product search in quotations and the product master.
- Catalogue matching from lead and enquiry text (attachments, e-mails, pasted lists).
- Price list and product CSV imports, so an `O`/`0` typo in a supplier file updates the existing product instead of creating a twin.
- Bulk price dumping and the price request screens.

Safeguards:
- The original model number as typed by the supplier is always stored and printed unchanged — the folded key is only used for matching.
- Where a folded key matches more than one real product (genuinely different items), the system shows both instead of guessing, marked as an ambiguous match.

A one-off duplicate report will list any existing catalogue rows that collapse to the same key, so you can decide what to merge. Nothing is merged automatically.

## Technical detail

- Add `fold_confusables` to `src/lib/model-normalize.ts` and extend `normalizeModel` to apply it; `brandModelKey` inherits it.
- Add a generated column `products.match_key` = `translate(upper(regexp_replace(coalesce(model_number,''),'[^a-zA-Z0-9]','','g')), 'OIL', '011')` plus a b-tree index, and a matching `brand_match_key`. Existing `normalized_model` stays for exact lookups.
- Search: probe `match_key` (exact, then prefix, then contains) before falling back to the current ilike probes; keep exact-normalized hits ranked first.
- `useProductMatch.ts`: score on the folded key; a fold-only difference stays "high" confidence, and `extractModelCandidates` also emits folded candidates.
- `import-products-csv` and `import-list-prices`: resolve the target row by `tenant_id + brand_match_key + match_key` before upserting; keep the existing `model_number` unique constraint as the write path so no schema break occurs.
- Duplicate report: a read-only query grouped by `(tenant_id, brand_match_key, match_key)` having count > 1, surfaced on the product master page.
