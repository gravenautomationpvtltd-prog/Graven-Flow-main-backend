# Make product edit / delete easy to find

## Why you can't see them today

1. **Catalog list:** Edit/Delete do exist, but they sit inside a small "..." menu in the **last column** of a 15-column table. The table is wider than the screen, so that column is scrolled off the right edge — your screenshot ends at "Price Updated" and the actions column (plus Status, Added by, Last edited by) is hidden.
2. **Product page:** an "Edit product" button exists at the top, but only for Admin / Manager / Procurement roles. BIE staff — the team actually doing product data entry — don't get it, so the page shows only "Back to catalog" (your second screenshot).

## What will change

**Product catalog (`ProductsManagement`)**
- Give every row a small, always-visible set of action icons right in the first data column next to the model number: an **Edit pencil** and a **Delete trash** icon (delete only for admin/manager, and only for active products — same rule as today). No more hunting in an off-screen dropdown.
- Keep the existing "..." menu (Open product / Edit / Delete) but pin the actions column to the right edge (sticky) so it stays visible even when the table scrolls sideways.
- Gate the dropdown's Edit/Delete items by role the same way (today Delete shows to everyone, even though the database would reject it).
- Selecting rows still shows the existing Bulk edit / Bulk delete bar.

**Product page (`ProductDetail`)**
- "Edit product" button also appears for **BIE staff and BIE managers**, since adding/editing products is their job.
- Add a **Delete** button next to it for admin/manager (active products only), so a product can be removed from its own page too, with the same confirmation dialog used in the catalog.

**Permissions summary (matches what the database already enforces)**

| Action | Who |
|---|---|
| Edit product | Admin, Manager, Procurement, BIE staff/manager |
| Delete product | Admin, Manager only, active products only |
| Bulk edit / bulk delete | Admin, Manager (unchanged) |

## Verification

- Open the catalog: edit/delete icons visible on every row without scrolling right; sticky actions column stays put.
- Open a product page as a BIE staff login (e.g. Ruchi): Edit product appears and saves.
- Typecheck + build, quick browser pass on both screens.
