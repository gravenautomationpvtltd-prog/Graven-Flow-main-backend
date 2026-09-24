# Shipping labels for parcels (4 per A4 sheet)

Add a printable shipping label PDF to every dispatch, laid out four labels per A4 page so they can be cut and pasted on boxes.

## What you get

- A new **Shipping Labels** button next to Packing List and Download PDF in the dispatch view.
- A small dialog asking **how many boxes** are in this shipment (default 1). Each box gets its own label, numbered "Box 1 of 3", "Box 2 of 3", and so on.
- The PDF puts **4 labels on one A4 sheet** (2 across, 2 down) with light cut guides. More than 4 boxes simply continues on the next page.

## What's on each label

- FROM: Graven Automation, with the branch line (same source the delivery note uses).
- TO: customer company name, contact person, full shipping address, phone — in large, easy-to-read type.
- Dispatch number (bold, largest line) and dispatch date.
- Courier name and tracking number when recorded.
- Box number ("Box 2 of 4") and total shipment weight in KG when weights exist on the dispatch lines.
- Handling note: "Handle with care — Electronics".

No prices ever appear on a label, same rule as the packing list.

## Technical notes

- New file `src/lib/shipping-label-pdf.ts` exporting `generateShippingLabelsPdf(dispatch, boxCount)`, built with jsPDF on A4 (210x297mm). Label cell = 105x148.5mm with a 6mm inner padding; a drawn border plus dashed centre lines act as cut marks.
- Reuses the `Dispatch` type and the address fallback logic already in `src/lib/dispatch-pdf.ts` (shipping_address, else customer address/city/state/pincode) and the weight rollup from `src/lib/packing-list-pdf.ts` (KG only).
- Long company names and addresses go through `splitTextToSize`, with font size stepping down for very long names so nothing overflows the cell.
- New `src/components/dispatch/ShippingLabelDialog.tsx` (box-count input + Generate), mounted from `src/components/dispatch/ViewDispatchDialog.tsx`; no backend or schema changes.
- File saved as `Shipping-Labels-<dispatch_number>.pdf`.
