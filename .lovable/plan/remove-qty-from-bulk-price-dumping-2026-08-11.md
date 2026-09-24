# Remove Qty from bulk price dumping

## Why 67 appears

Model numbers like `6ES7321-1BH02-0AA0` contain digits. The paste parser strips letters/symbols from each column and treats anything numeric as a number, so part of the model number is read as a second "number" on the line and lands in the Qty field. Nothing was typed — it is a misread of the model number.

## What changes

- Drop Qty entirely from the bulk price dump flow. Procurement pastes only model number + RMB price.
- Parser stops looking for a quantity: on each line, the last numeric token is the RMB price and the remaining text is the model number. No second number is inferred.
- Preview table loses the "数量 / Qty" column; header total becomes rows count + sum of RMB unit prices (no qty multiplication).
- On submit, quantity is sent as 1 for every row so existing records and approval calculations stay valid.

## Technical notes

- `src/lib/bulk-price-parser.ts`: remove `qty` from `ParsedPriceRow` and the qty-inference block.
- `src/pages/procurement/BulkPriceSubmit.tsx`: remove the qty column, qty input, qty in `addRow`, and use `qty: 1` in the insert payload; adjust the total calculation.
- No database changes.
