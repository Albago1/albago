# Phase 7 — Organizer Platform Foundation

**Status:** Plan — Phase 7A approved 2026-05-14; sub-phases 7B–7E pending.
**Depends on:** Phases 1–6 complete, Vercel deployment live, Supabase `is_admin()` function present (added during the C2 RLS work).
**Goal:** Evolve AlbaGo from a curated event/venue directory into a real organizer platform — organizers onboard, create draft events through a guided wizard, define a ticket model, and submit for admin review. Approved events render on the existing `/events/[slug]` surface enriched with banner and tickets.

This document captures the **full Phase 7 vision** so future sessions have context, then narrows to the **Phase 7A MVP batch** which is the only scope being implemented right now.

---

## Scope map

| Sub-phase | Scope | Status |
|---|---|---|
| **7A** | Organizer profile + onboarding survey + dashboard skeleton | **In progress (this batch)** |
| 7B | Event creation wizard + draft system + banner upload | Planned |
| 7C | Ticket model + admin moderation extension + public event page enrichment | Planned |
| 7D | Public organizer profile pages `/o/[slug]` | Deferred |
| 7E | Real checkout + payments + purchases table | Deferred (separate large phase) |

Sub-phases are commit-boundary signals, not separate planning artifacts. The whole org platform is "Phase 7" in the project log.

---

## Phase 7A — what ships in this batch

### Deliverables

1. **Two new tables** — `organizers` (1:1 with `auth.users`) and `organizer_onboarding_responses` (private survey data).
2. **RLS policies** — public read on `organizers`, owner-only writes; owner-or-admin read on onboarding responses.
3. **Atomic onboarding RPC** — `create_organizer(...)` writes both rows in a single call, runs as the caller so RLS still applies.
4. **`/become-organizer`** — public landing page with a value pitch and a "Get started" CTA.
5. **`/onboarding/organizer`** — three-step form (Profile → Survey → Confirm). Anonymous users redirected to sign-in; users who already have an organizer row redirected to `/organizer`.
6. **`/organizer`** — server-guarded dashboard skeleton with greeting, zero-state counts strip, empty state, and a disabled "Create event — Coming soon" placeholder.
7. **`/dashboard` discoverability** — a single card visible only to users without an organizer row, linking to `/become-organizer`.

### Explicitly NOT in 7A

- Event creation wizard (Phase 7B)
- Tickets — model, UI, or anything (Phase 7C)
- Banner uploads / Supabase Storage bucket (Phase 7B)
- Admin moderation extension for organizer events (Phase 7C)
- Public organizer profile pages `/o/[slug]` (Phase 7D)
- Payments, checkout, purchases table (Phase 7E)
- Modifying `events` table schema (deferred to 7B)
- Modifying `/submit-event` or `event_submissions` table (parallel surface preserved)
- New navbar surfaces — discovery is via `/dashboard` only in this batch

---

## Decisions (confirmed 2026-05-14)

These resolve the open questions from the planning conversation and are now binding for the MVP:

1. **Onboarding is required** before an organizer can create their first event. `/organizer` redirects to `/onboarding/organizer` if no organizer row exists.
2. **1:1 organizer ↔ user model** for MVP. `organizers.id = auth.users.id`. Teams come later as an `organizer_members` table; non-breaking migration path.
3. **Client-generated slug** as `slugify(display_name) + '-' + nanoid(6)`. On UNIQUE constraint violation, retry with a fresh suffix; if retry fails twice, surface a clean inline error.
4. **Survey-field gating** — only `display_name` and `contact_email` are required. All survey questions are optional product intelligence, never blocking.
5. **Currency default** — EUR. Not relevant in 7A (no tickets yet) but recorded for 7C.
6. **`event_submissions` fate** — untouched throughout Phase 7. Retire only after organizer flow is proven externally.
7. **Wizard venue scope** — force pick from existing `places` in 7B. No "add new venue" sub-flow in MVP.

---

## SQL migration

Single block, idempotent, transaction-safe. Paste into Supabase SQL editor in production. Verification queries below.

