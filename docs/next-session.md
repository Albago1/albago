# AlbaGo — Next Session Handoff

**Last updated:** 2026-05-14 (end-of-session state save — Phase 7A complete, 7B planned)
**Branch:** `main` · HEAD `3cce73f` (Docs: platform-architecture v2.0)
**Push state:** Commits through `3cce73f` are pushed to `origin/main`. Two new docs (`docs/phase-7b-plan.md`, `docs/schema-reference.md`) are **untracked and not yet committed** — push them first thing next session.
**Vercel deployment:** Live and auto-deploying from `main`. Working.
**Stack:** Next.js 16 (App Router) · React 19 · TypeScript · TailwindCSS v4 · Supabase · MapLibre GL

---

## Phase Status

| Phase | Status |
|---|---|
| Phase 1 — Venue foundation | ✅ Complete |
| Phase 2 — Auth + submissions + moderation | ✅ Complete |
| Stabilization + UX polish | ✅ Complete |
| Phase 3 — Full-text search + DB-driven locations | ✅ Complete |
| Phase 4 — Event detail pages | ✅ Complete |
| Phase 5 — Saved events | ✅ Complete |
| Phase 6 — Venue detail pages | ✅ Complete |
| Audit batch (May 10) | ✅ Complete |
| C2 RLS hardening (May 11) | ✅ Complete (DB-only) |
| **Phase 7A — Organizer foundation** | ✅ Commits 1–4 complete; **Commit 5 pending** |
| **Phase 7B — Event lifecycle** | 📋 Planned in `docs/phase-7b-plan.md` — migration not run |

---

## Immediate First Actions Next Session

**In order — do not skip:**

1. **Commit and push the two new doc files:**
   ```
   git add docs/phase-7b-plan.md docs/schema-reference.md
   git commit -m "Docs: Phase 7B plan + canonical schema reference"
   git push
   ```

2. **Build Phase 7A Commit 5** — discoverability card on `/dashboard` for non-organizer users (~20 lines, no migration). Details below.

3. **Push Commit 5, verify on Vercel.**

4. **Run Phase 7B migration** in Supabase SQL editor. Use the SQL block in `docs/phase-7b-plan.md §10`. Run verification queries in §11. Do not start implementation until all verification queries pass.

5. **Begin Phase 7B implementation** per the commit sequence in `docs/phase-7b-plan.md §13`.

---

## Before Touching Any Implementation

Read all three of these documents in full at the start of the session:

1. `docs/platform-architecture.md` — canonical architecture reference; governs all decisions
2. `docs/phase-7-plan.md` — Phase 7A decisions and binding constraints
3. `docs/phase-7b-plan.md` — Phase 7B plan, public visibility audit, state machine, RLS design, migration SQL

Do not begin implementation without reading them.

---

## Pending: Phase 7A Commit 5

**What it does:** Adds a card to the regular-user `/dashboard` view. If the user has no `organizers` row, the card links to `/become-organizer`. If they do have a row, the card links to `/organizer`.

**File:** `app/dashboard/page.tsx` only.

**Implementation:**
- In the regular-user view's data fetch (`Promise.all`), add `fetchOrganizer(supabase)` as a third item alongside submissions and saved events.
- After the header and before saved events, insert a card:
  - No organizer row: `Building2` icon (blue-400), "Organise events on AlbaGo", ArrowRight → `/become-organizer`
  - Has organizer row: `Building2` icon (blue-400), "Organizer dashboard", ArrowRight → `/organizer`
- Style: `rounded-3xl border border-white/10 bg-white/[0.03] p-6 flex items-center justify-between`
- Import `fetchOrganizer` from `@/lib/organizers`

**No migration required.**

---

## Canonical Documents

### `docs/platform-architecture.md`
**Version 2.0. Canonical system reference.** Supersedes v1.0.
- Three-layer architecture: Discovery / Organizer / Commerce
- Actor definitions and permission model
- Event lifecycle visibility matrix
- Permission matrix across all tables
- Security boundary hierarchy (RLS > RPC > server guard > frontend)
- Event origin taxonomy
- Mermaid system maps
- Anti-patterns: what NOT to do

**Authoritative source for:** architecture, permissions, moderation philosophy, security boundaries.

