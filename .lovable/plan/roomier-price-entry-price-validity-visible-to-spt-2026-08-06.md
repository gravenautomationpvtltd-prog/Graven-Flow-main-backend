# Roomier price entry + price validity visible to SPT

Two problems today: the "Fill prices" inputs are squeezed into narrow table columns where a wrong digit is easy to miss, and a price is stored with no expiry date, so SPT quoting later has no idea whether the number is still good.

## 1. Bigger, safer price entry

Replace the cramped single-row table layout in the Fill prices sheet with a stacked card per line item:

```text
Sr 1 · 6GK5208-0BA00-2AB2 (Siemens)          Qty 1 · Target —
------------------------------------------------------------
[ Price ₹  (large) ] [ Valid until (date) ] [ Supplier      ]
[ Lead (d) ] [ Notes .......................................]
                          [Compare supplier quotes v] [No price]
```

- Wider sheet (`sm:max-w-5xl`), full-width fields, larger price input with a live formatted echo ("₹1,25,000") under it so a typo is obvious.
- Same for the add-quote strip in the supplier quote compare panel: two rows of properly sized inputs instead of six tiny boxes, plus a **Valid until** field.
- No horizontal scrolling at 1024px.

## 2. Price validity

- Procurement fills **Valid until** alongside the price (both in the quick fill row and in each supplier quote).
- Saving stores the date on the price request and on the enquiry item, so it travels to sales.
- SPT sees it wherever the procurement price is shown (enquiry items on the lead, SPT enquiry brief): a small badge — "Valid till 20 Aug" in green, "Expires in 3 days" in amber, "Expired 12 Aug" in red.
- The validity is also appended into the notes text saved with the price ("Price valid till 20-Aug-2026"), so it shows up even in plain notes views.
- Not mandatory — a blank date just shows "No validity given".

## Technical notes

**Database (one migration)**
- `price_requests`: add `price_valid_until date`.
- `enquiry_items`: add `price_valid_until date`.
- `price_request_quotes.valid_until` already exists — reused as the source when pushing a quote.

**Frontend**
- `src/components/procurement/PriceResolveSheet.tsx` — table rows become stacked cards; draft gains `validUntil`.
- `src/hooks/usePriceResolveSheet.ts` — write `valid_until` on the quote, `price_valid_until` on the request and enquiry item; append validity line to notes.
- `src/components/procurement/QuoteComparePanel.tsx` — add Valid-until input, show validity per quote, relayout the add form.
- `src/hooks/usePriceRequestQuotes.ts` — push flow copies quote `valid_until` to request + enquiry item.
- New `src/components/shared/PriceValidityBadge.tsx` for the traffic-light badge.
- `src/hooks/useEnquiryItems.ts` selects the new column; badge rendered in `src/components/leads/EnquiryItemsSection.tsx` and `src/components/spt/EnquiryBriefCard.tsx`.
