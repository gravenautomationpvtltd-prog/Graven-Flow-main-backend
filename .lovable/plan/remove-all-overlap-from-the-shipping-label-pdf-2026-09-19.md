# Remove all overlap from the shipping-label PDF

The uploaded PDF confirms several text blocks are colliding. Rework each label into strictly separated sections so content can wrap without entering the next section.

## Changes

1. **Rebuild the header spacing**
   - Give the red bar, logo/company name, contact/address details, and CIN/GST/PAN their own fixed rows.
   - Reduce text only when necessary and clip each row to its allotted width so the right-side details and registration numbers cannot run into one another.
   - Keep the genuine Graven logo and remove any text drawn underneath it.

2. **Make the address area content-aware**
   - Reserve independent space for the Shipping Address heading, company name, address, contact person, and contact number.
   - Wrap long company names and addresses within controlled line limits, with consistent line spacing.
   - Move later sections down based on the actual rendered height instead of relying on overlapping fixed coordinates.

3. **Protect the invoice and parcel-details strip**
   - Place Invoice No./Value and Weight/Dimensions inside fixed left and right columns.
   - Constrain long values to their column and shrink them when needed, preventing contact details from touching the strip.

4. **Keep the footer isolated**
   - Reserve a fixed footer zone for the slogan, Google Play badge, QR code, watermark, and thank-you line.
   - Keep the faint watermark behind blank space only, never behind important text.
   - Preserve four label positions per A4 sheet and one label per box, including each box's own weight and dimensions.

## Verification

- Generate labels using the same dispatch and values shown in the uploaded PDF.
- Test short and long company names, three-line addresses, long invoice numbers, and 1, 4, and 6 boxes.
- Render every PDF page to images and visually confirm no text, logo, divider, watermark, QR code, or parcel detail overlaps.

## Technical details

- Update only the shipping-label PDF layout calculations.
- Use measured text widths/heights, bounded wrapping, and fixed section boundaries rather than free-running coordinates.
- No database changes; editable label values remain print-only.
