# Procurement: head-first routing + hide customer names

## What changes

1. **Customer name hidden from procurement**
   Procurement users (procurement, procurement manager, import procurement, CCT) no longer see the customer/company name anywhere in the price-request queue, detail sheet, or procurement queue page. It is replaced by a neutral reference (lead number / enquiry ref) so items stay traceable without exposing the account. Sales, management (CEO/COO/admin) keep seeing the name.

2. **Everything goes to the procurement head first**
   New price requests stop being auto-split by brand owner / round-robin across the team. Every new request lands on the procurement head's queue. The head then assigns (single or bulk, already supported) to whoever is available.

3. **After assignment, the assignee owns the conversation**
   Once the head assigns an item to a team member, all follow-up on that item — negotiation rounds, sales counter-offers, reminders, escalations, notifications — goes to that assignee, not back to the head or to round-robin.

4. **Head always has full visibility**
   The procurement head keeps seeing every request regardless of assignee, with the assignee shown on each row, plus a "Unassigned / with me" filter so pending-to-distribute work is one click away.

## Who is the head

Currently **Yatender Kumar** is the only user with the procurement manager role, so he becomes the head. It will be stored as a setting (not hardcoded), so you can change the head later without a code change.

## Technical notes

- **DB migration**
  - Add `procurement_head_user_id` to the tenant/company settings (or a small `procurement_settings` row) with GRANTs + RLS, defaulting to the current procurement-manager user.
  - `auto_assign_enquiry_item_brand_owner`: stop setting brand-owner / round-robin assignee; set the head, `routed_via = 'head'`.
  - `assign_procurement_owner`: return the head instead of brand owner / `pick_next_procurement_user`.
  - Negotiation/round routing (`price_request_rounds` re-open path) keeps routing to the last responder — if none, falls back to the head.
- **Frontend**
  - `usePriceRequestQueue.ts` / `useProcurementQueue.ts`: keep fetching the lead ref; gate `customer_name` behind a `canSeeCustomer` check derived from `useAuth` roles, returning `null` for procurement roles.
  - `PriceRequestsTab.tsx`, `PriceRequestDetailSheet.tsx`, `pages/procurement/ProcurementQueue.tsx`: render the ref instead of the customer column when hidden.
  - Add an "Unassigned / with me" quick filter to the assignee dropdown for the head.
- No change to sales-side screens.
