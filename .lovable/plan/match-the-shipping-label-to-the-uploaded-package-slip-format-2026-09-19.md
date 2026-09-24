# Match the shipping label to the uploaded PACKAGE_SLIP format exactly

The uploaded HTML is the same package-slip design (Graven header, shipping address block, invoice/weight strip, app footer, QR). Our labels already follow it broadly — this plan makes the printed label match the sample artwork exactly, and keeps everything already built (editable form, per-box weight/dimensions, 4 labels per A4 sheet, no prices beyond invoice value).

## What changes

1. **Use the real artwork from your file**
   - Extract the actual embedded images from the uploaded HTML — the Graven logo, the Google Play badge, and the QR code — and save them as app assets.
   - The label PDF will print these exact images instead of the currently drawn/vector approximations.

2. **Match the layout pixel-for-pixel**
   - Take the exact positions, sizes, colours and font weights from the sample: red header bar, logo + "Graven Automation PVT LTD", contact line, company address, CIN / GST / PAN row, "Shipping Address" heading with "N of M" counter, customer name in large type, address, contact person / number, invoice no. + invoice value, weight + dimensions, and the "PROCUREMENT, MADE EASIER / DOWNLOAD THE APP NOW / THANK YOU FOR CHOOSING US!" footer.
   - Fix any remaining spacing differences so nothing overlaps, even with long company names or addresses.

3. **Keep everything that already works**
   - Editable fields in the Shipping Labels dialog (company, address, contact, invoice no./value, boxes).
   - Per-box weight and dimensions.
   - 4 labels per A4 sheet with cut guides; extra pages when more than 4 boxes.
   - No database changes; form edits stay print-only.

## Verification

- Generate a real sheet from a dispatch, convert to an image, and compare side-by-side with your sample until they match.
- Test edge cases: long company name, long address, 1 box and 6 boxes.

## Technical details

- Files touched: `src/lib/shipping-label-pdf.ts` (layout + embedded images), new image assets under `src/assets/` (extracted from your HTML), minor tweaks in `src/components/dispatch/ShippingLabelDialog.tsx` only if a field is missing.
- No migrations, no edge functions, no new dependencies.
