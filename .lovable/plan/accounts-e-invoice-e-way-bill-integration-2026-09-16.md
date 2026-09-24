# Accounts E-Invoice & E-Way Bill Integration

## Goal
When Procurement/Dispatch marks a sales order as **Ready to Dispatch**, the order automatically surfaces in the Accounts section with one-click generation of the government e-Invoice (IRN) and e-Way Bill — without leaving Graven OneDesk.

## What we already have
- `sales_orders` has a `ready_to_dispatch` status; 22 orders currently have it.
- `invoices` and `dispatches` tables already exist; invoices have IRN fields (`irn`, `irn_date`, `ack_number`, `qr_code_data`, `einvoice_status`).
- Edge functions `generate-einvoice` and `generate-eway-bill` exist, but they point to the old IRIS sandbox/prod URLs and a non-government GSP URL.
- A `GstApiSettings` screen exists under Settings, storing `gstin`, `gsp_provider`, `api_username`, `api_password`, `sandbox_mode`, and auto toggles.
- `FinanceOrderDetailDialog` already shows an **E-Invoice & E-Way Bill** button for `ready_to_dispatch` orders.

## Key design decisions

### 1. Trigger from order status, not dispatch
The source of truth is `sales_orders.status = 'ready_to_dispatch'`. When that happens:
- Accounts sees the order in the **Orders** tab with a flag "E-Invoice pending".
- If no tax invoice exists yet, Accounts can create it first (auto-draft with customer + order value + items).
- Then Accounts clicks **Generate E-Invoice / E-Way Bill**.

### 2. Provider mode: direct government IRP
Current functions are wired for the old IRIS endpoint and a third-party GSP URL. For direct government APIs we will:
- Add a provider selector: **Direct Government IRP** vs existing GSP options.
- For direct IRP: choose one of the 6 portals (`einvoice1.gst.gov.in` … `einvoice6.gst.gov.in`) as the base URL.
- Store **Client ID**, **Client Secret**, **Username**, **Password** in `gst_api_settings`.
- Switch the edge functions to the official IRP endpoints and implement the required IRP authentication + SEK encryption flow.

Note: direct IRP APIs require request encryption using the portal-provided public key and SEK decryption. This is more involved than a GSP wrapper; the plan includes it, but switching to a GSP (GSTZen, ClearTax, Masters India) is faster and avoids IP whitelisting.

### 3. Accounts Orders tab changes
- Sub-tab or badge filter: **Ready to Dispatch / E-Invoice pending**.
- Each row shows: order number, customer, order value, payment status, invoice status, e-invoice status, e-way bill status.
- Row actions: **Create Invoice** (if missing), **Generate IRN**, **Generate E-Way Bill**.
- Bulk selection not needed in the first phase.

### 4. One-click generation dialog
Reuse and extend `GenerateEInvoiceDialog`:
- If invoice missing → prompt to create invoice first.
- If IRN missing → show **Generate E-Invoice** button.
- E-Way Bill section (can be skipped or done together): transporter name, transporter GSTIN, vehicle number, mode, distance.
- After success, store IRN/QR/ack number on the invoice and e-way bill number/status on the dispatch/order.

### 5. E-Way Bill via IRN
Government e-Way Bill can be generated using the IRN + Part-B details. The edge function will:
- Authenticate to the IRP/e-Way Bill system.
- Call the e-Way Bill generation API with IRN, transporter, and vehicle details.
- Store the resulting `eway_bill_number` and `eway_bill_status` on the dispatch record.

### 6. Settings updates
- Rename "GSP Provider" to "E-Invoice Provider".
- When **Direct Government IRP** is selected, show:
  - IRP portal pick list (einvoice1…einvoice6.gst.gov.in).
  - Client ID, Client Secret, Username, Password fields.
  - Sandbox / Production toggle (sandbox credentials only for testing).
- Validate GSTIN is 15 characters.
- Show a configuration status card: configured / missing credentials / test connection.

### 7. Auto-generation toggles (optional)
- `auto_generate_einvoice`: when invoice is created, attempt IRN automatically.
- `auto_generate_eway_bill`: when e-invoice is generated and vehicle details exist, attempt e-way bill automatically.
First release will be manual one-click; toggles remain available for later automation.

## What you need from the government portal
1. Confirm GSTIN is enabled at https://einvoice.gst.gov.in.
2. Register/login at one of: `einvoice1.gst.gov.in` … `einvoice6.gst.gov.in`.
3. Complete OTP verification of the registered mobile/email.
4. Create API credentials (Client ID + Client Secret) inside the IRP portal.
5. Whitelist the static outbound IP used by the app (this is the main blocker for direct IRP from Lovable Cloud; a GSP removes this requirement).

## Technical changes
- Database: add columns on `gst_api_settings` for `client_id`, `client_secret`, `irp_base_url`, and keep existing username/password fields.
- Edge functions:
  - Update `generate-einvoice` to direct IRP endpoints with proper auth + SEK encryption.
  - Update `generate-eway-bill` to use IRN-based e-Way Bill API.
- Frontend:
  - Extend `GstApiSettings` for provider mode, IRP portal, client credentials.
  - Extend `FinanceOrdersTab` to show e-invoice/e-way bill states and actions.
  - Extend `GenerateEInvoiceDialog` to handle missing invoice and transporter details.
  - Add a small **Create Invoice** helper in Accounts for ready-to-dispatch orders.

## Out of scope for this plan
- Generating the original tax invoice from scratch inside Accounts (we will reuse existing invoice creation logic or create a lightweight version).
- QR code printing on invoice PDFs.
- E-invoice cancellation / credit notes.

## Verification
- Playwright walkthrough: mark an order ready to dispatch → open Accounts Orders tab → create invoice → generate IRN → generate e-way bill → confirm IRN and e-way bill number stored.

## Open question before build
Do you want to proceed with **direct government IRP** (requires Client ID/Secret, IP whitelisting, and the SEK encryption flow) or use a **GSP like GSTZen** (simpler credentials, no IP whitelisting)? If direct, which of the six IRP portals will you register on?
