# First live e-invoice: Device & Controls (SO-20260317-001)

Order total ₹10,325 — below the ₹50,000 e-way bill threshold, so this run generates the e-invoice (IRN) only.

## What is already fine

- Seller: Graven Automation, GSTIN 07AAKCG1025G1ZX, Kirti Nagar, New Delhi, 110015.
- Buyer: Device & Controls, GSTIN 19AOBPD5561Q1ZI, Kolkata 700045 — the state comes from the GSTIN, so "west bengal" spelling is not a problem.
- This will be an inter-state supply, so IGST at 18%.

## Step 1 — Small data fixes

1. Set the customer's city to "Kolkata" (currently blank).
2. Add HSN codes to the two invoice lines — the portal rejects lines without them:
   - `6ES7214-1BD23-0XB8` (Siemens PLC) → **853710**
   - `freight (by Air)` → service code **996511**

Please confirm these two codes are the ones you use on your paper invoices. If your accountant uses different codes, tell me and I will use those.

## Step 2 — Handle service lines correctly

Freight is a service, not goods. The e-invoice builder currently marks every line as goods. Small change: any line whose code starts with 99 is sent as a service line.

## Step 3 — Create the invoice

Create the invoice for this order from the Accounts screen. It carries both lines, 18% IGST, total ₹10,325.

## Step 4 — Generate the real IRN

Press "Generate e-invoice". GSTZen files it with the government and returns the IRN, acknowledgement number and signed QR code, saved on the invoice.

This is a real, legally valid filing and can only be cancelled within 24 hours. I will do this only after you confirm the codes in Step 1.

## Step 5 — Confirm and switch to everyday use

- Check the IRN, acknowledgement number and QR are on the invoice, and the Accounts list shows the live status.
- Turn Sandbox Mode off in Settings and leave automatic generation on, so future ready-to-dispatch orders are one click.

## Note for later

Most other products have no HSN code saved. E-invoicing needs one on every line, so the catalog will need HSN codes filled in — a separate task I can help plan once this first invoice is through.
