# Edit a product from its own page

Add an "Edit product" button on the product page so any detail can be corrected on the spot, without going back to the catalogue.

## What changes

- An **Edit** button next to "Back to catalog" on the product page.
- It opens the same product form already used in the catalogue: name, model number, description, brand, HSN, unit, category, status (active / discontinued / obsolete), replacement model, list price, sales and purchase discounts, tax, lead time, preferred supplier, price validity, and weight/dimensions.
- On save, the page refreshes instantly — pricing, profit, margin, eligibility badge and logistics all update without a reload.
- Price changes continue to be recorded in the price history exactly as they are today.
- Visible to the same people who can already reach the catalogue (admin, manager, procurement); everyone else keeps read-only view.

## Technical notes

- `src/pages/ProductDetail.tsx`: add local `editOpen` state, an Edit button in the header, and render `ProductDialog` (`src/components/settings/ProductDialog.tsx`) with `product={product}`.
- After a successful update, invalidate `['product-detail', id]` and `['product-price-versions', id]` in addition to the existing `products-admin` / `products` invalidations in `useUpdateProduct` so the detail page reflects the edit immediately.
- Gate the button with `useAuth()` (`isAdmin || isManager || isProcurement`), matching the Products page rule.
- No schema or backend changes.
