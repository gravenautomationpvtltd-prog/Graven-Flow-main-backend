# Permanently stabilize login and backend availability

## Confirmed current state

- The hosted Lovable Cloud backend is **paused**, which makes database and authentication requests unavailable and directly causes the login error shown.
- Health and slow-query inspection cannot complete while it is paused; therefore the exact recurring saturation query is not yet confirmed.
- The app already converts backend timeouts into the friendly “Login service is temporarily unavailable” message. Changing that message or extending the frontend timeout would hide the problem, not fix it.
- Existing dashboard code performs several broad client-side aggregations, including loading lead, quotation, order, and inventory rows to calculate totals. Scheduled lead-sync jobs also run against the same database. These are concrete optimization targets, but their contribution must be measured after recovery.

## Recovery and permanent fix

1. **Restore service safely**
   - Resume the paused Lovable Cloud backend.
   - Wait for database and authentication health to become ready.
   - Verify a real login and profile/role load, not only that the status endpoint responds.

2. **Capture the cause while statistics are available**
   - Inspect connection saturation, memory, database restarts, deadlocks, and out-of-memory events.
   - Collect slow-query rankings and active workload after the backend is healthy.
   - Inspect enabled schedules and recent executions for IndiaMART, TradeIndia, CRO distribution, escalation checks, and other recurring jobs.
   - Separate a bad-query/job problem from genuine compute-capacity pressure before changing infrastructure.

3. **Reduce sustained database load**
   - Replace broad dashboard row downloads and JavaScript-side totals with bounded database aggregate functions scoped by tenant, branch, role, vertical, and date range.
   - Add only the indexes demonstrated by query plans for the identified slow filters and joins.
   - Cap all analytics and drill-down detail reads; preserve pagination for large customer, procurement, and quotation datasets.
   - Prevent duplicate dashboard requests by consolidating shared query keys and disabling inactive role/manager views until selected.

4. **Harden scheduled and bulk workloads**
   - Add overlap protection so a scheduled sync cannot start while its previous run is still active.
   - Process lead syncs, product imports, customer backfills, and segmentation in small resumable batches with explicit limits.
   - Use conservative schedules and backoff after timeout/failure instead of immediately creating more work.
   - Record job duration, rows processed, outcome, and failure reason so the next pressure event is attributable.

5. **Add operational safeguards**
   - Introduce database-side statement time limits for app-owned reporting/maintenance functions where appropriate.
   - Make expensive analytics load on demand and cache stable results rather than rerunning on every navigation.
   - Keep authentication/profile bootstrap lightweight so login remains usable even when reporting workloads are busy.

6. **Validate under realistic load**
   - Test login, refresh, dashboard opening, procurement queue, and scheduled sync execution together.
   - Recheck connection usage and slow queries after the changes.
   - If optimized queries and bounded jobs still cause memory or connection saturation under legitimate traffic, resize the Lovable Cloud database instance as the final capacity step.

## Technical scope

- Frontend data hooks: dashboard statistics/analytics and any confirmed duplicate or unbounded queries.
- Database migration: aggregate functions, targeted indexes, job locking/telemetry, and safe time limits.
- Edge functions: batching, overlap guards, and retry/backoff for confirmed heavy recurring jobs.
- No weakening of tenant, branch, role, procurement privacy, or protected-owner access rules.