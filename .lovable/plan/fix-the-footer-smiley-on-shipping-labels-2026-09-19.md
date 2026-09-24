# Fix the footer smiley on shipping labels

## Problem
The "THANK YOU FOR CHOOSING US!" smiley on the shipping label is currently drawn programmatically (a circle + dots + a dashed arc for the mouth). The dashed-arc trick renders as a broken/odd shape instead of a clean smile.

## Fix (one element only — everything else stays untouched)
1. Extract the smiley from the uploaded reference image (`image-776.png` — classic yellow smiley): trim the white background to transparent, crop to the circle's bounds, and embed it as a base64 PNG in `src/lib/shipping-label-clean-mark.ts` (e.g. `SMILEY_FACE`), same approach used for the Graven logo.
2. In `src/lib/shipping-label-pdf.ts`, delete the hand-drawn `drawSmiley()` helper and instead `doc.addImage(SMILEY_FACE, ...)` at the same position and size (r = 2.6mm → ~5.2mm square) beside "THANK YOU FOR CHOOSING US!".

## Verification
- Generate a fresh label sheet from dispatch GA-DSP26-0005 with Playwright, render the PDF, and visually confirm the footer shows the clean yellow smiley on all labels with no other layout change.
- Confirm build OK.
