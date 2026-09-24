# Save shipping labels so they can be downloaded again

Once labels are made for a dispatch, the file and the details you typed are kept with that dispatch and shared with the team. No one has to fill the form or regenerate unless something changes.

## What you get

**First time (no labels yet)**
- Shipping Labels opens the form exactly as today, pre-filled from the order. Button reads "Generate labels".
- On generate: the PDF downloads as usual, and a copy plus all the typed details are saved against the dispatch.

**Next time (labels already made)**
- Shipping Labels opens a short summary card instead of the form: number of boxes, invoice no., who made it and when.
- Two buttons: **Download labels** (gets the exact same file instantly, no regeneration) and **Edit details**.
- **Edit details** opens the same form with every previously saved value already in it — company, address, contact person and number, invoice no. and value, box count, and each box's weight and dimensions.
- Saving the edit makes a fresh PDF, downloads it, and replaces the stored file and details.

Everything stays print-only: nothing typed here changes the order, customer, or invoice records.

## Technical details

- New table `public.shipping_labels`: `id`, `tenant_id`, `dispatch_id` (unique, FK), `box_count`, `label_data` jsonb (the full form state incl. per-box rows), `file_name`, `file_url`, `generated_by`, `generated_at`, `updated_at`. GRANTs for `authenticated` (select/insert/update/delete) and `service_role`; RLS enabled with tenant-scoped policies matching the existing dispatch tables. `tenant_id` set via `requireTenantId()`.
- PDF file stored in the existing `dispatch-documents` bucket under `${dispatchId}/shipping-labels-...pdf`; regeneration overwrites with `upsert`.
- `src/lib/shipping-label-pdf.ts`: add an option to return the jsPDF blob instead of only calling `save()`, so the same render can be both downloaded and uploaded. Layout, artwork, and label content are untouched.
- New `src/hooks/useShippingLabels.ts`: `useShippingLabel(dispatchId)` and `useSaveShippingLabel()` (upload + upsert row + invalidate).
- `src/components/dispatch/ShippingLabelDialog.tsx`: add a saved-state view (summary + Download + Edit) and hydrate the form from `label_data` when it exists, falling back to the current dispatch/invoice prefill when it doesn't. Download uses the existing `downloadFile` helper.

## Verification

Generate labels on a dispatch, close and reopen the dialog, confirm Download returns the same PDF, then Edit and confirm every field comes back filled.
