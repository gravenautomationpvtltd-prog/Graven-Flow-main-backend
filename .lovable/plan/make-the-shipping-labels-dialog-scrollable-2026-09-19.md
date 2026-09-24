# Make the Shipping Labels dialog scrollable

## Problem
The Shipping Labels form (company, address, contact, invoice, weight, dimensions, boxes) is taller than the screen. The dialog has no vertical scroll, so the lower fields and the generate button can't be reached on smaller windows.

## Fix
In `src/components/dispatch/ShippingLabelDialog.tsx`:
- Cap the dialog content height at ~85% of the viewport (`max-h-[85vh]`).
- Make the form area scroll vertically (`overflow-y-auto`), keeping the header and the footer (sheet summary + Cancel / Download buttons) visible at all times.
- Check the other dispatch dialogs (View Dispatch, Create Dispatch) for the same pattern and apply the same fix where missing.

## Verification
Open a dispatch → Shipping Labels at a small viewport, confirm the form scrolls and the download button is reachable.
