# Procurement prices that live on in the catalog + sales can always ask for a target / reprice

Two gaps today:

1. A price procurement saves is written onto the price request and the enquiry item only. It dies with that enquiry — the next quotation for the same item starts from scratch.
2. Sales can only ask for a better price / reprice on items that already carry a catalog rate. On items priced by procurement (or with no price yet), there is no "ask for target" or "revise price" action in reach.

## 1. Saved prices become catalog prices, forever

When procurement saves a price (Fill prices sheet, quick resolve, or pushing a supplier quote):

- The item's linked product record is updated with the purchase price, the supplier, the lead time and the **valid until** date.
- If the enquiry item is not linked to any product yet, the item is matched to a product by model number, then HSN, then exact product text. If nothing matches, a catalog product is created from the item (model number, description, brand) so the price has a permanent home.
- A price history row is written every time, so the product page shows the full price trail (who, when, which supplier, which validity).

From then on, every future enquiry / quotation for that item picks the price up automatically from the catalog — no new price request needed.

## 2. Validity drives what sales sees

Each catalog price carries its validity date, and sales sees one of three states wherever the price appears (enquiry items, product search, quotation builder):

```text
Valid till 20 Aug        green   — quote freely
Expires in 3 days        amber   — quote, but nudge to reconfirm
Price expired 12 Aug     red     — quotable, but flagged
```

- **Expired** prices are never hidden or wiped. The number stays visible with an "expired — reconfirm with procurement" warning, and the quotation builder shows the same warning badge on that line so nobody quotes a stale price unknowingly.
- A one-click **Ask procurement to revalidate** action on the expired badge raises a fresh price request (reprice round) for that item.
- When procurement extends the validity — either by re-saving the price or by an **Extend validity** action on the product / price request — the badge turns green again and the item is quotable until the new date, with no re-entry of the price.

## 3. Sales can always ask for a target or a revision

- **Every** enquiry item row gets the two actions, regardless of where its price came from (catalog, procurement, or none): **Ask target price** and **Request reprice**. Today they only show for catalog-priced lines.
- The dialog carries the current price and the customer's target, and sends the request to procurement as a new negotiation round on the existing price request (or creates one if none exists).
- The same two actions are added to the price thread sheet header, so a revision can be raised straight from the negotiation history.
- Expired-price lines get the reprice action pre-labelled "Price expired — request fresh price".

## Technical notes

**Database (one migration)**
- `products`: add `price_valid_until date`, `last_quote_supplier_id uuid`, `price_source text` (`procurement` | `list` | `manual`).
- `product_price_history` already exists — write a row on each procurement save (price, supplier, validity, source).
- No change to `price_requests` / `enquiry_items`; `price_valid_until` already exists on both.

**Frontend**
- `src/hooks/usePriceResolveSheet.ts` and `src/hooks/usePriceRequestQuotes.ts` — after resolving/pushing, upsert the catalog product (match by `model_number` → `hsn_code` → exact name, else create) with price, supplier, lead time, validity; insert the history row.
- New `src/hooks/useCatalogPriceSync.ts` holding that match-or-create + upsert logic so both flows share it.
- `src/components/shared/PriceValidityBadge.tsx` — add the expired state with the "Ask procurement to revalidate" action.
- `src/components/leads/EnquiryItemsSection.tsx` — show "Ask target" and "Request reprice" for all status types; wire the expired-price variant.
- `src/components/leads/PriceThreadSheet.tsx` — header actions for target / reprice.
- Quotation builder line rendering — validity badge and expired warning next to the rate.
- `src/components/settings/ProductDialog.tsx` / products table — show and allow editing of validity, plus an **Extend validity** quick action for procurement roles.
