# Fix the empty "Assign to" list on product work

## What is happening

Signed in as Aditi (BIE manager), the "Assign to" dropdown does list the whole Business Intelligence team (verified in the live preview: 9 names). The list comes up empty — a thin blank strip, exactly as in your screenshot — for anyone who is **not** on the Business Intelligence team: admin, sales manager, procurement, etc.

Cause: the "Assign work" button appears for every user who can open the product catalogue, but the team list behind it is only fetched when the signed-in person is a BIE member or BIE manager. For everyone else the request never runs, so the dropdown has nothing to show.

## What changes

- The Business Intelligence team list loads for anyone who can reach the assign dialog (BIE staff and manager, plus admin, COO, manager and procurement), so the dropdown always has the team in it.
- If the list is still empty for any reason, the dropdown shows a plain message ("No team members found") instead of a blank strip, and the same message appears in the two person filters on the catalogue.
- No change to who may assign, to the assignment records themselves, or to what staff see.

## Technical notes

- `useBIETeam()` in `src/hooks/useBIEWork.ts`: replace `enabled: isBIE || isBIEManager` with a gate that also allows `isAdmin`, `isManager`, `isProcurement` (keep it disabled while auth is still loading so it refetches once roles resolve).
- `src/components/products/AssignProductWorkDialog.tsx`: render a disabled placeholder item when `people.length === 0`, and keep the Assign button disabled until a person is chosen (already the case).
- Same empty-state text for the assignee select in `src/components/bie/ProductAssignmentsTable.tsx` and the "Added by" / "Last edited by" selects in `src/components/settings/ProductsManagement.tsx`.
- Database access is already correct: `user_roles` and `profiles` are readable tenant-wide, confirmed with a live query as the BIE manager.

## Verification

- Typecheck and build clean.
- In the preview: open the assign dialog as the BIE manager (should list the 9 team members) and as an admin user (should now list the same names instead of a blank strip).
