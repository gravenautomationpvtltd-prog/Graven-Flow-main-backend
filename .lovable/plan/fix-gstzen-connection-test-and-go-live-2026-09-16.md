# Fix GSTZen connection test and go live

## What I found
Your GSTZen setup is actually correct:
- The API key is active.
- GSTIN 07AAKCG1025G1ZX is added and the permissions toggles (Filer, Writer, Reader, Generator) are on.
- When I send a real invoice-shaped request, GSTZen accepts it and replies "Document must have at least one line item" — meaning the key and GSTIN are recognized.

The red message in Settings is wrong because the app's "Test connection" probe is too small: it only sends `{Version, connection_test: true}`. GSTZen replies to that with 404 + "The requested GSTIN is not present in your GSTZen account.", and the app misreads that as a setup failure.

## What I'll change in the app
1. `supabase/functions/test-gst-connection/index.ts`
   - Send a minimal valid NIC-format JSON skeleton (Version, TranDtls, DocDtls, SellerDtls, BuyerDtls) with no line items instead of the `{connection_test: true}` probe.
   - Classify GSTZen validation replies such as "Document must have at least one line item" as a successful connection.
   - Keep clear detection for a genuinely bad token or a truly missing GSTIN.
   - Log the raw response for support.

2. `src/components/settings/GstApiSettings.tsx`
   - Show the actual GSTZen reply in the test result area so you can see what is really happening.
   - Add a note: if GSTZen says the document needs line items, the connection is working.
   - Clarify that Sandbox Mode only affects the shared demo key; once your real GSTZen key is saved, the test talks to GSTZen's live endpoint.

## One thing to check in GSTZen before generating a real IRN
The connection test only proves the API key and GSTIN are linked. To actually get an IRN, GSTZen still needs the IRP API username and password from the government portal. Please go to **GSTZen → E-Invoice & E-Waybill Configuration** and enter the API username/password you created on einvoice1.gst.gov.in (the one shown in your PAN/GSTIN Access screenshot, starting with `API_b9b9b6ab...`).

## Go-live steps
1. I deploy the fixed test.
2. You press **Test connection** in Settings → E-Invoice — it should turn green.
3. You confirm the IRP username/password are saved in GSTZen's E-Invoice & E-Waybill Configuration.
4. We pick one small order you are actually dispatching, create its invoice, and press **Generate e-invoice / e-way bill** to get a real IRN.
   - This produces a legally valid IRN that can normally only be cancelled within 24 hours, so I will confirm the exact order with you before running it.
5. I check the IRN, acknowledgement number, signed QR and e-way bill number are saved back on the invoice/dispatch.
6. I confirm the Accounts orders screen shows the live statuses.