```sql
-- ============================================================
-- AlbaGo — Phase 7A migration
-- Creates: organizers, organizer_onboarding_responses
-- Adds:    RLS policies, updated_at trigger, create_organizer() RPC
-- Idempotent: re-runnable.
-- ============================================================

-- 1. organizers ---------------------------------------------------
CREATE TABLE IF NOT EXISTS public.organizers (
  id              uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name    text NOT NULL,
  slug            text NOT NULL UNIQUE,
  bio             text,
  contact_email   text NOT NULL,
  website_url     text,
  verified        boolean NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS organizers_slug_idx ON public.organizers (slug);

-- 2. organizer_onboarding_responses -------------------------------
CREATE TABLE IF NOT EXISTS public.organizer_onboarding_responses (
  organizer_id              uuid PRIMARY KEY REFERENCES public.organizers(id) ON DELETE CASCADE,
  event_types               text[] NOT NULL DEFAULT '{}',
  attendee_age_ranges       text[] NOT NULL DEFAULT '{}',
  expected_attendance_size  text,
  expected_yearly_revenue   text,
  events_per_year           text,
  created_at                timestamptz NOT NULL DEFAULT now()
);

-- 3. updated_at trigger -------------------------------------------
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS organizers_set_updated_at ON public.organizers;
CREATE TRIGGER organizers_set_updated_at
  BEFORE UPDATE ON public.organizers
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- 4. Enable RLS ---------------------------------------------------
ALTER TABLE public.organizers                       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organizer_onboarding_responses   ENABLE ROW LEVEL SECURITY;

-- 5. organizers RLS -----------------------------------------------
DROP POLICY IF EXISTS organizers_select_public        ON public.organizers;
DROP POLICY IF EXISTS organizers_insert_self          ON public.organizers;
DROP POLICY IF EXISTS organizers_update_self_or_admin ON public.organizers;
DROP POLICY IF EXISTS organizers_delete_admin         ON public.organizers;

-- Public read: needed for "By {organizer}" on public event pages and /o/[slug] later.
CREATE POLICY organizers_select_public
  ON public.organizers
  FOR SELECT
  USING (true);

-- Authenticated user can create their own row.
CREATE POLICY organizers_insert_self
  ON public.organizers
  FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Self-update OR admin (admin needed for verification, moderation).
CREATE POLICY organizers_update_self_or_admin
  ON public.organizers
  FOR UPDATE
  USING      (auth.uid() = id OR public.is_admin())
  WITH CHECK (auth.uid() = id OR public.is_admin());

-- Delete: admin only. No self-delete in MVP.
CREATE POLICY organizers_delete_admin
  ON public.organizers
  FOR DELETE
  USING (public.is_admin());

-- 6. organizer_onboarding_responses RLS ---------------------------
DROP POLICY IF EXISTS onboarding_select_self_or_admin ON public.organizer_onboarding_responses;
DROP POLICY IF EXISTS onboarding_insert_self          ON public.organizer_onboarding_responses;
DROP POLICY IF EXISTS onboarding_update_self          ON public.organizer_onboarding_responses;
DROP POLICY IF EXISTS onboarding_delete_admin         ON public.organizer_onboarding_responses;

-- Private survey data: owner or admin only.
CREATE POLICY onboarding_select_self_or_admin
  ON public.organizer_onboarding_responses
  FOR SELECT
  USING (auth.uid() = organizer_id OR public.is_admin());

CREATE POLICY onboarding_insert_self
  ON public.organizer_onboarding_responses
  FOR INSERT
  WITH CHECK (auth.uid() = organizer_id);

CREATE POLICY onboarding_update_self
  ON public.organizer_onboarding_responses
  FOR UPDATE
  USING      (auth.uid() = organizer_id)
  WITH CHECK (auth.uid() = organizer_id);

CREATE POLICY onboarding_delete_admin
  ON public.organizer_onboarding_responses
  FOR DELETE
  USING (public.is_admin());

-- 7. Atomic onboarding write --------------------------------------
CREATE OR REPLACE FUNCTION public.create_organizer(
  p_display_name              text,
  p_slug                      text,
  p_contact_email             text,
  p_website_url               text,
  p_event_types               text[],
  p_attendee_age_ranges       text[],
  p_expected_attendance_size  text,
  p_expected_yearly_revenue   text,
  p_events_per_year           text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_user_id uuid := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.organizers (
    id, display_name, slug, contact_email, website_url
  ) VALUES (
    v_user_id, p_display_name, p_slug, p_contact_email, p_website_url
  );

  INSERT INTO public.organizer_onboarding_responses (
    organizer_id, event_types, attendee_age_ranges,
    expected_attendance_size, expected_yearly_revenue, events_per_year
  ) VALUES (
    v_user_id,
    COALESCE(p_event_types, '{}'),
    COALESCE(p_attendee_age_ranges, '{}'),
    p_expected_attendance_size,
    p_expected_yearly_revenue,
    p_events_per_year
  );

  RETURN v_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_organizer(
  text, text, text, text, text[], text[], text, text, text
) TO authenticated;
```

### Verification queries

```sql
-- Tables exist
SELECT tablename FROM pg_tables
WHERE schemaname='public'
  AND tablename IN ('organizers','organizer_onboarding_responses');

-- Policies in place (expect 8 rows: 4 on each table)
SELECT tablename, policyname, cmd
FROM pg_policies
WHERE schemaname='public'
  AND tablename IN ('organizers','organizer_onboarding_responses')
ORDER BY tablename, cmd, policyname;

-- Anon cannot insert
SET LOCAL ROLE anon;
INSERT INTO public.organizers (id, display_name, slug, contact_email)
VALUES (gen_random_uuid(), 'x', 'x-test', 'x@x.com');   -- expect 42501
RESET ROLE;
```

