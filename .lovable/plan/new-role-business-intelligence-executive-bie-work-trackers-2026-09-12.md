# New role: Business Intelligence Executive (BIE) + work trackers

## What you'll get

A new staff role called **Business Intelligence Executive (BIE)**. People with this role get a focused workspace — not the whole CRM — where they can:

1. **Products** — add new products and edit existing ones (model number, description, brand, pricing), the same dialogs your team already uses.
2. **Vendor Registrations** — a tracker for "which companies/portals we are registering as a vendor" (e.g. GeM, railway, PSUs, large OEMs): company name, portal, status (not started / in progress / submitted / approved / rejected), login credentials reference, validity date, notes.
3. **Tenders** — a tender tracker: tender number, issuing authority, description, estimated value, submission deadline, status (identified / documents being prepared / submitted / awarded / lost), awarded value and date.
4. **Supplier Onboarding** — the existing supplier application list, so the data entry person can fill in new supplier details and documents and move them along the onboarding steps.
5. **Website Listings** — record every product/company listing made on external websites and portals: website, listing title/reference, URL, listed date, status, assigned employee, last updated date and notes. Before starting work, they can search this register to avoid listing the same item twice.
6. **Miscellaneous tasks** — managers can assign them anything through the existing Tasks system (it already works per user), so odd jobs show up on the same screen.

Suggested miscellaneous work this role can also absorb (uses existing screens, no new build): updating price lists when new ones arrive, uploading supplier documents/certificates, filling in missing customer GST/address details, and cleaning duplicate entries you flag.

## How it works for the user

- You create or edit an employee in **Settings → Users** and give them the **Business Intelligence Executive (BIE)** role (it's a checkbox like the other roles).
- **BIE Staff dashboard**: each employee sees only their own assigned registrations, tenders, supplier onboarding, website listings, tasks and personal performance. They cannot open or change another BIE employee's work.
- **BIE Manager dashboard**: the manager sees every BIE employee, workload, deadlines, completed work and performance; can open any employee's dashboard, create or edit their records, assign/reassign work and update statuses.
- When BIE staff sign in, their sidebar shows a **BIE Workspace** section with: Products, Vendor Registrations, Tenders, Supplier Onboarding, Website Listings, My Tasks and My Performance. They don't see leads, quotations, orders, or money screens.
- BIE managers and admins get the same workspace plus **Team Dashboard** and **Assign Work**.

## Technical details

- **Migration**: add separate `bie` and `bie_manager` roles; create `vendor_registrations`, `tenders` and `website_listings` tables with `assigned_to`, `assigned_by`, timestamps and tenant ownership. Add required `GRANT`s and RLS: BIE staff can read/write only rows assigned to themselves; BIE managers/admins can read/write and reassign all rows in their tenant. Add products UPDATE/INSERT access for both BIE roles; regenerate types.
- **Role plumbing**: extend `useAuth` with `isBIE` and `isBIEManager`; add role-specific BIE navigation and protect every BIE page by role.
- **New pages**:
  - `src/pages/data-entry/VendorRegistrations.tsx` — table + add/edit dialog, status badges, filters.
  - `src/pages/data-entry/Tenders.tsx` — table + add/edit dialog, status pipeline including **Awarded**, deadline highlighting.
  - **BIE Staff dashboard** — personal counts, due work, completed work, turnaround time and status breakdown.
  - **BIE Manager dashboard** — employee scorecards, workload and overdue counts, team totals, employee drill-down and assignment/reassignment controls.
  - Website Listings — searchable table + add/edit dialog, direct link to the live listing, duplicate warning when the same website and listing reference already exist.
- **Reused, not rebuilt**: product add/edit dialogs, supplier onboarding screens, the Tasks system (already per-user), existing UI components and hooks patterns.
- Lazy routes added under `/bie/...` in `App.tsx`.

## Verification

- `npx tsgo --noEmit` clean and `build OK` in the build log.
- Playwright: verify both roles separately. Staff must see only their own work/performance and be blocked from another employee's records. Manager must see all BIE staff, assign/reassign work, edit an employee's records and view team/individual performance. Also verify duplicate-listing prevention.
