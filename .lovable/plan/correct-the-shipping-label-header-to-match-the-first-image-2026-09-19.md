# Correct the shipping-label header to match the first image

Use image 770 as the exact target and image 771 only as the current-state comparison. Change only the label header.

## Corrections

1. **Restore the target proportions**
   - Increase the header’s total height so the bottom divider sits at the same relative position as image 770.
   - Make the Graven logo larger and position it lower, matching the target.
   - Enlarge “Graven Automation PVT LTD” substantially and align it vertically with the centre of the logo.

2. **Match each row’s placement**
   - Keep the phone, email, and website row above the company name, with the same spacing as the target.
   - Position the two-line office address beneath the website area and align it like the target.
   - Move CIN, GST, and PAN lower and space them evenly across the width.
   - Move the pale red/orange divider lower, leaving the same clear space beneath the registration row.

3. **Prevent any new collision**
   - Reserve independent fixed areas for the contact row, company name, address, registration row, and divider.
   - Fit text only within its assigned width while preserving the target’s larger company-name appearance.
   - Move the Shipping Address section down by the same amount as the enlarged header; leave every other label section unchanged.

## Verification

- Generate GA-DSP26-0005 and compare the rendered header directly with image 770.
- Check logo size, company-name size, row baselines, address placement, registration spacing, and divider position.
- Inspect all four label positions and a six-box second page at print resolution for clipping or overlap.

## Technical details

- Update only the header dimensions and the following section’s starting position in the shipping-label PDF generator.
- Reuse the current clean logo and all existing text values.
- No database, form, watermark, parcel-detail, or workflow changes.
