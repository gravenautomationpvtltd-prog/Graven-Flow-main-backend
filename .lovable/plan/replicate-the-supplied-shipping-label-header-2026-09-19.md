# Replicate the supplied shipping-label header

The first image shows the current header. Rebuild only that area to match the second supplied image; keep the shipping address, parcel details, watermark, app artwork, and four-label A4 layout unchanged.

## Changes

1. **Match the second image’s header structure**
   - Keep the solid red bar across the top.
   - Place the clean Graven mark at the left at the same relative size.
   - Put the phone, email, and website in one compact top contact row.
   - Place “Graven Automation PVT LTD” prominently below the contact row, aligned beside the logo.
   - Keep the two-line office address at the right without colliding with the company name.
   - Put CIN, GST, and PAN in one evenly spaced bottom row.
   - Add the thin pale red-to-orange divider shown at the bottom of the reference header.

2. **Protect the header from overlap**
   - Give the contact row, company/address row, registration row, and bottom divider fixed vertical areas.
   - Fit long text only within its own area and prevent it from crossing into neighbouring content.
   - Use the existing clean logo artwork so no stray embedded text appears around the mark.

3. **Preserve the rest of the label**
   - Do not change any editable values, per-box weight or dimensions, invoice details, QR code, Google Play artwork, watermark placement, cut guides, or pagination.

## Verification

- Generate GA-DSP26-0005 with four labels and compare the header side-by-side with the second supplied image.
- Render at print resolution and inspect all four header positions for alignment, clipping, and overlap.
- Repeat with six boxes to confirm the second page remains correct.

## Technical details

- Update only the header drawing in the shipping-label PDF generator.
- Reuse the current clean Graven mark and existing company details.
- No database or workflow changes.
