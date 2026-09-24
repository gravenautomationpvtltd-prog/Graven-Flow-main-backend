# Know who worked on each product, and assign product work in bulk

## What you get

### 1. Who added / last changed each product
Every product records the person who created it and the person who last changed it, with the date.

- Two new columns in the product list: **Added by** and **Last edited by** (with "2 days ago" style timing).
- Past products are back-filled from the existing activity history, so older entries are not blank. Where no history exists, it shows "Unknown".
- The product page shows the same, plus a short "who changed what, when" history.

### 2. Filter by person
The product list gets two extra filters next to search and status:

- **Added by** — pick any team member (BIE manager sees everyone; a staff member can quickly pick "Me").
- **Last edited by** — same list.
- Combined with the existing search, status and ready-stock filters, so "everything Ravi added this month that is still Active" is one click.

### 3. Bulk assignment of product work
Checkboxes on every row plus a "select all on this page" box. With rows selected, a bar appears with:

- **Assign work** — choose a team member, a task type (**Update pricing**, **Add details**, **Verify**, **Mark discontinued/obsolete**, **Remove**), a due date, priority and a note. One assignment record is created per selected product.
- **Bulk edit** — set brand, status, GST rate or unit on all selected products in one go.
- **Bulk delete** — Active products only, with a confirmation listing how many will be removed (super admin / manager only).

Assignments show up as a new **Products** tab in the BIE Work Register, with the same table treatment as the other work types: status, priority, due date, overdue highlighting, assignee filter and history. Staff see only their own; the manager sees everyone's and can reassign. Each assigned product links straight to its product page, and finishing the work is a one-click status change.

The BIE dashboards count product assignments alongside registrations, tenders and listings, so "open work / due this week / overdue / completed" stays accurate.

## Technical notes

- Migration:
  - `products`: add `created_by uuid`, `updated_by uuid` (both nullable), plus a trigger `stamp_product_actor()` on insert/update setting them from `auth.uid()`; indexes on both.
  - Backfill from `activity_logs` where `entity_type = 'product'`: earliest `create` row → `created_by`, latest `update`/`create` row → `updated_by`.
  - New `public.product_assignments` (`id`, `tenant_id`, `product_id` FK products, `task_type text check in (update_pricing, add_details, verify, mark_legacy, remove)`, `status text default 'assigned'` (`assigned|in_progress|completed|blocked`), `priority` (reuse the BIE priority values), `due_date date`, `note text`, `assigned_to uuid`, `assigned_by uuid`, `completed_at`, `created_at`, `updated_at`).
  - GRANTs: `SELECT, INSERT, UPDATE, DELETE` to `authenticated`, `ALL` to `service_role`; RLS mirroring the BIE tables — `is_bie_member(auth.uid()) AND tenant_id = get_user_tenant_id(auth.uid()) AND (assigned_to = auth.uid() OR is_bie_manager(auth.uid()))`, insert additionally requires `assigned_by = auth.uid()`; admins/managers keep access via the existing role helpers.
  - Reuse `bie_work_history` with `work_type = 'product_assignments'` for status changes.
  - Regenerate types.
- `src/hooks/useProducts.ts`: `useProductsAdmin` gains `createdBy` / `updatedBy` filter params and selects `creator:profiles!products_created_by_fkey(full_name)` and `editor:profiles!products_updated_by_fkey(full_name)`; query key extended.
- New `src/hooks/useProductAssignments.ts`: list (with product join), create-many, update status, reassign, delete; writes `bie_work_history` rows; uses `ensureFreshSession()` + `requireTenantId()`.
- `src/components/settings/ProductsManagement.tsx`: selection state via the existing `useBulkSelection` hook, a `ProductBulkBar`, two person filters, two new columns; bulk edit/delete use `useBulkUpdate` / `useBulkDelete` from `src/hooks/useBulkActions.ts`.
- New `src/components/products/AssignProductWorkDialog.tsx` (team list from `useBIETeam()`).
- `src/pages/bie/BIEWork.tsx`: add a fourth `definitions` entry for product assignments; `src/hooks/useBIEWork.ts` folds them into `rows` so the dashboards pick them up with no further change.

## Verification

- Typecheck clean, build OK.
- Playwright as the BIE manager: product list shows Added by / Last edited by, filtering by a person narrows the list, selecting several rows and assigning creates the rows in the Work Register's Products tab, and a status change is recorded in history.
- Playwright as BIE staff: sees only their own product assignments, no assignee filter, no bulk delete.