### `docs/phase-7-plan.md`
Phase 7 full vision (7A–7E) + Phase 7A binding decisions and implementation detail.
- SQL migration for `organizers` + `organizer_onboarding_responses`
- `create_organizer()` RPC
- 5-commit sequence for Phase 7A
- Browser test checklist

**Authoritative source for:** Phase 7A rollout, organizer table schema.

### `docs/phase-7b-plan.md`
Phase 7B plan — event lifecycle and organizer event management.
- Public Visibility Audit (complete inventory of all events queries — all already safe)
- Event schema v2 (new columns: `organizer_id`, `origin`, `banner_url`, `published_at`, `admin_note`)
- Event state machine (formal transitions, forbidden paths)
- Ownership rules, public visibility rules per actor/state
- RPC function contracts (4 functions, full SQL)
- Organizer edit permissions per state
- Admin override permissions
- SQL migration block (§10) + verification queries (§11) + rollback SQL
- 6-commit sequence (Commits 5–10)
- 8 binding decisions

**Authoritative source for:** Phase 7B rollout, event lifecycle, migration planning, lifecycle rules.

### `docs/schema-reference.md`
Canonical schema reference — every production table, column, constraint, index, RLS policy.
- 9 tables: `profiles`, `events`, `event_submissions`, `places`, `saved_events`, `organizers`, `organizer_onboarding_responses`, `cities`
- Phase 7B additions clearly marked throughout
- All shared functions and triggers
- Access control summary table
- 8 schema evolution rules
- 6 known technical debt items

**Authoritative source for:** exact column types, nullability, constraints, indexes, RLS policy names.

---

## Binding Architecture Decisions

These are locked. Any deviation requires explicit discussion and a document update first.

| Decision | Detail |
|---|---|
| Organizer is a capability, not a role | Determined by presence of `organizers` row; `profiles.role` stays 'user'. No `is_organizer()` function. |
| `event_submissions` is permanent | Community funnel coexists with organizer events forever. Never merged, never retired. |
| `events.organizer_id` is nullable | NULL = admin-seeded or community-promoted. Non-null = organizer created. |
| TEXT + CHECK, never ENUM | Adding a new status value requires only a migration to the CHECK constraint, not `ALTER TYPE`. |
| RLS is the final security boundary | Frontend validation is UX only. RLS enforces at the DB. Server guards are UX gates, not security. |
| No UPDATE RLS policy on `events` | All state changes and field edits are RPC-only. |
| Dual moderation queues stay separate | `event_submissions` and `events` state machine are independent pipelines with separate admin UIs. |
| No `quantity_sold` on `event_tickets` | Compute from `ticket_purchases` COUNT via a Postgres function. No cached aggregates. |
| Organizer onboarding required before event creation | Enforced by redirect: `/organizer/events/new` → `/onboarding/organizer` if no organizer row. |
| Slugs are permanent | `events.slug` and `organizers.slug` are set at creation, never regenerated. |
| Soft deletes preferred | For audit trail preservation. Hard deletes require explicit justification. |
| `origin` column is immutable | Set at event creation, never updated. Captures the entry path. |

---

## Current Supabase Migration State

### Tables live in production

| Table | Migration | Notes |
|---|---|---|
| `auth.users` | Supabase-managed | |
| `profiles` | Pre-Phase 1 | `role` column is the access control signal |
| `events` | Pre-Phase 1 | `status` currently only has `'published'` rows; no CHECK constraint yet |
| `event_submissions` | Phase 2 + C2 hardening | RLS tightened 2026-05-11 |
| `places` | Phase 1 + Phase 6 slug backfill | |
| `saved_events` | Phase 5 | |
| `cities` | Phase 1 | |
| `organizers` | Phase 7A | Live; verified |
| `organizer_onboarding_responses` | Phase 7A | Live; verified |

### NOT YET APPLIED

**Phase 7B migration** — everything in `docs/phase-7b-plan.md §10`. Adds to `events`:
- `organizer_id`, `origin`, `banner_url`, `published_at`, `admin_note` columns
- CHECK constraints on `status` and `origin`
- 2 new indexes
- Replaces overly broad `events` SELECT RLS policy with 3 scoped policies
- 4 new RPC functions

