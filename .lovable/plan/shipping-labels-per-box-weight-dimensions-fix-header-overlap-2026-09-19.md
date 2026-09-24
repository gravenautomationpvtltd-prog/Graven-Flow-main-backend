# Shipping labels: per-box weight/dimensions + fix header overlap

## Problems (confirmed in the generated PDF)
1. Every box prints the same weight and dimensions — in reality each box differs.
2. Header crowding: the company name wraps to two lines and the CIN / GST / PAN row sits too close, overlapping the address text.

## Changes

### Dialog — `src/components/dispatch/ShippingLabelDialog.tsx`
- Ask **Number of boxes** first.
- Below it, render one row per box: `Box 1 — Weight (KG) [ ] Dimensions (CM) [ ]`, `Box 2 — ...`, etc.
- Rows grow/shrink when the box count changes; existing entries are preserved when possible.
- Box 1 keeps the current prefill (weight from dispatch lines, dimensions from the first line); other boxes start blank.
- Cap box rows so the form stays scrollable (already scrollable from the last fix).

### PDF — `src/lib/shipping-label-pdf.ts`
- `ShippingLabelData` gains `boxes: { weightKg: string; dimensionsCm: string }[]`; label N shows its own weight/dimensions (falls back to box 1's values or blank if not filled).
- Header layout fix: keep the company name on one line (shrink font if needed), give the CIN / GST / PAN row its own clear line with proper spacing so nothing overlaps the address.
- Everything else stays: red brand header, big customer name, invoice strip, Google Play badge + QR, thank-you footer, 4 per A4 sheet.

## Verification
Generate a real sheet with 4 boxes having different weights/dimensions and convert it to an image: each label shows its own weight/dimensions, and the header has no overlap.
