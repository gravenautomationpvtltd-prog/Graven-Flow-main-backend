# Let the BIE team delete products

Right now only admins, managers and procurement can delete a product. BIE staff and the BIE manager can add and edit products, but the delete buttons are hidden for them — and even if they weren't, the database would refuse the deletion.

## What will change

- BIE manager and BIE staff get the same delete options everyone else has:
  - the trash icon on each row of the product catalogue
  - the Delete item in the row menu
  - the bulk Delete button when several products are selected
  - the Delete button on a product's own page
- Each delete keeps the existing confirmation box naming the product, and bulk delete keeps the count confirmation.
- Deleting stays limited to active products, same rule as today for everyone.

## Permissions after this change

| Action | Who |
|---|---|
| Add / edit product | Admin, Manager, Procurement, BIE manager, BIE staff |
| Delete product (single or bulk) | Admin, Manager, Procurement, BIE manager, BIE staff |

## Technical details

- New database policy on `products`: `DELETE` allowed when `is_my_tenant(tenant_id)` and the user holds the `bie` or `bie_manager` role — mirroring the existing "BIE can maintain products" update policy. Existing policies stay untouched.
- Frontend: in `ProductsManagement.tsx` widen `canBulkDelete` to include `isBIE` (rename to `canDeleteProducts` for clarity), and in `ProductDetail.tsx` widen `canDelete` the same way.
- No change to how deletion works otherwise; products referenced by quotations/orders are still protected by existing foreign keys, and any such failure shows as a message rather than a silent error.
