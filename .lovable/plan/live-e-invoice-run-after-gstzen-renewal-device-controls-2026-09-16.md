# Live e-invoice run after GSTZen renewal (Device & Controls)

Order SO-20260317-001, Device & Controls, Kolkata, total ₹10,325 — below the ₹50,000 e-way bill threshold, so this run produces the e-invoice (IRN) only.

## Step 1 — Confirm the subscription is really active

Run the safe connection test with your saved key and GSTIN. It never files anything.

- Expected reply: a validation message about line items (means key, GSTIN and subscription are all fine).
- If it still says the subscription expired, stop and wait for GSTZen to activate the renewal.

## Step 2 — Re-create the invoice

The earlier invoice GA-INV26-0002 was rolled back when the request was refused. Create it again from the order in Accounts, carrying:

- Siemens PLC `6ES7214-1BD23-0XB8` — HSN 853710
- Freight (by Air) — service code 996511
- 18% IGST (inter-state), total ₹10,325

The customer's city (Kolkata) and the seller details are already correct.

## Step 3 — Generate the real IRN

Press "Generate e-invoice". GSTZen files it with the government and returns the IRN, acknowledgement number and signed QR code, saved onto the invoice.

This is a real, legally valid filing and can only be cancelled within 24 hours.

## Step 4 — Confirm and switch to everyday use

- Check the IRN, acknowledgement number and QR are stored on the invoice and the Accounts list shows the live status.
- Turn Sandbox Mode off in Settings, leaving automatic generation on, so future ready-to-dispatch orders are one click.

## Note for later

Most catalog products still have no HSN code. Every e-invoice line needs one, so a bulk HSN fill-in is the next task once this first invoice is through.
