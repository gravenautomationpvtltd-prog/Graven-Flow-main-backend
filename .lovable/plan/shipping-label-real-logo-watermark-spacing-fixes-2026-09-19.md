# Shipping label: real logo watermark + spacing fixes

## What you showed me

- Sheet `..._3.pdf` was generated before my fixes — it still has the old overlaps (contact line on the red bar, contact details running into the invoice box).
- Sheet `..._4.pdf` has the fixes, but two problems remain:
  1. The faint background is a decorative swirl — you want **our Graven logo** there instead.
  2. Address lines sit too close together and look like they overlap.

## Changes

1. **Logo watermark** — take the real Graven logo already extracted from your package slip and create a very faint, enlarged version of it (light transparency), printed once, centered behind the address area of every label. Remove the swirl rings completely.
2. **Address spacing** — increase the gap between address lines so two- and three-line addresses never touch, and clean the address text before printing (collapse double spaces/tabs, trim) so lines like "GHAZIABAD, UTTAR PRADESH, 201001…" wrap evenly.
3. Re-check every text block (header, contact lines, invoice strip) against the fixed layout so nothing overlaps with short or long addresses, 1 box or many boxes.

## Verification

Generate a fresh sheet from the same dispatch (GA-DSP26-0005), convert it to an image, and confirm: Graven logo watermark visible but faint, no overlapping text anywhere, per-box weight/dimensions correct.

## Technical details

- `src/lib/shipping-label-artwork.ts` — add a pre-faded logo variant (alpha ~8%, generated once with PIL from the extracted logo).
- `src/lib/shipping-label-pdf.ts` — replace `drawWatermark` rings with the faded logo image; normalize address whitespace; widen address line leading; keep everything else unchanged.
- No database or settings changes; labels stay print-only.
