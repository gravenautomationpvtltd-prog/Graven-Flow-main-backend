# One pricing section in the product form, with net prices for discontinued items

Right now the edit form asks for prices twice: once as List Price + sales/purchase discounts near the top, and again as "Selling Rate" and "Purchase Price" further down. That is confusing and the two can disagree. This merges them into a single pricing block.

## What changes

**One pricing block, two ways to fill it**

A small choice at the top of the pricing block:

- **From list price (default for active products)** — enter List Price, Sales Disc. %, Purchase Disc. %. Sales price, purchase price, profit and margin are calculated as they are today. The net price boxes are shown read-only so you can see the result.
- **Net prices (default for discontinued and obsolete products)** — enter the net Sales Price and net Purchase Price directly. No list price or discounts required, since there is no live price list for these items. Profit and margin are calculated from the two net figures.

Switching a product's status to Discontinued or Obsolete automatically switches it to net-price entry (and back to list price for Active), but you can override the choice on any product — for example a one-off active item bought at a negotiated net price.

**Duplicate fields removed**

The separate "Selling Rate (₹)" and "Purchase Price (₹)" boxes lower in the form disappear; those same values now live in the pricing block. GST rate, margin display, and everything else stay where they are.

**Validation**

- List-price mode: a list price is required if any discount is filled.
- Net-price mode: sales price is required; purchase price is optional.
- Sales price below purchase price shows a warning (not a block), as today.

The product page's "Current pricing" card shows a dash for list price and discounts on net-priced items instead of blanks, and keeps showing sales price, purchase price, profit and margin.

## Technical notes

- `src/components/settings/ProductDialog.tsx`
  - Add a form field `pricing_mode: 'list' | 'net'` (not persisted; derived on open from whether `list_price` is set and from `product_status`, and re-derived when the status select changes unless the user has touched it).
  - Move `default_rate` (sales) and `purchase_price` inputs into the pricing block; render them disabled and value-bound to `applyDiscount(...)` output in list mode, editable in net mode.
  - `onSubmit`: in list mode keep the current derivation; in net mode write `default_rate` / `sales_price` = entered sales price, `purchase_price` = entered purchase price, and leave `list_price` / discount percentages as entered (null when blank).
  - Delete the lower duplicate `default_rate` / `purchase_price` grid; keep the GST select and the margin readout, feeding the readout from the effective sales/purchase values in both modes.
  - Extend `DerivedPricingHint` to accept the effective sales/purchase pair so it works in both modes.
- `src/lib/pricing.ts`: `computePricing` already falls back to stored `sales_price` / `purchase_price` when list price and discounts are absent — verify and keep that path so eligibility and margin checks work for net-priced products.
- No schema change: `list_price`, `sales_discount_pct`, `purchase_discount_pct`, `sales_price`, `default_rate` and `purchase_price` all already exist and are nullable.
- Price history keeps recording via the existing product price-change trigger, which reads the stored sales/purchase prices.
