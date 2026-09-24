# Use Play Store URL for shipping label QR code

Change the QR code target printed on shipping labels from the Graven website to the Google Play Store app URL provided: `https://play.google.com/store/apps/details?id=com.gravenautomation`.

## What changes
- Update `QR_TARGET` in `src/lib/shipping-label-pdf.ts` to the Play Store URL.
- Regenerate a saved test label to verify the QR encodes the new URL and scanns correctly.
- No other label layout, artwork, or dialog logic changes.

## Verification
- Generate a fresh shipping label sheet and scan/inspect the QR code to confirm it resolves to the Play Store URL.
- Check that existing saved labels still download their previously stored PDFs (no retroactive change to already saved files).
