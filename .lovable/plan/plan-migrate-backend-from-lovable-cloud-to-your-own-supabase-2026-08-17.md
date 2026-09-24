# Plan: Migrate backend from Lovable Cloud to your own Supabase

## Goal
Stop using Lovable Cloud as the backend. Move the entire database, storage, edge functions, auth, and scheduled jobs onto a Supabase project that you own and control, and point the Graven OneDesk app at it.

## What has to move (inventory, verified this turn)
- **Database**: 125 public tables, ~434k rows, plus 294 migration files defining schema, functions, triggers, RLS policies, and enums.
- **Auth**: email/password + Google OAuth. `auth.users` accounts must come over so logins keep working.
- **Edge functions**: 37 functions in `supabase/functions/` (webhooks, email, Razorpay, e-invoice, lead sync, AI attachment parsing, etc.). `config.toml` holds each function's `verify_jwt` setting.
- **Function secrets**: `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`, `RESEND_API_KEY`. (`LOVABLE_API_KEY` is Lovable-only — see risks.)
- **Storage buckets**: `tenant-logos`, `documents`, `enquiry-attachments` (and any others) with their uploaded files.
- **Scheduled jobs**: `pg_cron` jobs registered in 4 migrations (escalation checks, TAT monitor, etc.).
- **App config**: `.env` (`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_PROJECT_ID`) and `supabase/config.toml` `project_id`.

## Backup status (already done)
- CSV export bundle for all 125 tables + `manifest.csv` + `schema.sql`: `graven-backend-export-2026-08-17.zip` (in Documents).
- **Still required from you**: the authoritative full database dump from **Backend → Advanced settings → Export data**. This is the only artifact that carries `auth.users`, indexes, foreign keys, RLS policies, and database functions in a re-restorable form. Download it before disconnecting anything.

## Recommended path: disconnect Cloud on this project, then connect your Supabase
This keeps the existing codebase, design, and git history in place. Cloud can be disconnected by a workspace admin from **Connectors → Lovable Cloud → Advanced → Disconnect**. This is **irreversible and permanently deletes all Cloud data** (database, storage, functions) — that is why the full dump must be downloaded first.

### Step 1 — You: provision your own Supabase
1. Create a new project at supabase.com (pick a region close to your users).
2. Note the **Project URL**, **anon/publishable key**, **service role key**, and the **database password** (you'll need the password to restore the dump).

### Step 2 — You: download the full dump (before any disconnect)
1. In this project: **Backend → Advanced settings → Export data** → download the full dump.
2. Keep it safe. This plus the existing CSV bundle is your complete backup.

### Step 3 — You: restore the dump into your Supabase
1. Using the pooler connection string from your new Supabase project, restore the dump with `psql` (large dumps exceed the dashboard SQL editor):
   ```
   psql "<your-new-connection-string>" -f <dump.sql>
   ```
2. If the dump's `auth` restore conflicts with Supabase's managed auth schema, restore `public` schema + data first, then manually insert `auth.users` rows and re-link `auth.identities`. (Supabase support can help if the dump format is the managed "export data" one.)
3. Verify row counts against `manifest.csv` from the export bundle.

### Step 4 — You: recreate storage buckets + upload objects
1. Create buckets `tenant-logos`, `documents`, `enquiry-attachments` (set public/private to match current policies).
2. Upload the stored files. (Cloud Storage objects are included in the full dump if you used Backend → Export data; otherwise re-upload from your file copies.)

### Step 5 — You: recreate pg_cron scheduled jobs
The 4 migrations that call `cron.schedule(...)` should re-run automatically if you replayed migrations, but against a restored dump the cron extension + jobs need confirming:
1. Enable `pg_cron` extension in your Supabase dashboard.
2. Re-run the `cron.schedule(...)` statements from those 4 migration files against your new DB.

### Step 6 — You: deploy edge functions + set secrets
1. Deploy all 37 functions (e.g. `supabase functions deploy <name>` via the Supabase CLI, or the dashboard).
2. Set each function's secrets in your Supabase project (Project Settings → Edge Functions → Secrets):
   - `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY` (your new project's values)
   - `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`
   - `RESEND_API_KEY`
3. Apply `verify_jwt` settings from `config.toml` to each function.

### Step 7 — You: configure auth
1. Enable Email + Google providers in your Supabase dashboard (Authentication → Providers).
2. For Google: create OAuth credentials in Google Cloud Console with redirect URI `https://<your-project>.supabase.co/auth/v1/callback`, and paste client ID/secret into Supabase.
3. Set the app's email redirect URL to your published app origin.
4. Recreate email templates if customized.

### Step 8 — You: disconnect Cloud and connect your Supabase to this Lovable project
1. **Workspace admin**: Connectors → Lovable Cloud → Advanced → Disconnect. (Irreversible — confirms Step 2 dump is safe first.)
2. Project Settings → Integrations → Supabase → connect your external project via OAuth. This sets `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, and the service role key for runtime.
3. Update `supabase/config.toml` `project_id` to your new project ref (or let the connector regenerate it).

### Step 9 — Verify
- Login works (email + Google).
- Dashboard loads, data present.
- A webhook fires (e.g. trigger an IndiaMART/test lead).
- Razorpay checkout + webhook round-trip.
- File uploads to the three storage buckets.
- A scheduled job runs on time.

## What I can do vs. what you must do
- **You must do**: Steps 1–8 (UI/console actions in your Supabase and Lovable account). Once Cloud is disconnected I lose sandbox DB access, so data restore has to run from your side.
- **I can help with now (before disconnect)**: regenerate/refresh the CSV export bundle, produce a consolidated secrets checklist, extract the exact `cron.schedule` statements and `verify_jwt` config into a single reference file for you, and package the edge function source for CLI deploy.

## Risks & caveats
- **Disconnecting Cloud is irreversible and deletes all Cloud data.** Only do it after the full dump (Step 2) is downloaded and verified.
- **`auth.users` restore** can be fiddly on a fresh Supabase because Supabase manages the `auth` schema; password hashes and identities need to come across exactly or users can't log in.
- **`LOVABLE_API_KEY`-dependent functions** (`extract-list-price-pdf`, `parse-enquiry-attachment`) use the Lovable AI Gateway, which is not available on external Supabase. They need to be rewritten to use an OpenAI/Gemini key (set as a function secret) or those features will stop working.
- **Edge function secrets** are not exported — you must re-enter each one in the new project.
- **DNS / webhook URLs**: IndiaMART, TradeIndia, WhatsApp, Razorpay, and email-inbound webhooks all point at the current function URLs. After migration their endpoint URLs change to your new project, so update them on each provider's dashboard.
- **pg_cron** extension must be enabled manually on the new project.

## Suggested first action
Before touching anything, download the full dump from **Backend → Advanced settings → Export data**. While you do that, I'll prepare a deploy reference bundle (secrets checklist, cron statements, verify_jwt config, function list) so Steps 5–6 are turnkey.
