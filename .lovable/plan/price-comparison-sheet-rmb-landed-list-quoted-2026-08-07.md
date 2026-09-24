# Price Comparison Sheet (RMB / Landed / List / Quoted)

Add a third internal document alongside Quotation and Proforma Invoice: a **Comparison Sheet** that puts every commercial number for a quotation side by side, downloadable as PDF and CSV.

## What it shows

One row per quotation line, with columns:

| Column | Source |
| --- | --- |
| Model number | quotation line (already stored) |
| Description | quotation line |
| Qty / Unit | quotation line |
| List price (₹) | product catalog `list_price` + source (e.g. Siemens list) |
| Discount off list % | computed: quoted rate vs list price |
| RMB price | latest approved bulk-price row matched on model number |
| Landed cost ₹/unit | same bulk-price row (`final_inr_unit`, the post freight/duty/expense figure) |
| Quoted rate ₹ | quotation line rate |
| Margin ₹ / Margin % | quoted rate vs landed cost (falls back to list-based margin when no RMB row exists) |
| Line total ₹ | quoted rate × qty |
| Source | "Bulk price approval", "List price", or "Manual" so it is clear which numbers are trustworthy |

Footer totals: total list value, total landed cost, total quoted value, blended margin %, and a note when some lines had no RMB reference.

Rows with no matching RMB record show "—" in the RMB/landed columns and are flagged, so gaps are obvious rather than silently zero.

## Where it lives and who can see it

- **Quotation view dialog → Download menu:** new "Comparison Sheet (PDF)" and "Comparison Sheet (CSV)" entries below the existing Quotation / Proforma / Delivery Challan items — but only rendered for users who are permitted.
- **Access is not open to everyone.** The sheet exposes cost, RMB, and margin, so it is gated:
  - A new per-user flag (`profiles.can_view_price_comparison`) controls it. Default off for everyone.
  - Top management (super_admin / COO) always has access implicitly.
  - The flag is toggled from the backend admin area (Settings → Users), so you decide person by person who can pull the sheet.
- Users without the flag never see the menu entries, and the underlying cost/RMB query is skipped entirely for them.
- The PDF is stamped **INTERNAL — CONFIDENTIAL, NOT FOR CUSTOMER** in header and footer.


## Suggested extras (recommended, included)

- **Sortable on-screen preview** before download, so pricing can be reviewed and re-decided without exporting first.
- **Editable what-if row** at the top of the preview: change FX rate, freight, duty, expense, margin, negotiation once and see every line's landed cost and margin recompute live (reuses the existing landed-cost calculator). Export captures whatever values are on screen, with the assumptions printed in the PDF header.
- **Colour cue** on margin: red when below the product's minimum margin, amber under 10%, green otherwise.

## Technical notes

- New `src/lib/comparison-sheet.ts`: builds the row model from a quotation (items + product catalog + latest approved `price_submission_items` matched on `model_number`, falling back to `hsn_code`).
- New `src/lib/comparison-pdf.ts` using the same jsPDF layout conventions as `quotation-pdf.ts` / `pi-pdf.ts` (landscape A4 given the column count, repeated header, page numbers).
- CSV via the existing `src/lib/csv-utils.ts` helper.
- Recalculation reuses `computeLandedCost` in `src/lib/landed-cost.ts` — no duplicate maths.
- New `src/hooks/useQuotationComparison.ts` to fetch catalog list prices and the matching approved bulk-price rows in two batched queries.
- New `src/hooks/useCanViewPriceComparison.ts` gating hook; one migration adds the `can_view_price_comparison` boolean to `profiles` plus the admin toggle in the user management screen.
- Otherwise read-only: no other schema changes, no writes.

## Out of scope

- Editing quoted rates from the comparison sheet (view/what-if only; pricing changes still happen in the quotation builder).
- Comparing multiple quotations against each other — can follow later if useful.
