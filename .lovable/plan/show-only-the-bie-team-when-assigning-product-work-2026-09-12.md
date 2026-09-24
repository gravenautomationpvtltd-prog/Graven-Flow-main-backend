# Show only the BIE team when assigning product work

## Problem

The "Assign to" list and the two person filters on the product list currently pull every active person in the company. Aditi should only see her own Business Intelligence team.

## What changes

- **Assign product work dialog** — the "Assign to" dropdown lists only Business Intelligence staff (BIE members and BIE managers), sorted by name.
- **Product list filters** — "Added by" and "Last edited by" list the same BIE team, plus the "me" shortcut, instead of the whole company.
- **Work Register, Products tab** — the assignee filter and the name shown against each assignment use the same BIE team list.
- Users who are not BIE (for example an admin opening the same screens) keep seeing the full list, so nothing existing breaks.

## Technical notes

- `useBIETeam()` in `src/hooks/useBIEWork.ts` already returns exactly the BIE roster (`user_roles` in `bie`, `bie_manager` → `profiles`), but is gated by `enabled: isBIEManager`. Relax the gate to `isBIE || isBIEManager` so BIE staff also get the list.
- `src/components/products/AssignProductWorkDialog.tsx`: replace `useProfiles()` with `useBIETeam()`.
- `src/components/bie/ProductAssignmentsTable.tsx`: replace `useProfiles()` with `useBIETeam()` for both `nameOf` and the assignee filter.
- `src/components/settings/ProductsManagement.tsx`: source the two person Selects from `useBIETeam()` when the viewer is BIE, falling back to `useProfiles()` otherwise; `personName()` resolves against the merged list so names on rows still render for non-BIE authors.

## Verification

- Typecheck clean, build OK.
- Playwright as the BIE manager: the assign dialog and both product filters list only BIE team members.