### Rollback

No data exists immediately after migration. Full reversal:

```sql
DROP FUNCTION IF EXISTS public.create_organizer(text, text, text, text, text[], text[], text, text, text);
DROP TABLE IF EXISTS public.organizer_onboarding_responses;
DROP TABLE IF EXISTS public.organizers;
-- public.set_updated_at() is shared infrastructure — leave it.
```

---

## Onboarding form design

Single page, three steps, mobile-first. Form state held in a single `useReducer` keyed by step. No external form library.

### Step 1 — Profile (only required fields live here)

| Field | Required | Notes |
|---|---|---|
| Display name | Yes | Slug derived from this. Max ~60 chars. |
| Contact email | Yes | Defaults to signed-in user's email. |
| Website URL | No | Optional. Light URL validation (must start `http`). |

### Step 2 — About your events (all optional)

| Field | Type | Options |
|---|---|---|
| Event types | Multi-select chips | Nightlife · Music · Food & Drink · Sports · Culture · Tech · Workshops · Family · Other |
| Attendee age ranges | Multi-select | 18–24 · 25–34 · 35–44 · 45+ |
| Expected attendance per event | Single select | <50 · 50–200 · 200–500 · 500–2000 · 2000+ |
| Expected yearly revenue | Single select | <€1k · €1k–10k · €10k–50k · €50k–200k · €200k+ |
| Events per year | Single select | 1–5 · 5–20 · 20–50 · 50+ |

"Skip for now" is allowed at the step level. Every survey field empty must still produce a successful submission.

### Step 3 — Confirm

Summary card showing display name + email + a count of survey answers. "Looks good — get started" CTA.

### Submit behavior

1. Generate slug: `slugify(displayName) + '-' + nanoid(6)`.
2. Call `create_organizer(...)` RPC.
3. On UNIQUE violation (`23505` on `organizers_slug_key`): regenerate slug, retry once. If retry also fails, surface inline error "Couldn't reserve that name, try a slightly different display name."
4. On other errors: inline error, do not redirect.
5. On success: `router.replace('/organizer')`.

---

## Affected files

### New files

| Path | Purpose |
|---|---|
| `docs/phase-7-plan.md` | This document (commit 1). |
| `types/organizer.ts` | `Organizer` interface, `OnboardingResponse` interface, survey option arrays. |
| `lib/organizers.ts` | `fetchOrganizer(supabase)`, `createOrganizer(supabase, input)`, `slugifyOrganizer(displayName)`, retry helper. |
| `app/become-organizer/page.tsx` | Public landing — hero + value pitch + "Get started" CTA. |
| `app/onboarding/organizer/page.tsx` | Server guard: anon → `/sign-in?next=/onboarding/organizer`; organizer exists → `/organizer`; else render `<OnboardingClient />`. |
| `app/onboarding/organizer/OnboardingClient.tsx` | Three-step client form, calls RPC on submit. |
| `app/organizer/page.tsx` | Server guard: anon → sign-in; no organizer row → `/onboarding/organizer`; else render `<OrganizerDashboardClient organizer={...} />`. |
| `app/organizer/OrganizerDashboardClient.tsx` | Dashboard shell — greeting, counts strip (all zero), empty state, disabled "Create event — Coming soon" CTA. |

### Modified files

| Path | Change |
|---|---|
| `app/dashboard/page.tsx` | Add a single discoverability card visible only when the user has no organizer row, linking to `/become-organizer`. ~15 lines. |

### Untouched

- `components/layout/LandingNavbar.tsx` — no nav surface in 7A; discovery via `/dashboard` only.
- `app/admin/*`, `app/events/*`, `app/places/*`, `app/submit-event/page.tsx`, `event_submissions` table.
- `proxy.ts` — existing matcher already covers new routes.
- `next.config.ts`, `package.json` — no new dependencies needed. `nanoid` will be added in commit 2 (small, no transitive bloat).

---

## Commit sequence

1. **`Docs: save Phase 7 plan`** — adds `docs/phase-7-plan.md`. No behavior change. **← this commit.**
2. **`Phase 7A: organizer types + lib + /become-organizer landing`** — `types/organizer.ts`, `lib/organizers.ts`, `app/become-organizer/page.tsx`. Adds `nanoid` to dependencies. Read-only routes shipped. Migration must already be live before this is deployed (since `lib/organizers.ts` references the new tables, though no query fires until commit 3).
3. **`Phase 7A: /onboarding/organizer 3-step flow`** — onboarding page + client. **First write surface.** Deploy + test full happy path on prod.
4. **`Phase 7A: /organizer dashboard skeleton + auth guards`** — server-guarded page + client shell. Deploy + test all redirect branches.
5. **`Phase 7A: /dashboard discoverability entry point`** — one card on `/dashboard`. Deploy + smoke test.

