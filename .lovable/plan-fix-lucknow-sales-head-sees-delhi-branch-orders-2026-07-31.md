# Fix: Lucknow sales head sees Delhi branch orders

## What's happening

Swarna Raj has the roles `manager` + `sales` and is attached to Lucknow Branch. Priya Sharma is attached to Delhi Head Office. All 259 sales orders do carry an office, so the data is fine — the access rules are the problem.

Two rules in the database currently treat any `manager` as a company-wide operations role:

1. The "procurement or above" check includes `manager`. Because of that, Swarna is not considered a branch-scoped user at all, so the branch filter is switched off for her on every sales table (leads, customers, quotations, orders).
2. The orders and quotations view rules additionally grant blanket access to anyone passing that same "procurement or above" check — so even with the branch filter fixed, she would still see Delhi rows.

Net effect: a branch sales head sees the whole company, exactly the behaviour we agreed to remove.

## The fix

1. Redefine the "procurement or above" check to mean actual procurement roles (`super_admin`, `coo`, `procurement`, `procurement_manager`, `import_procurement`, `cct`) — remove plain `manager`.
2. Keep branch scoping intact: with `manager` no longer in that list, a manager with an office becomes branch-scoped, so the branch filter applies to leads, customers, quotations and orders.
3. Rewrite the view/update rules on `sales_orders` and `quotations` so the procurement bypass uses the corrected procurement check, and branch managers are limited to `office_id = own office`.
4. Leave company-wide roles untouched: super admin, COO, accounts, HR, warehouse, procurement and platform admin keep cross-branch visibility.
5. Managers without an office set stay company-wide (no accidental lockout); only managers with a branch get scoped.

## Verification

- Query the orders visible to Swarna's account after the change: every row must be Lucknow.
- Confirm Priya Sharma's Delhi orders are not in that result.
- Confirm a Delhi manager sees only Delhi rows, and a COO/procurement user still sees all 259 orders.
- Repeat the same spot-check for leads, customers and quotations.

## Technical notes

- Migration updates `public.is_procurement_or_above()` and recreates the SELECT/UPDATE policies on `public.sales_orders` and `public.quotations`.
- `branch_guard()`, `is_branch_scoped_role()`, `is_branch_manager()` and `current_user_office_id()` stay as-is; they behave correctly once the role list is fixed.
- No frontend changes needed for visibility — the Orders page filters client-side over whatever the database returns.
