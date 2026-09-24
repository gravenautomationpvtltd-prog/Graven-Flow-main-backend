# Export All Backend Data for Re-Hosting

Goal: produce a complete, downloadable copy of your backend data that you can take elsewhere.

## Two parts

### 1. Full database dump (you do this — one click)
Go to **Backend → Advanced settings → Export data**. This produces the complete database dump (schema, tables, rows, functions, policies) suitable for restoring onto another Postgres/Supabase instance. This is the authoritative artifact for re-hosting, and it can only be generated from the product UI.

### 2. Full CSV export (I do this — needs build mode)
I will export **every table in your database** (125 tables) to individual CSV files and place them in a downloadable folder, plus:

- One CSV per table, with header row, in `backend-export/csv/`
- A `manifest.csv` listing each table, its row count, and file size, so you can verify nothing is missing
- A `schema.sql` text file capturing the column definitions of every table, so the CSVs can be re-imported into a fresh database
- Everything zipped into a single `graven-backend-export-<date>.zip` for one-click download

Large tables (leads, customers, products, activity logs, price submission items) are exported in full — no row caps.

## Why I need build mode
Writing the export files requires shell commands that create files, which plan mode blocks. Approving this plan switches me to build mode so I can run the export. No project source code will be changed — the only files created are the export artifacts.

## Notes
- Auth users (login accounts) live in the managed auth schema and are included in the full dump from Backend → Export data, not in the CSV export.
- Uploaded files in storage buckets are separate from database rows; tell me if you also want those inventoried.
