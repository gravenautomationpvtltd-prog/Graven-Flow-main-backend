# Product & Pricing System (50,000+ items)

Builds on the existing catalogue (28,232 products, 20,008 with model numbers) — nothing is deleted or replaced.

## What you get

1. **Product master with a status** — every product is Active, Discontinued or Obsolete. Old models stay searchable forever, never deleted.
2. **Two CSV imports**
   - *Active Products & Prices*: Sr No, Brand, Model No, Description, List Price, Sales Discount %, Purchase Discount %
   - *Discontinued / Obsolete*: Sr No, Brand, Model No, Description, Status, Sales Price, Purchase Price
   Everything else (sales price, purchase price, gross profit, margin %) is calculated automatically.
3. **Review before import** — after the file is read you see New / Updated / Duplicate / Error counts, the exact error rows with reasons, and only then confirm. Invalid rows are never imported, and you can download an error CSV.
4. **Handles 50,000 rows** without freezing — the file is uploaded once and processed on the server in batches, with Uploading → Validating → Processing → Completed progress and a final summary (new, updated, unchanged, errors, total).
5. **Matching** — a product is identified by Brand + Model No. Existing rows are updated, new ones created, no duplicates.
6. **Price versioning** — every upload records the old and new list price and both discounts, dated by the upload date. Nothing you enter manually. Old records are never removed.
7. **Quotation snapshot** — when a quotation line is created, the list price, both discounts, sales price, purchase price, gross profit and margin are frozen onto that line. Future price uploads never change past quotations.
8. **Quote eligibility, computed automatically**
   - Active + list price → AUTO QUOTE
   - Discontinued / Obsolete with prices → MANUAL / APPROVAL QUOTE
   - No usable selling price → PRICE ON REQUEST
9. **Margin protection** — an admin-set minimum margin (default 15%). Any line below it shows "Margin below minimum — approval required" instead of passing silently.
10. **Search** — by model number, partial model number, brand or description, fast at 50k+ rows. `6ES7511` and `Siemens CPU` both return results.
11. **Lead → product match** — a model number in a lead pulls the product and shows list price, discount, sales price, purchase price and margin, ready to quote in one click.
12. **Warnings** — clear obsolete / discontinued banners when such a product is picked, plus an optional Replacement Model No shown as a recommendation (editable on the product page, not required in CSV).
13. **Product page** — Product (brand, model, description, status), Current Pricing, Profitability, Price History. Nothing more.
14. **Quotation coverage analytics** — Total leads, quoted, unquoted, Quotation Coverage % against a 90% target, with an unquoted-reason breakdown (Product Not Found, Model Unclear, Price Not Available, Purchase Price Not Available, Obsolete, Discontinued, Margin Approval Required, Customer Information Missing, Invalid Enquiry, Other).

## Technical detail

**Schema (additive only, no drops)**
- `products`: add `product_status` (enum `product_status`: active/discontinued/obsolete, default active), `sales_discount_pct`, `purchase_discount_pct`, `sales_price`, `replacement_model_no`, `brand_key` + `model_key` (normalised, upper-trimmed, generated) with a unique index on `(tenant_id, brand_key, model_key)` for upsert matching, and a `pg_trgm` GIN index over `model_number || brand || description` for fast partial search. `gross_profit` / `gross_margin_pct` are generated columns from `sales_price - purchase_price`.
- New `product_price_versions`: product_id, tenant_id, effective_date (upload date), old/new list price, old/new sales discount, old/new purchase discount, source label, upload id, created_by. Insert-only.
- `product_import_runs`: filename, storage path, import type, counts (parsed/new/updated/unchanged/errors), error rows JSONB, status, uploaded_by.
- `quotation_items`: add snapshot columns `snap_list_price`, `snap_sales_discount_pct`, `snap_sales_price`, `snap_purchase_discount_pct`, `snap_purchase_price`, `snap_gross_profit`, `snap_gross_margin_pct`, `snap_product_status`.
- `lead_qualification` (or leads): add `unquoted_reason` text + `unquoted_note`, only set when no quotation exists.
- Minimum margin: reuse `products.min_margin_pct` for per-product overrides, with a tenant default stored in `company_settings`.
- All new tables get GRANTs + RLS scoped by `tenant_id`, matching the existing pattern.

**Import pipeline**
- Client parses CSV with a streaming parser off the main thread, validates rows locally (required Brand/Model/Description; numeric, non-negative prices; discounts 0–100), shows the preview counts and error list.
- Valid rows are uploaded as one JSON payload to the `list-price-imports` bucket; a new edge function `import-products-csv` streams it and upserts in 1,000-row chunks on `(tenant_id, brand_key, model_key)`, writes a `product_price_versions` row whenever list price or either discount differs, and records the run in `product_import_runs`.
- Client polls the run row for progress; summary and error CSV come from that record.

**Frontend**
- `src/components/products/ImportActivePricesDialog.tsx`, `ImportDiscontinuedDialog.tsx`, `ImportPreviewTable.tsx`, `ImportProgress.tsx`.
- `src/lib/product-csv.ts` (parse + validate + error CSV), `src/lib/pricing.ts` (single source of truth for sales/purchase price, profit, margin, quote eligibility).
- Products page: status column + filter, trigram-backed search, row click → product detail page `src/pages/ProductDetail.tsx` with pricing, profitability and price history.
- `QuotationLineItem.tsx` / `QuotationBuilder.tsx`: auto-fill from product, write the snapshot fields, show status warnings, replacement suggestion, and the margin-approval flag.
- Reports: `QuotationCoverageTab.tsx` + `useQuotationCoverage.ts` for coverage % and unquoted-reason breakdown; reason capture on the lead when it is closed without a quotation.

**Preserved**: existing products, list-price PDF import, procurement price requests, quotation PDF layout, roles and RLS all keep working; the new columns default so current records stay valid.

## Build order

1. Migration (enums, columns, indexes, new tables, grants/RLS).
2. `src/lib/pricing.ts` + CSV parse/validate library.
3. Edge function `import-products-csv` + run tracking.
4. Two import dialogs with preview, progress and error CSV.
5. Product list search/status + product detail page with price history.
6. Quotation snapshot, status warnings, margin approval.
7. Lead → product match auto-fill.
8. Quotation coverage analytics + unquoted reasons.
