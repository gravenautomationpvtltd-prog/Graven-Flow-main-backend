# Go live with GSTZen e-invoicing

The connection test is now green: GSTZen accepts your API key and GSTIN, and only asks for line items — which is exactly what a real invoice will carry.

## Step 1 — One thing left in GSTZen (you)

In your GSTZen account, open **E-Invoice & E-Waybill Configuration** and enter the IRP API username and password you created on einvoice1.gst.gov.in (the API user shown as `API_b9b9b6ab…`). Save there. Without this, GSTZen cannot talk to the government portal on your behalf.

## Step 2 — Check the seller details match

Before a live run, the company details used on the invoice must match the GSTIN's registration:

- GSTIN 07AAKCG1025G1ZX is a Delhi registration, so state must be Delhi (code 07) with a matching city, address and pincode.
- Every invoice line needs an HSN code of at least 6 digits. Shorter codes are rejected by the portal.

I will check these and tell you exactly what to correct.

## Step 3 — One real invoice, with your go-ahead

We pick one small order you are genuinely dispatching. Then:

1. Create the invoice from that order in Accounts.
2. Press "Generate e-invoice / e-way bill".
3. GSTZen files it with the government and returns the IRN, acknowledgement number and signed QR code.

This is a real, legally valid filing, cancelable only within 24 hours. I will confirm the exact order with you before pressing anything.

## Step 4 — Confirm and switch to everyday use

- Verify the IRN, acknowledgement number and QR are saved on the invoice, and the e-way bill number on the dispatch.
- Confirm the Accounts orders list shows the live statuses.
- Turn Sandbox Mode off and leave automatic generation on, so future ready-to-dispatch orders are handled in one click.

## Notes

- No further code changes are expected; the screens and the GSTZen integration are already built and tested.
- If the live run returns a validation error (address, HSN, buyer GSTIN), I fix the data and retry — no filing happens until the document passes validation.
