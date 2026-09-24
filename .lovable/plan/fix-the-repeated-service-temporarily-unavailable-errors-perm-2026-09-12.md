# Fix the repeated "service temporarily unavailable" errors — permanently

## What I found, just now

This is not a login bug and not a wrong password. The backend itself is overloaded:

- In the last hour, every sign-in attempt failed: 68 gateway timeouts and 13 server errors.
- Ordinary data requests (suppliers list, your own profile) also timed out.
- Even a tiny internal housekeeping query took **19 seconds** to run — on a healthy database that takes a few milliseconds.
- The database's own health metrics and the connection pooler did not answer at all.

Everything points to one cause: the hosted database machine has run out of headroom. It is too small for the amount of data and traffic this app now carries (28,000+ products, 15,000+ quotation lines, live lead sync, many users at once). Restarting only clears it for a while — which is why the problem keeps coming back.

## The permanent fix

1. **Increase the size of the database machine.** This is the actual fix. I will open the size picker in chat so you can choose and approve a larger instance. This affects Lovable Cloud usage cost, and the backend is briefly unavailable while it resizes (a few minutes).
2. **Verify after the resize.** Re-check backend health, confirm sign-in works, and confirm the pooler and metrics answer again.
3. **Find what is burning the capacity.** Once the database is responsive, pull the slowest queries and add the missing indexes behind them. With this much product and quotation data, an unindexed lookup can pin the machine on its own.
4. **Reduce constant background load from the app.** The app keeps several live subscriptions open (leads, chat, reminders, email logs, procurement queue) plus timers refreshing every 30–60 seconds. I will stop background screens from refreshing while a tab is not being looked at, and widen the shortest intervals. This cuts the steady baseline load so the machine is not permanently near the limit.

## Order of work

Resize first (nothing else can be measured while the database is unreachable), then slow-query indexes, then the app-side load reduction.

## Technical notes

- Resize via `resize_compute`; compute, not disk — the symptoms are CPU/connection saturation, not a full disk.
- After resize: `cloud_status`, `db_health`, `slow_queries`, then targeted `CREATE INDEX CONCURRENTLY` migrations for the top offenders.
- App-side: add `refetchOnWindowFocus`/visibility gating and raise intervals in `useBreaks.ts` (30s), `useReminders.ts` (60s), `WebhookHealthCard.tsx` (60s); audit the 11 realtime channel subscriptions so each one is only opened on the screen that needs it.
- No schema or auth-configuration changes are required for the fix itself.
