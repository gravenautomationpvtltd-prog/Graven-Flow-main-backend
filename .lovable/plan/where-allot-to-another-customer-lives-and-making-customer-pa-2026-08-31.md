# Where "allot to another customer" lives, and making customer-page quotations clickable

## 1. Where the option is today

The "allot the same quotation to another customer" action is **Duplicate Quotation** in the per-quotation actions menu (the "..." button) inside a lead's **Quotations** tab — the same menu shown in your screenshot. It is visible to super admins only. Choosing it opens a step where you keep or change the customer and tick which line items to copy (full or partial), then the builder opens pre-filled.

There is currently no such menu on the **Customer** page, which is why the copied quotation appears on the other customer but cannot be opened or edited from there.

## 2. The problem you hit

On the customer detail page, the quotations table only reacts to a click when the quotation is linked to a lead. A quotation duplicated to a customer who has no linked lead shows Lead "-" and the row does nothing — no view, no edit, no download.

## 3. What to change

Make the customer page quotations list fully actionable, independent of any lead:

- Clicking a row opens the quotation detail dialog (same dialog used from the lead page), instead of only navigating to a lead.
- Add a "..." actions menu on each row with: View Details, Edit Quotation, Duplicate Quotation (super admin only), Download Quotation PDF / Proforma Invoice / Delivery Challan.
- Keep the Lead cell as a separate link when a lead exists, so you can still jump to the lead.
- Add a "Create Quotation" button on the customer's quotations card so a customer with no lead can still get a fresh quotation.

## Technical notes

- Edit `src/components/customers/CustomerQuotationsSection.tsx`: fetch the selected quotation with `useQuotation`, and mount `ViewQuotationDialog`, `EditQuotationDialog`, `DuplicateQuotationDialog` and `CreateQuotationDialog` the same way `LeadQuotationsSection.tsx` does, passing `customerId` with `leadId` undefined.
- Gate Duplicate with `hasRole('super_admin')` from `useAuth`, matching the lead-side behaviour.
- Reuse `ensureItemsWithModelNumber` for the PDF downloads so model numbers print.
- No database or RLS changes.
