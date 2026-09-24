# Make the BIE workspace complete and role-specific

## What's wrong today

1. A BIE manager lands on the company-wide dashboard (total leads, revenue, customers, quotations, deals won) — none of that belongs to her role.
2. **Products** shows "Access Denied": the products page only allows admin, manager and procurement roles, so BIE staff cannot add or edit products even though the database already permits it.
3. The work register is thin: no proper assignment view, no deadlines, no progress tracking, no per-person view.

## What you'll get

### 1. A BIE-only home screen
People whose only role is BIE (staff or manager) go straight to their own dashboard when they sign in, and the sidebar no longer offers the general company dashboard. Everything they see is their own work.

**Staff dashboard** — my open work, due this week, overdue, completed this month; a breakdown by type (vendor registrations, tenders, website listings) and status; my latest updates; my tasks.

**Manager dashboard** — the same numbers for the whole team plus a per-person scorecard (assigned, in progress, completed, overdue, average days to finish), upcoming tender deadlines, expiring vendor registrations, and a click-through into any single employee's work.

### 2. Products fixed
BIE staff and managers get full access to the product catalogue — search, add and edit — exactly the same screens the rest of the team uses.

### 3. Proper work tracking and assignment
The Work Register becomes a real tracker:
- Table view per type with sortable columns, status filter, assignee filter (manager only), overdue highlighting and a due-date column.
- "Assign work" for managers: pick the employee, type, due date, priority and notes; reassign at any time from the row menu.
- Status moves are one click from the row; completion stamps the date automatically so turnaround time is measured.
- Priority (low / normal / high / urgent) and a due date on every record, so "what's next" is obvious.
- Website listings warn before saving when the same website + reference already exists, so nothing is listed twice.
- Every status change is recorded with who changed it and when, shown as a small history on the record.

### 4. What BIE people see and don't see
Sidebar for a BIE person: My Dashboard, Work Register, Products, Supplier Onboarding, Tasks, Messages, Attendance. No leads, quotations, orders, customers or financial screens.

## Technical notes

- Migration: add `priority` (`low|normal|high|urgent`, default `normal`) and `due_date` to `vendor_registrations`, `tenders`, `website_listings`; add `bie_work_history` (work_type, record_id, from_status, to_status, changed_by, tenant_id, created_at) with GRANTs and RLS mirroring the parent tables (visible to the assignee and BIE managers within the tenant); trigger to stamp `completed_at` on terminal statuses. Regenerate types.
- `src/pages/Products.tsx`: include `isBIE` in `canAccess`.
- `src/components/layout/AppSidebar.tsx`: compute `isPureBIE = isBIE && !isAdmin && !isSales && !isProcurement && !isAccounts && !isHR && ...`; when true render only the BIE group plus Messages, Attendance and Account (same pattern as `isPureProcurementManager`).
- Routing: `/dashboard` redirects to `/bie/dashboard` for pure-BIE users (guard inside `Dashboard.tsx` or a wrapper in `App.tsx`).
- `src/hooks/useBIEWork.ts`: add filters (assignee, status, type, date range), `useBIEWorkStats()` for the dashboards, `useAssignBIEWork()` / `useUpdateBIEStatus()` writing history rows, and duplicate-check for listings.
- Split `BIEWork.tsx` into a table-based register with a shared row component, filter bar, assignment dialog and record drawer (details, status timeline, notes).
- `BIEDashboard.tsx` splits into `BIEStaffDashboard` and `BIEManagerDashboard` behind the existing `BIERoleGuard`, with `/bie/team/:userId` for the manager drill-down.

## Verification

- Typecheck clean and build OK.
- Playwright as a BIE manager: lands on the BIE dashboard, Products opens (no Access Denied), assign a record to an employee, change its status, see it in the team scorecard and in the history.
- Playwright as BIE staff: sees only own records, no assignee filter, cannot open another employee's work.
