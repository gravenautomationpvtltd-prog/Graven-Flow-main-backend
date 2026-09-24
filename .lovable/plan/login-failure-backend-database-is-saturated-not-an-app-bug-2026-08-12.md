# Login failure: backend database is saturated, not an app bug

## What the error actually is

The "Login service is temporarily unavailable" message is your app's own friendly wrapper around a failed sign-in call. The real failure is on the backend:

- Auth requests to `/token` (both password sign-in and refresh token) are timing out after 10-42 seconds and returning 504.
- Underneath that, the auth service logs show: `error finding refresh token: failed to connect to ... database=postgres (dial tcp [::1]:5432: operation was canceled)`.
- The database metrics endpoint also times out.

Translation: the auth service cannot get a database connection. The database is out of available connections or pinned at capacity, so every login sits in a queue until it times out. No frontend or code change can fix this — the app is behaving correctly by showing the error.

## Likely cause

Connection pool exhaustion / CPU saturation on the database instance. Given the volume of recent work (large paginated procurement queues, 20k-row product backfills, bulk price imports, analytics RPCs across 10k+ customers), long-running or repeated heavy queries are the usual culprit for holding connections open.

## Proposed steps

1. Restart the Cloud backend to clear stuck database connections and bring auth back. This needs your approval — the backend is unavailable for a few minutes during the restart, so pick a moment that suits the team.
2. Confirm health after restart: check backend status, then sign in as a test user to verify `/token` responds normally.
3. Identify what saturated it: review slow queries and the heaviest recent statements to find the query or job holding connections.
4. Fix the root cause based on step 3. Typical outcomes:
   - Add or correct indexes behind the slow analytics/drill-down RPCs.
   - Cap page sizes and add timeouts on the heavy list screens.
   - Move bulk/backfill work to batched background runs instead of large single statements.
5. If saturation is genuinely from legitimate load rather than one bad query, evaluate increasing the database compute size.

## Technical notes

- Evidence: `auth_logs` shows `error_code: request_timeout` and `unexpected_failure` with `dial tcp [::1]:5432: operation was canceled` on `POST /token`; `db_health` metrics call times out.
- No changes to `src/pages/Auth.tsx`, `src/hooks/useAuth.tsx`, or the Supabase client are needed — the existing recovery UI already handles this state correctly.
- Step 3 uses slow-query inspection plus `pg_stat_activity`-style review of long-running sessions.
