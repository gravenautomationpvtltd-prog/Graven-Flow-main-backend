# Fix "Login service is temporarily unavailable"

## What is actually happening

This is not a wrong password and not broken code. The recorded request from your session shows the login server answered a single request with a gateway timeout (a slow response, not a rejection). Checked just now, the hosted backend is up and answering normally (auth ~91ms, database ~92ms), so the failure was a passing hiccup.

The problem is how the app reacts: one slow response and it immediately shows the red banner and stops. There is no automatic second attempt, so a momentary blip looks like a total outage and you have to click "Try again" yourself.

## What to change

1. **Retry slow responses automatically.** When signing in (or restoring an existing session) fails because the server was slow or timed out — not because the password was wrong — try again automatically up to two more times with a short growing pause (about 1s, then 2.5s). Wrong password, unconfirmed email and similar real errors are never retried.
2. **Show the banner only after the retries fail.** While retrying, the Sign In button keeps its loading state with "Still connecting…" instead of flashing an error.
3. **Give the timeouts more headroom.** Sign-in currently gives up after 12 seconds and the session check after 8; raise them modestly (20s / 12s) so a slow-but-successful response is not cut off by the app itself.
4. **Clean stale tokens on that path.** If a session restore keeps failing with a timeout, clear the stored login token before the final retry so a stale token cannot keep poisoning the attempt.
5. **Keep the "Try again" button** for the rare case all retries fail, with wording that says the service is busy rather than unavailable.

## Technical notes

- All changes are in `src/hooks/useAuth.tsx` (signIn, signUp, initial `getSession`, periodic session check) and `src/pages/Auth.tsx` (loading/notice states).
- Add a small `retryOnTransient(fn, attempts, delays)` helper next to the existing `withTimeout`, gated by the existing `isAuthServiceUnavailableError` predicate; explicitly exclude `Invalid login credentials`, `Email not confirmed`, and refresh-token errors.
- Raise `AUTH_REQUEST_TIMEOUT_MS` to 20000 and `AUTH_SESSION_TIMEOUT_MS` to 12000.
- No database, RLS, or backend configuration changes.

## Verification

Sign in with the real account in the preview and confirm the dashboard loads; confirm a deliberately wrong password still fails instantly with "Invalid email or password" (no retry delay).
