# Fix the shipping-label logo only

- Replace the screenshot-derived header mark with the existing complete, transparent Graven logo artwork.
- Preserve the logo’s square proportions so no top, side, or lower section is clipped or stretched.
- Adjust only the logo’s header size and position to fit the existing reserved area.
- Leave all header text, contact details, registrations, divider, label body, watermark, and four-per-page layout unchanged.
- Generate and visually inspect a fresh shipping-label PDF to confirm the complete logo appears on all four labels without overlap.

## Technical detail

The current header uses an embedded crop whose source proportions are `110 × 89`; the replacement will use the project’s full `400 × 400` transparent logo and render it at equal width and height.
