# Split the BIE manager and staff experience

## What's wrong today

Both roles open the same two screens with only a few words changed:

- The dashboard uses one component; for a manager it just widens the numbers to the whole team and adds one table at the bottom.
- The Work Register is identical for both. Anyone can press "Add work" and the form always defaults the assignee to themselves, so a manager has no real way to hand work to someone and a staff member technically has the same buttons as her manager.
- Nothing shows a staff member *who gave them the work*, and nothing shows a manager *what each person is doing right now* beyond a count.

So the two roles feel the same because the work itself is never handed over — it is only recorded.

## What you'll get

### Staff (Ruchi and team) — "My Work"
- Dashboard is strictly personal: my open work, due this week, overdue, completed this month, my work by type, my next deadlines, my recent updates. No team numbers anywhere.
- Work Register shows only her own records. No assignee filter, no "Everyone" dropdown, no "Assign work" button.
- Each row shows **Assigned by** and a due date, so it is clear this came from the manager.
- She can: update status, add notes/progress, attach the result, and mark work done. She cannot change the assignee, the due date or the priority — those are the manager's.
- She can still add her own record (a listing or registration she picked up herself); it is created assigned to her and flagged "self-logged".

### Manager (Aditi) — "Team Work"
- Dashboard is team-first: team open work, overdue, due this week, completed this month, plus a per-person scorecard (assigned / open / overdue / completed / average turnaround) where each row opens that person's work.
- A separate "Needs my review" list: everything a staff member marked done, so the manager confirms or sends it back.
- "Assign work" dialog: pick person (required), type, title fields, priority, due date, notes. Assigning is the manager's primary action — staff never sees this button.
- Row menu: reassign, change priority, change due date, send back for rework, close.
- An "Unassigned" bucket so newly created work can sit in a pool until she hands it out.
- New page per employee at `/bie/team/:userId` with that person's workload, deadlines and history.

### Clear separation of duties

| | Staff | Manager |
|---|---|---|
| See others' work | No | Yes |
| Assign / reassign | No | Yes |
| Set priority & due date | No | Yes |
| Update status, notes | Own work only | Anyone's |
| Mark done | Yes (goes to review) | Yes (final) |
| Approve / send back | No | Yes |

## Technical notes

- Migration: add `review_status` (`not_submitted | submitted | approved | rework`, default `not_submitted`), `submitted_at`, `reviewed_by`, `reviewed_at`, `rework_note` to `vendor_registrations`, `tenders`, `website_listings`, `product_assignments`; allow `assigned_to` to be null for the unassigned pool. GRANTs and RLS unchanged in shape — staff still limited to `assigned_to = auth.uid()`, managers to tenant; add a policy so staff cannot update `assigned_to`, `priority`, `due_date` (trigger that rejects the change unless `is_bie_manager(auth.uid())`). Regenerate types.
- Split `src/pages/bie/BIEDashboard.tsx` into `BIEStaffDashboard.tsx` and `BIEManagerDashboard.tsx`; `BIEDashboard.tsx` becomes a thin switch on `isBIEManager`.
- Split `src/pages/bie/BIEWork.tsx` into a shared table/row layer plus `MyWork` (staff) and `TeamWork` (manager) wrappers; move the create/edit dialog into `components/bie/WorkFormDialog.tsx` with a `mode: 'assign' | 'self'` prop that hides assignee/priority/due-date for staff.
- New `components/bie/AssignWorkDialog.tsx`, `components/bie/ReviewQueue.tsx`, `components/bie/TeamScorecard.tsx`, page `src/pages/bie/BIETeamMember.tsx` with route `/bie/team/:userId` behind `<BIERoleGuard managerOnly>`.
- `src/hooks/useBIEWork.ts`: add `useBIEWorkScoped()` returning rows already filtered by role, `useAssignBIEWork()`, `useReassignBIEWork()`, `useSubmitForReview()`, `useReviewBIEWork()` — each writing a `bie_work_history` row.
- Sidebar label: "My Work" for staff, "Team Work" + "Assign" for managers.

## Verification

- Typecheck clean and build OK.
- Playwright as the manager: assign a record to a staff member, see it in her scorecard, review a submitted item, send one back.
- Playwright as staff: only own records visible, no assign button, assignee/priority/due-date read-only, submit for review works.
