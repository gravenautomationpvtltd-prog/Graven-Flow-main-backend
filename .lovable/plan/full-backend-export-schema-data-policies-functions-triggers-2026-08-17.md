# Full Backend Export: schema, data, policies, functions, triggers, indexes, FKs, auth users

Goal: produce a single downloadable bundle that can rebuild your backend on any Postgres/Supabase instance — not just CSVs.

## Verified this turn
- Direct DB access works: 125 public tables, 140 functions, 388 RLS policies, 357 indexes, 125 non-internal triggers.
- The sandbox database role cannot read the `auth` schema, but the backend read tool can: 45 auth users are readable. Auth users will therefore be exported through that path, not via psql.

## What the bundle will contain

```text
graven-full-backend-export-<date>/
  00_README.md            restore order + verification steps
  01_extensions_types.sql extensions, enum types (all 30+ enums)
  02_schema_tables.sql    CREATE TABLE for all 125 public tables (columns, types, defaults, NOT NULL, identity/sequences)
  03_constraints.sql      primary keys, foreign keys, unique + check constraints
  04_indexes.sql          all 357 indexes
  05_functions.sql        all 140 database functions (full source via pg_get_functiondef)
  06_triggers.sql         all 125 triggers (pg_get_triggerdef)
  07_grants_rls.sql       GRANTs per table, ENABLE ROW LEVEL SECURITY, all 388 policies
  08_auth_users.sql       auth.users + auth.identities inserts (incl. password hashes, so logins keep working)
  09_views_sequences.sql  views, sequence definitions and current values
  data/*.csv              one CSV per table, full rows, header row
  restore.sh              psql script running everything in the correct order
  manifest.csv            table, row count, file size for verification
```

## Restore order the bundle enforces
extensions/types → tables → data load (`\copy`) → constraints → indexes → functions → triggers → grants/RLS → sequence resync → auth users.

Data is loaded before constraints and triggers so foreign keys and trigger side-effects don't fight the import.

## Technical notes
- Definitions are generated from the Postgres catalog (`pg_get_functiondef`, `pg_get_triggerdef`, `pg_get_constraintdef`, `pg_get_indexdef`, `pg_policies`), which is what `pg_dump` itself emits — so the output is faithful, not hand-written.
- Data goes out as CSV plus `\copy` commands rather than giant INSERT files: faster to load and far smaller for the big tables (integration_logs 81k, leads 43k, activity_logs 42k, products 27k, customers 13k rows).
- Sequences are exported with their current value and reset with `setval` after data load, so new inserts don't collide.
- `auth.users` / `auth.identities` rows are pulled through the backend read tool and written as inserts. On a fresh Supabase these must be loaded after the auth schema exists; the README explains this and the fallback (invite + password reset) if the target rejects hash import.

## Security caveat
`08_auth_users.sql` contains password hashes and user emails. It is a highly sensitive file — the README will say to keep the bundle encrypted or delete it after restore. Tell me if you'd rather export auth users **without** password hashes (users then reset passwords on first login).

## What still can't be included
- Storage bucket **files** (the binary objects themselves) — bucket definitions and object metadata rows are included, but the files must be copied from the storage layer separately.
- Edge function secrets (Razorpay, Resend keys) — these are write-only and must be re-entered on the new project. The existing deploy-reference bundle already lists them.
