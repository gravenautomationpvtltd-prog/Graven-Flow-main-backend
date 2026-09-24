# Restart the Lovable Cloud backend

## Goal
Clear the login timeouts (504 / "context deadline exceeded" errors on the sign-in service seen between 11:38–11:47 UTC) by restarting the backend.

## Current state
- Backend status check: auth and database both reachable (~111ms), so it has partially recovered, but recent logs show repeated sign-in timeouts.
- The app code already retries transient login failures automatically (added earlier), so this restart is the server-side fix.

## Steps
1. Restart the Lovable Cloud backend (supabase--restart). The backend may be unavailable for a few minutes during the restart.
2. Poll cloud status until the backend reports healthy again.
3. Verify sign-in works on the preview login page.

## Notes
- No code, database, or configuration changes — infrastructure restart only.
- Users may see a brief login outage while the restart completes.