Each commit is independently deployable. Vercel auto-deploys on push to `main`.

---

## Browser test plan

Run on the live Vercel URL after each deploy.

### After SQL migration (no code shipped yet)

- ☐ All existing routes (`/`, `/events`, `/map`, `/sign-in`, `/dashboard`, `/admin`) still render — RLS additions are non-disruptive.

### After commit 2 (`/become-organizer` shipped)

- ☐ `/become-organizer` loads anonymous, mobile + desktop. Hero readable, CTA in the thumb zone.
- ☐ Anonymous → click CTA → routed through `/sign-up?next=/onboarding/organizer` (or `/sign-in`).
- ☐ Authenticated user with no organizer row → CTA goes to `/onboarding/organizer`.

### After commit 3 (onboarding shipped)

- ☐ Anonymous → `/onboarding/organizer` redirects to `/sign-in?next=/onboarding/organizer`.
- ☐ Authenticated, no organizer row → form renders, no horizontal scroll on a 360px viewport.
- ☐ Try advancing step 1 without display name OR contact email → "Next" disabled or inline error.
- ☐ Step 2 — all survey fields empty → "Next" still works. The survey is optional.
- ☐ Submit step 3 → `create_organizer` RPC fires → redirected to `/organizer`.
- ☐ Network tab: RPC returns 200, payload is the new organizer's UUID.
- ☐ Re-visit `/onboarding/organizer` after completion → auto-redirects to `/organizer`.
- ☐ Slug collision path: submit twice with the same display_name in two sessions → second submission retries successfully with a fresh suffix. (Hard to trigger naturally; spot-check by inspecting the second organizer's slug.)
- ☐ Double-submit (back button + re-submit) → second call fails cleanly (UNIQUE PK on `organizers.id`), UI surfaces a graceful error rather than crashing.
- ☐ DB spot-check via Supabase Studio: 1 row in `organizers`, 1 row in `organizer_onboarding_responses`, both keyed to your `auth.uid()`.

### After commit 4 (dashboard shipped)

- ☐ Anonymous → `/organizer` redirects to `/sign-in?next=/organizer`.
- ☐ Authenticated, no organizer row → `/organizer` redirects to `/onboarding/organizer`.
- ☐ Authenticated, organizer row exists → dashboard renders. Greeting uses `display_name`. Counts strip shows 0/0/0/0. Empty state visible. "Create event" CTA is disabled and labeled "Coming soon".
- ☐ Sign out → `/organizer` redirects to sign-in.
- ☐ Mobile (360px): no overflow, touch targets ≥44px.

### After commit 5 (discoverability shipped)

- ☐ `/dashboard` for a user with no organizer row → card appears.
- ☐ `/dashboard` for a user *with* an organizer row → card hidden.
- ☐ Click card → lands on `/become-organizer`.

### Cross-cutting smoke (end of batch)

- ☐ `/`, `/events`, `/events/[slug]`, `/places/[slug]`, `/map`, `/submit-event`, `/admin` — unchanged behavior verified once.

---

## Risks specific to 7A

1. **Slug collision UX** — addressed by client-side retry + clean error. Worst case: a user with a popular display name has to tweak it slightly.
2. **`is_admin()` dependency** — RLS policies assume `public.is_admin()` exists. Confirmed live from the C2 RLS work. If it ever moves, these policies need updating.
3. **Discoverability is one card on `/dashboard`** — intentionally low-key in MVP. If adoption is weak, Phase 7B can add a navbar entry point.
4. **Onboarding form length** — three steps, but only two truly required fields. Drop-off risk on the survey step is acceptable because the survey doesn't block.
5. **`create_organizer` is SECURITY INVOKER** — relies on RLS for safety, not function privileges. Tested by the verification queries.

---

## Rollout

1. ✅ Commit 1: save this plan doc, push to `main`.
2. **Wait for explicit go-ahead before running migration.**
3. Migration: paste SQL block into Supabase SQL editor, run verification queries.
4. Commits 2–5: each pushed individually, each deployed to Vercel, each tested per the plan above before the next.
5. After commit 5: update `docs/next-session.md` to reflect Phase 7A completion and queue 7B (event creation wizard).

---

## Out of scope reminder

If a request during 7A implementation touches any of these, push back and defer:

- Event creation, drafts, banners, tickets, payments, checkout
- Admin moderation UI changes
- Public organizer profile pages
- Navbar changes
- `events` or `event_submissions` schema or behavior changes
- Image uploads, Supabase Storage configuration

The MVP boundary is the firewall.
