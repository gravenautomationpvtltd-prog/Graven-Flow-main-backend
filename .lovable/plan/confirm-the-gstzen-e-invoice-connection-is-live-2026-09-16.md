# Confirm the GSTZen e-invoice connection is live

## What I found in your settings

- GSTIN saved: 07AAKCG1025G1ZX
- Provider: GSTZen
- API key: saved (a real key of yours, not the shared demo key)
- Sandbox Mode: still switched ON
- Auto e-invoice and auto e-way bill: both ON
- Last saved: 24 Aug 2026

So the credentials are in place. Two things are still unconfirmed: whether the key is accepted by GSTZen, and whether you want to stay in sandbox or go live. No invoice has an IRN yet — all recent invoices show "pending".

## Plan

1. **Connection test (safe).** Send one authentication-only request to GSTZen with your saved key and GSTIN and report exactly what comes back: accepted, wrong key, or GSTIN not registered for API access. Nothing is filed with the government in this step.
2. **Fix whatever the test reveals.** Typical causes: key copied with trailing spaces, GSTIN not yet mapped inside your GSTZen account, or API access on the government portal not yet registered against GSTZen (Cloudzen Software Labs).
3. **One end-to-end run.** Pick one order that is ready to dispatch, create its invoice, press Generate IRN, and confirm a real IRN, acknowledgement number and QR code are saved on the invoice, then the e-way bill number on the dispatch.
4. **Decide the live switch.** If the run succeeds, turn Sandbox Mode off so every future generation is legally valid. Auto-generation stays on, so new ready-to-dispatch orders get their IRN automatically.
5. **Tidy up.** Remove the leftover test invoice created during earlier testing.

## Important before step 3

An IRN generated with Sandbox Mode off is a real government filing that can only be cancelled within 24 hours. For the first end-to-end run I suggest using a genuine small order you are actually dispatching, so nothing has to be cancelled afterwards.

## Technical notes

- Settings live in `gst_api_settings`; the GSTZen key is stored in `client_id`, and `sandbox_mode` currently makes the functions fall back to the shared demo token when no key is present — with your key saved, your key is used.
- Edge functions `generate-einvoice` and `generate-eway-bill` already post plain NIC-format JSON to GSTZen (`post-einvoice-data/einvoice-json/` and `ewbapi/generate/`) with `Token` and `gstin` headers.
- Step 1 adds a small "Test connection" action on the E-Invoice settings screen so you can re-check the credentials any time without generating a document.
