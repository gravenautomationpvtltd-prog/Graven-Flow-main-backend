# Fix profit margin % — calculate on purchase price, not sales price

## What is wrong

Your example: List ₹1,00,000 → purchase price ₹40,000, sales price ₹50,000, profit ₹10,000.

- The app's shared pricing helper divides profit by the **sales** price: 10000/50000 = **20%** (what you see in the product dialog).
- You want margin on the **purchase** price: 10000/40000 = **25%**.

Interestingly, some screens (profit analytics, product list) already calculate on purchase cost — so the app currently shows two different margin percentages for the same product. This fix makes "margin % = profit ÷ purchase price" the single rule everywhere.

## What will change

1. **Central pricing helper** (`src/lib/pricing.ts`) — `grossMarginPct` becomes `(sales − purchase) ÷ purchase × 100`. This one change fixes:
   - Product add/edit dialog (your screenshot) — will show 25%
   - Product detail page
   - Quotation line margin guard (below-minimum warning)
   - Quotation snapshots and product CSV export
   - Edge case: when purchase price is 0 or empty, margin shows "—" (cannot divide by zero) instead of a misleading number.

2. **Price comparison sheet** (`src/lib/comparison-sheet.ts`) — per-row "Margin %" switches from ÷ selling rate to ÷ landed/cost basis, matching everything else.

3. **Leaderboards** (`src/hooks/useLeaderboards.ts`) — margin % switches from profit ÷ order value to profit ÷ cost.

4. **Labels** — where space allows, show "Margin % (on cost)" so the meaning is unambiguous; PDF/CSV column headers stay short but the exported value follows the new rule.

5. **Minimum-margin setting** — the tenant minimum (default 15%) now means 15% on cost. The number stays the same; only the basis changes. Note: 15% on cost ≈ 13% on sales, so the guard becomes slightly stricter than before.

## Out of scope (already correct)

- Profit analytics dashboard and product list already use profit ÷ purchase cost — verified, no change needed.
- Landed-cost chain (margin added on top of cost to build a selling price) already works on-cost — unchanged.

## Verification

- Recheck your example in the product dialog: ₹1,00,000 list, 60% purchase discount, 50% sales discount → must show profit ₹10,000 and margin **25%**.
- Confirm product list, profit analytics, comparison sheet and product detail all show the same % for a given product.
- Typecheck + build, and a quick browser pass on the product dialog and a quotation line.
