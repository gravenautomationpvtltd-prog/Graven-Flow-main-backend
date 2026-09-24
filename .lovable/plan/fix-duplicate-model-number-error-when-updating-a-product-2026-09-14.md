# Fix "duplicate model number" error when updating a product

## What is happening

When you press **Update Product**, the app saves the model number in ALL CAPS, even when you never touched that field. If another product in the catalogue already holds that same code (stored with different letter casing, or created earlier from the product's name), the database refuses the save and you get the raw message:

`duplicate key value violates unique constraint "products_tenant_model_number_key"`

Two things make this happen today:

- The edit form always converts the model number to capitals before saving, so simply opening an old product and changing its price can turn its code into one that already exists.
- For older products that never had a model number, the form silently fills it in from the product name, which can also collide with an existing product.

There are currently 18 codes in the catalogue that clash once letter case is ignored.

## The fix

1. **Stop rewriting the code you didn't change.** The model number is saved exactly as it is in the box. It is only reformatted when you actually type a new one.
2. **Check before saving.** Before the update is sent, the app looks for another product with the same code (ignoring case, spaces and hyphens). If one exists, you get a clear message naming the other product, with a link to open it — instead of a database error.
3. **Same check when adding a new product**, so duplicates cannot be created from the Add form either.
4. **Nothing is auto-filled silently.** If an old product has no model number, the field still shows the suggestion from its name, but it is marked as a suggestion so you can correct it before saving.

## Technical notes

- `src/components/settings/ProductDialog.tsx`: only uppercase `model_number` when it differs from the loaded value; keep `name` in sync with the saved model number.
- `src/hooks/useProducts.ts` (`useUpdateProduct`, `useCreateProduct`): before the write, query `products` filtered by `tenant_id` and the folded key (`match_key` from `src/lib/model-normalize.ts`) excluding the current `id`; throw a readable error `Model number already used by "<model>" — open that product instead`. Also map Postgres error `23505` on `products_tenant_model_number_key` to the same friendly text as a backstop.
- Keep the existing unique constraint untouched; no migration needed.

## Not included

The 18 existing clashing codes are left as they are. If you want, I can produce a list of them afterwards so the team can merge or rename them.
