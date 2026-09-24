# Quality Control (QC) post — receiving, checking and warehouse release

A new department that owns material from the moment it arrives until it leaves the building. Procurement buys, QC receives and checks, the warehouse only hands goods over once QC releases them.

## The new post

A new role, **Quality Control (QC)**, with its own workspace. Members see only what they need: incoming purchase orders, receipts to record, held material and release requests. They do not see customer names, prices or margins.

## What QC does day to day

**1. Receive and check in one step**
A "Receive material" screen lists purchase orders awaiting delivery. For each line the QC person enters:
- quantity received
- quantity passed (goes straight into warehouse stock, sellable, counts as Ready Stock)
- quantity held (fails the check — kept separately, never sellable)
- reason and notes for held quantity

Saving records the goods receipt, marks it checked, and updates stock in one action, stamped with who did it and when.

**2. Held material**
A "Held material" list shows everything set aside: product, quantity, supplier, reason, days held. From here QC can later release it into stock (after rework) or write it off as returned to the supplier. Held quantity never appears in Ready Stock and can never be quoted or dispatched.

**3. Release for dispatch**
Once Accounts bills an order, it appears in QC's "Awaiting release" list. The warehouse cannot dispatch until QC (or leadership) presses Release. Releasing deducts the quantity from warehouse stock and records the outward movement against the dispatch.

## Stock ledger — came, gone, remaining

A new **Stock Ledger** view answering, for any product or any warehouse and any date range:

```text
Date & time      Movement   Ref            Qty In   Qty Out   Balance   By
17 Sep 11:20     Received   GRN-26-0042        50         -       50   R. Singh
17 Sep 15:05     Held       QC hold             -        (5)      45   R. Singh
18 Sep 09:40     Released   DIS-26-0110         -        12       33   R. Singh
```

- Opening balance, total in, total out, closing balance for the chosen period
- Filter by product, warehouse, movement type and date range
- Exportable to CSV
- The same ledger appears on each product's page (recent movements) and on each warehouse

Every line carries date, time, reference document, and the person responsible. Nothing changes stock without a ledger line.

## Who can do what

- QC: receive, check, hold, release held material, release for dispatch, view ledger
- Warehouse: view stock and ledger, cannot pass QC or release
- Procurement: sees receipt status against its orders, cannot record or release
- Leadership (admin/manager): everything, including override release
- Sales: sees Ready Stock figures only

## Technical notes

- New `app_role` enum value `qc`; role checks added to `useAuth` (`isQC`) and sidebar/route guards.
- `inventory`: add `held_quantity` (numeric, default 0). Ready Stock and quotation pricing keep using `quantity` only, so held material is automatically excluded.
- `goods_receipt_notes`: add `qc_status` ('passed' | 'partial' | 'held'), `qc_by`, `qc_at`, `qc_notes`. Existing verify flow stays for older records.
- `grn_items`: reuse `accepted_quantity` for passed, `rejected_quantity` for held, plus existing `rejection_reason`.
- `stock_movements`: reuse with `movement_type` in ('in','out','adjustment') and new `reference_type` values 'qc_hold', 'qc_release', 'dispatch_release'; ledger is built from this table ordered by `created_at`, running balance computed per product+office.
- `dispatches`: add `released_by`, `released_at`; `useCreateDispatch` blocks creation for unreleased orders unless the user is QC or leadership. The dispatch-time deduction already built moves behind this gate.
- New pages: `src/pages/qc/QCDashboard.tsx`, `QCReceive.tsx`, `QCHeld.tsx`, `QCReleases.tsx`, and `src/pages/inventory/StockLedger.tsx`; new hooks `useQCReceipts`, `useHeldStock`, `useStockLedger`.
- RLS: tenant-scoped policies granting `qc` insert/update on `goods_receipt_notes`, `grn_items`, `inventory`, `stock_movements`, and update of release fields on `dispatches`; GRANTs on any new column-bearing tables per the standard block.
- Realtime already covers `inventory` and `stock_movements`, so ledger and Ready Stock badges update live.
