# Branded shipping labels matching your format, with editable fields

Redesign the shipping labels to match the sample you shared, and make every key field editable before printing.

## What changes

**1. New label design (matches your image)**

Each label, 4 per A4 sheet with cut guides:

- Top: red bar, Graven logo + "Graven Automation PVT LTD" in brand red, contact line (+91 7428828011, 7428828008 · info@gravenautomation.com · www.gravenautomation.com), company address, and CIN / GST / PAN row — same details already used in your invoices
- "Shipping Address" heading in red with "1 of 3" style box counter on the right
- Customer company name in big bold type, then full address, contact person and contact number
- Bottom strip: Invoice No + Invoice Value on the left, Weight (KG) + Dimensions (CM) on the right
- Footer: "PROCUREMENT, MADE EASIER. DOWNLOAD THE APP NOW" with a Google Play badge and a QR code (scans to the app page / website), then "THANK YOU FOR CHOOSING US!"

**2. Editable fields in the Shipping Labels dialog**

When you click Shipping Labels on a dispatch, a form opens pre-filled from the order's data, and you can change anything before generating:

- Company name
- Shipping address
- Contact person name
- Contact number
- Number of boxes
- Weight (KG)
- Dimensions (CM, e.g. 23×34×12)
- Invoice No. (pre-filled from the dispatch's order invoice when one exists)
- Invoice value (₹)

The PDF is generated from what you see in the form — edits only affect the printed labels, not the order itself.

## Technical details

- Rewrite `src/lib/shipping-label-pdf.ts` to the new layout; reuse the existing logo (`src/assets/graven-logo.png`) and company constants from `quotation-pdf.ts`
- Add the `qrcode` package to draw the QR code into the PDF (jsPDF alone can't make QR codes)
- Google Play badge drawn as a small rounded badge in the PDF (vector triangle icon + text — no external image needed)
- Rewrite `src/components/dispatch/ShippingLabelDialog.tsx` into a two-section form (label details + boxes) with validation; nothing is saved back to the database
- No database changes; labels remain print-only

## Verification

Generate labels from a real dispatch, open the PDF as an image, and visually compare against your sample sheet.
