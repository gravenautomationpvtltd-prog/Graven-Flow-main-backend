# Product Master, Pricing & Auto-Quotation — remaining build

Much of this specification is already live: product status (Active/Discontinued/Obsolete), single list price with sales/purchase discounts, automatic profit and margin, price history versions, quotation price snapshots, both CSV imports with preview and error CSV, product detail page, and the Quotation Coverage report with unquoted reasons.

This plan adds the parts that are still missing.

## 1. Weight and dimensions (KG / CM only)

- Add permanent logistics fields to each product: Weight (KG), Length, Width, Height (CM). Optional, entered once, reused forever.
- Active product upload gains the two new columns: `Weight (KG)` and `Dimensions (L × W × H) (CM)`, e.g. `20 × 15 × 8` (also accepts `20x15x8`). Split into three stored values.
- Validation: negative weight rejected, malformed dimensions rejected, blank allowed.
- No unit selectors anywhere — the fields are labelled KG and CM and stored that way.
- Product page gains a Logistics block; product editor gains the same four fields.

## 2. Brand + Model No as the product identity

Today the upload matches on model number alone. It will match on Brand + Model No (normalised: upper-case, spaces and hyphens stripped), so the same model from two brands stays two products, and re-uploads update instead of duplicating.

## 3. Smarter product search

One normalised model key per product so all these find the same item:

```text
6ES75111AK020AB0
6ES7 511-1AK02-0AB0
6ES7511-1AK02-0AB0
```

Search ranks exact model, then model prefix, then brand/description keyword hits, and stays fast at 50,000+ products via database indexes and server-side paging.

## 4. Lead to product matching with confidence

When a lead or enquiry line contains a model number, the system extracts it, searches the master and scores the match:

- High confidence: product auto-selected with its current pricing.
- Medium: best match shown for one-click confirmation.
- Low: user picks from a short candidate list.

Selecting a match fills list price, discounts, sales price, purchase price and margin automatically.

## 5. Margin protection with approval

- Minimum margin % becomes an admin setting (default 15%), with optional per-product override.
- A quotation line below the minimum shows Sales Price, Purchase Price, Gross Profit, Margin %, Minimum Required and Shortfall, and is flagged "Approval required".
- Saving or sending such a quotation requires an approver role; ordinary users cannot push it through silently.

## 6. Automatic packing list

- Dispatch lines pull weight and dimensions from the product master.
- Per line: Model No, Description, Quantity, Unit Weight (KG), Dimensions (L × W × H) (CM), Total Weight = Unit Weight × Quantity; plus total shipment weight.
- One-click "Generate Packing List" PDF from a dispatch.
- Weight and dimensions never appear on Quotation, PI, Sales Order, Purchase Order or Tax Invoice — logistics documents only.
- Stored CM/KG values leave room for later CBM, volumetric weight, box count and freight estimates without new uploads.

## 7. Frozen prices on every commercial document

The quotation snapshot (list price, both discounts, both prices, profit, margin, price version) is carried forward to PI, Sales Order, Purchase Order and Invoice, so no old document ever changes when a new price list is uploaded.

## 8. Coverage dashboard by person and team

Extend the existing Quotation Coverage report with a person-wise and department-wise breakdown of unquoted leads and their reasons, against the 90% target.

## Technical detail

- Migration (additive): `products.weight_kg`, `length_cm`, `width_cm`, `height_cm`; `products.normalized_model` generated column (upper, strip non-alphanumerics) plus index; unique index on `(tenant_id, brand_key, model_key)` replacing model-only matching for upserts; `dispatch_items` snapshot columns for unit weight and dimensions; `company_settings` key `min_margin_pct`; `quotation_items.price_version_id`, propagated to PI/SO/PO/invoice item snapshots.
- `src/lib/product-csv.ts`: two new active-import columns, dimension parser (`L × W × H`), weight/dimension validation, updated template and error CSV.
- `supabase/functions/import-products-csv/index.ts`: match on tenant + brand_key + model_key, batch upsert with logistics fields, unchanged/updated/new counts already in place.
- `src/lib/model-normalize.ts`: shared normaliser used by import, search and lead matching.
- `src/hooks/useProductMatch.ts`: rewritten to score model/brand/description matches and return a confidence band.
- `src/lib/packing-list-pdf.ts` + "Generate Packing List" action in `ViewDispatchDialog.tsx`; `useDispatches` pulls logistics from products.
- Margin approval: `src/lib/pricing.ts` shortfall helper, settings field in Settings, gate in `QuotationBuilder.tsx`.
- Coverage: extend `useQuotationCoverage.ts` with owner/department grouping and add the breakdown to `QuotationCoverageTab.tsx`.

## Build order

1. Migration (logistics fields, normalised model, Brand+Model unique index, settings, snapshot links).
2. CSV columns, validation, template, edge-function Brand+Model matching.
3. Search normalisation + product page and editor logistics fields.
4. Lead to product matching with confidence.
5. Margin threshold setting and approval gate.
6. Packing list generation from dispatch.
7. Snapshot propagation to PI/SO/PO/Invoice.
8. Coverage breakdown by person and department.
