# Production Database Baseline Report

**Date:** 2026-10-04 · **Project:** `stvjpcqcpmhngihfjhga` (eu-west-1, Postgres 17.6)
**Method:** read-only catalog queries through the linked Supabase CLI (`supabase db query --linked`). No data rows were
read except aggregate counts; nothing was written. Raw catalog output: `supabase/baseline/catalog/*.json`.
**DDL baseline file:** `supabase/migrations/20261004000000_baseline_public.sql` — **reconstructed** from the live catalog
(`pg_get_constraintdef` / `pg_get_indexdef` / `pg_get_functiondef` / `pg_get_triggerdef` + exact column types), because
Docker Desktop (needed for `supabase db dump`) crashes on this machine on stale Unix-socket files.
**Verified:** the file was loaded into a throwaway in-memory Postgres (PGlite) with minimal Supabase stubs (roles, `auth`,
`extensions`, `storage`, `net`, `supabase_functions` webhook) and compared back against production: **all 25 tables,
every column (type, nullability, default), 118 constraints, 47 indexes, 53 policies, 51 functions, 14 triggers and RLS
flags are identical.** Not compared: table/function privilege grants (included in the file from `information_schema`
/ `pg_proc.proacl`, not round-tripped). The file is to be **marked as applied** (`supabase migration repair --status applied
20261004000000`), never executed against production.

---

## 1. Inventory

- **Remote migration history:** empty — every change so far was applied by hand in the SQL editor.
- **Schemas:** `public` (app), `storage`, `auth`, `cron`, `extensions`, `net`, `vault`, `realtime`, `graphql*`, `supabase_functions`.
  **No `engine` schema yet.**
- **Extensions:** `pg_cron`, `pg_net`, `pgcrypto`, `uuid-ossp`, `pg_stat_statements`, `supabase_vault`. (No `pg_trgm`.)
- **25 public tables, RLS enabled on all.** Approximate rows: `events` ~227, `event_submissions` ~121,
  `event_import_candidates` ~85, `crawl_sources` ~31, `cities` ~55, `places` ~11, `profiles` ~18, `interactions` ~1,644,
  `series_demand` ~57. Others small/empty.
- **51 functions** in `public`, **34 `SECURITY DEFINER`**. **14 triggers** (search vectors, banner-from-gallery sync,
  civic guards, `event-changed-notify`, updated_at).
- **Storage buckets:** `ai-posters`, `avatars`, `event-covers`, `placard-photos`, `social-assets` (public), `organizer-verification` (private).
- **Scheduled DB job (pg_cron):** `auto-archive-past-events`, daily 03:00 — sets `status='completed'` on published,
  non-recurring events whose `date < current_date`.

## 2. Drift vs documentation / memory

| Finding | Docs / memory said | Production |
|---|---|---|
| Phase 40 event series | SQL **not** applied | **Applied**: `event_series`, `series_demand`, `events.series_id` exist |
| Phase 40 demo seed | throwaway, optional | **Applied in production**: 2 demo series (`demo-the-long-way-home`, `demo-valle-tour-2026`) + 57 fake `series_demand` rows. Not publicly visible (Phase 40 code is unmerged). |
| Discovery registry | migration "unapplied" | `crawl_sources` exists with ~31 sources; `event_import_candidates` ~85 rows; `ai_usage` exists |
| `events.time` | — | **NOT NULL** (also `event_submissions.time` NOT NULL) — AlbaGo cannot store "time unknown" |
| `events.category` | no CHECK (audit) | still no CHECK; NOT NULL |
| `events.origin` | not set by approval path (audit) | NOT NULL, default `'admin_seeded'` — consistent with the audit |
| Removed features | Pankartat, protests, volunteers removed from code | `placard-photos` bucket, `volunteer_signups`, civic columns/guards/triggers still in the DB (inert) |
| `docs/schema-reference.md` | canonical schema | last updated 2026-05-14; materially out of date |

## 3. Consequences for the engine work

1. **Baseline first, by dump, not by re-creating tables.** The baseline migration will describe today's `public` schema
   exactly as dumped and be marked applied; no existing table is recreated.
2. **`engine` schema is greenfield** — no naming conflicts.
3. **"Unknown stays unknown" vs `events.time NOT NULL`.** The engine will keep `start_time = null`; the AlbaGo adapter
   needs a rule. Options: (a) an AlbaGo migration making `events.time` nullable (UI already shows a time label — needs a
   check of every reader), or (b) the adapter withholds delivery until a time is known. **Decision needed (D17).**
4. **The AlbaGo adapter must respect `auto-archive-past-events`** (completed ≠ retracted).
5. **Demo series data should be removed** from production with the cleanup block in `docs/seeds/phase-40-demo-series.sql`
   (run manually) — independent of the engine; **decision needed (D18).**
6. Existing `crawl_sources` (~31) and `event_import_candidates` (~85) are prior discovery work — candidates to migrate
   into `engine.sources` (as `proposed`) and `engine.observations` during the strangler steps, not to discard.