⚠️ **The broad `"Enable read access for all users"` SELECT policy on `events` MUST be replaced before any organizer draft events are created.** This is the load-bearing migration moment. Run the full migration SQL block — do not run partial pieces.

---

## Current Routes

| Route | Auth | Works | Notes |
|---|---|---|---|
| `/` | Public | ✅ | |
| `/events` | Public | ✅ | |
| `/events/[slug]` | Public | ✅ | |
| `/places/[slug]` | Public | ✅ | |
| `/map` | Public | ✅ | |
| `/submit-event` | Required | ✅ | |
| `/dashboard` | Required | ✅ | Commit 5 (organizer card) pending |
| `/admin` | Admin only | ✅ | Server-guarded |
| `/sign-in` | Public | ✅ | |
| `/sign-up` | Public | ✅ | |
| `/become-organizer` | Public | ✅ | |
| `/onboarding/organizer` | Required | ✅ | |
| `/organizer` | Required (organizer) | ✅ | Dashboard skeleton; counts show 0 |

---

## Git State

| Item | Value |
|---|---|
| Branch | `main` |
| HEAD | `3cce73f` — "Docs: platform-architecture v2.0" |
| Remote | `origin/main` is at `3cce73f` (in sync) |
| Untracked files | `docs/phase-7b-plan.md`, `docs/schema-reference.md` |
| Working tree | Clean (aside from untracked docs) |

### Phase 7A commit log

| Hash | Commit | Status |
|---|---|---|
| `3cce73f` | Docs: platform-architecture v2.0 | ✅ Pushed |
| `04f03b2` | Phase 7A: /organizer dashboard skeleton + auth guards | ✅ Pushed |
| `dfc7343` | Phase 7A: /onboarding/organizer 3-step form | ✅ Pushed |
| `c001d3d` | Phase 7A: organizer types + lib + /become-organizer | ✅ Pushed |
| `a4ea92d` | Docs: save Phase 7 plan | ✅ Pushed |
| *(Commit 5)* | Phase 7A: /dashboard discoverability card | ❌ Not built yet |

---

## The Load-Bearing Risk

**The Phase 7B schema migration is the load-bearing moment.**

Once the migration runs:
- `events` will have `status` values other than `'published'`
- The current broad SELECT policy (`USING (true)`) would expose draft/rejected events to the public
- Every existing public query already filters `status = 'published'` — so the app code is safe
- But the RLS policy must be replaced **as part of the same migration** — not before, not after separately

**Run the full §10 migration block as a transaction. Do not run pieces of it.**

Verification queries in §11 confirm the policies are correctly replaced before any organizer creates drafts.

---

## Open Audit Items (from earlier sessions)

These are not blocking Phase 7B. Track for a future cleanup batch.

| Tag | Issue | Severity |
|---|---|---|
| H6 | Submissions with no `place_id` approved → event never on map | high |
| M1 | Submit-event ignores `?location=` referrer context | medium |
| M2 | `getLocationBySlug` silently falls back to Tirana for unknown slugs | medium |
| M4 | `SaveEventButton` has no error feedback on failure | medium |
| M5 | Admin approve has partial-failure window; needs RPC wrap | medium |
| M7 | No `sitemap.xml` / `robots.txt` | medium |
| M8 | Category list duplicated in 3+ files; centralize in `lib/categories.ts` | medium |
| M9 | "Open in Map" CTA dead when `place_id` is null | medium |

---

## Next Session Prompt Template

```
Read these three documents before starting:
- docs/platform-architecture.md
- docs/phase-7-plan.md
- docs/phase-7b-plan.md

Also read docs/schema-reference.md for the current table state.

Current state:
- Phase 7A commits 1–4 are live on Vercel.
- Two new docs (phase-7b-plan.md, schema-reference.md) need to be committed and pushed first.
- Commit 5 (discoverability card on /dashboard) is not built yet.
- Phase 7B migration has not been run.

Step 1: Commit and push the two new docs.
Step 2: Build and push Phase 7A Commit 5 (discoverability card).
Step 3: I will run the Phase 7B migration SQL from docs/phase-7b-plan.md §10 in Supabase.
Step 4: Walk me through verification queries §11. Wait for my confirmation.
Step 5: Begin Phase 7B implementation starting with Commit 7.

Same rules: plan-first, one commit at a time, wait for deployment verification before next commit.
```
