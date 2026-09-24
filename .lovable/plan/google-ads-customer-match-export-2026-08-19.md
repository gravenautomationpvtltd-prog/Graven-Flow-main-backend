# Google Ads customer-match export

Add a second export option on the Customers page that produces a CSV in the Google Ads Customer Match upload format. The existing "Export All" CSV stays exactly as it is.

## What changes

The current single "Export All" button becomes a small dropdown with two entries:
- **Standard CSV** — today's export, unchanged (company, contact, phone, email, address, GST, notes).
- **Google Ads (Customer Match)** — the new format.

Both respect the filters currently applied on the page (search, B2B/B2C, assigned-to), same as today.

## Google Ads file format

Columns, in this order: `Email, Phone, First Name, Last Name, Country, Zip Code`

Row rules:
- **Email** — `customers.email`, lowercased and trimmed. Rows with no email and no usable phone are skipped.
- **Phone** — E.164 digits with the India country code: the stored 10-digit number prefixed with `91` (e.g. `9876543210` → `919876543210`). Numbers that aren't 10 digits after normalisation are left blank rather than exported wrong.
- **First / Last Name** — split from `contact_person` on the first space; single-word names go entirely into First Name, Last Name blank. Blank when no contact person is stored.
- **Country** — `IN` for every row (no country column exists in the data; all customers are Indian).
- **Zip Code** — `customers.pincode`, digits only, blank if missing.
- Customers with `outreach_opted_out = true` or `cst_dnc = true` are excluded, so opt-outs aren't uploaded to Google.

File name: `google-ads-customer-match_<date>.csv`.

## Technical notes
- New `exportCustomersForGoogleAds(customers)` in `src/lib/csv-utils.ts`, reusing the existing quoting logic and `downloadCSV`.
- Phone handling reuses the 10-digit normaliser in `src/lib/phone-utils.ts`, then adds the `91` prefix.
- `src/pages/Customers.tsx`: wrap the existing export button in a `DropdownMenu`; `handleExportAll` gains a `format` argument and picks the formatter and filename. No changes to fetching, filters, or any other page behaviour.
