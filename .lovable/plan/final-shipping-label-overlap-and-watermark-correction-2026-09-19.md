# Final shipping-label overlap and watermark correction

Keep all current label content and editable fields unchanged. The uploaded sheet shows a layout problem only; no content needs to be added.

## Changes

1. **Rebuild the header with protected rows**
   - Increase the header’s usable height and give the logo, company name, contact details, address, and CIN/GST/PAN row separate boundaries.
   - Resize each line to its available width without letting it enter another column or row.
   - Crop or mask stray tiny text embedded beneath the source logo so it cannot collide with the registration row.
   - Move the Shipping Address section down to begin only after the complete header and divider.

2. **Use the Graven logo as a full-label watermark**
   - Center one large, correctly proportioned Graven logo behind the whole label.
   - Reduce its opacity enough that every foreground line remains clear.
   - Draw the watermark first, then all text, dividers, QR code, and Google Play artwork above it.

3. **Protect every remaining section**
   - Keep strict vertical zones for customer details, invoice/parcel details, app artwork, and the thank-you line.
   - Ensure long customer names, addresses, invoice numbers, weights, and dimensions shrink or wrap only inside their own areas.
   - Preserve 4 labels per A4 sheet, per-box values, editable print-only fields, cut guides, and all existing artwork.

## Verification

- Generate the same GA-DSP26-0005 label and render the PDF to images.
- Inspect all four label positions at high resolution for collisions in the header, watermark, customer details, invoice strip, QR/badge area, and footer.
- Repeat with long values and 1, 4, and 6 boxes to confirm every page stays clean.

## Technical details

- Update only the shipping-label PDF layout and, if necessary, the prepared faded-logo artwork.
- No database or workflow changes.
