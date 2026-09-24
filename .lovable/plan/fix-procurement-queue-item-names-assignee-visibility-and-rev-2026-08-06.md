# Fix procurement queue: item names, assignee visibility, and revision controls

Three problems on the Procurement workspace, confirmed against the live data and access rules.

## 1. "Unknown item" everywhere

The item text is present in the database for these requests (for example `6GK5208-0BA00-2AB2`, `ATV71HU40N4Z`, `ACS550-01-125A-4`). The queue shows "Unknown item" because the access rules on enquiry items only let a user read the item if they are the person the request is **assigned to** or the person who **raised** it.

Since every request is now routed to the procurement head first, the head can read the item only for the handful assigned to him — everything assigned to Nikita, Raj, Rishab, etc. comes back blank and falls through to the "Unknown item" placeholder.

Fix: allow procurement-side roles (procurement, procurement manager, import procurement, CCT) to read the enquiry item behind any price request in their own company, regardless of who it is assigned to. Customer identity stays hidden — this only exposes the item text, quantity, brand and target, not the customer.

Also make the row itself more useful:
- Show brand and quantity under the model number in the queue table.
- Replace the "Unknown item" placeholder with the lead title as a fallback, so a row is never anonymous.

## 2. Assigned person must see the item in their own dashboard

Once the head assigns a request, the assignee already gains read access, so the item text will render for them. Two additions so the handover is obvious:
- The assignee's "My queue" and the Procurement Queue cards show the same model number + brand + quantity block.
- When the head assigns someone, that person gets an in-app notification naming the item (currently assignment is silent).

## 3. "Ask procurement for a better price" is on the wrong side

That input plus the "Request revision" button is a sales/SPT action — it asks procurement to improve a price. It should not appear on a procurement user's screen.

- Hide the "Ask procurement for a better price" field and "Request revision" button for procurement-only roles.
- Procurement keeps: add supplier quote, push price to sales, "Can't match", and the read-only history of negotiation rounds so they can see what sales asked for.
- Sales/SPT and management keep the full section, including the ask field.

## 4. Resolve screen becomes a Sr. No / Item / Qty / Price sheet

Clicking "Resolve" today opens a single free-form quote form. Instead it opens a table of every open item from the same enquiry, so procurement fills prices the way they actually work:

```text
Sr. No | Item (model + brand)      | Qty | Price (₹)  | Notes
-----------------------------------------------------------------
1      | 6GK5208-0BA00-2AB2        |  1  | [ input ]  | [ input ]
2      | ATV71HU40N4Z              |  2  | [ input ]  | [ input ]
3      | VW3A5107                  |  1  | [ input ]  | [ input ]
                                        [ Save all prices ]
```

- Sr. No, Item and Qty are read-only; Price is the only required field procurement fills. Optional supplier name, lead time and notes per row.
- One "Save all prices" action records each entered price against its own request, marks those requests resolved and pushes them to sales together. Rows left blank stay pending.
- A row can be marked "No price" individually.
- The same sheet is used for negotiation rounds: when sales asks for a revised price, the table reopens with the earlier price shown alongside a new price column.
- Customer name stays hidden; the sheet is headed by the request reference only.

## Technical notes

- Migration: new SELECT policy on `enquiry_items` for procurement roles scoped by tenant via the existing `price_requests` link; no change to `leads` policies so customer data stays out of reach.
- `usePriceRequestQueue.ts`: hydrate `brand` and fall back to `lead_title` for `product_text`.
- `PriceRequestsTab.tsx` / `ProcurementQueue.tsx`: render model number prominently with brand + qty beneath.
- `PriceRequestDetailSheet.tsx`: gate the revision request block behind `!isProcurementOnly` (reuse the existing role helper in `src/lib/procurement-privacy.ts`, adding an `useIsProcurementOnly` export).
- `useAssignPriceRequests.ts`: insert a `notifications` row per assignee on assignment.
- New `PriceResolveSheet.tsx`: loads sibling `price_requests` for the same `lead_id` with status pending/in_progress, renders the numbered grid, and saves via a batched insert into `price_request_quotes` plus a status update per request.
