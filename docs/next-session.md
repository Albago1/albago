# AlbaGo — Next Session Handoff

**Last updated:** 2026-05-11
**Branch:** main · last work commit `b22bad1` (audit batch)
**Push state:** main is up to date with origin/main (audit batch + docs already pushed).
**Stack:** Next.js 16 (App Router) · React 19 · TypeScript · TailwindCSS v4 · Supabase · MapLibre GL
**Build status:** ✓ `next build` passes — 0 TypeScript errors. 11 routes intact (last verified 2026-05-10).
**Phases 1–6:** Complete and verified.
**Audit batch (May 10):** Complete and committed.
**C2 RLS hardening (May 11):** Complete and verified — database-only migration, no code change.

---

## Session summary (2026-05-10)

This session shipped Phases 4 (event detail pages), 5 (saved events), 6 (venue detail pages), and an **audit batch** addressing the highest-impact issues found in a senior-level audit (security, UX dead-ends, open-redirect, data correctness, visual polish).

The audit batch landed as a single commit covering 7 fixes plus a FilterBar polish.

---

## Audit batch — what shipped

### C1 — Admin role guard on `/admin`
The admin route now does a server-side check: redirects to `/sign-in?next=/admin` if not authenticated, redirects to `/dashboard` if `profile.role !== 'admin'`. Previously any logged-in user could load the admin UI. The page is split into `app/admin/page.tsx` (server component, the guard) and `app/admin/AdminClient.tsx` (the existing client logic — state, approve/reject, JSX). Mirrors the pattern already used by `/dashboard`.

### C2 — `event_submissions` RLS tightening (resolved 2026-05-11)
Verification query exposed three problems on `event_submissions`:

1. **`submissions_public_insert` with `WITH CHECK true`** — wide-open INSERT, any caller (incl. anonymous), bypassed the stricter `submissions_insert`.
2. **`Anyone can create event submissions` with `WITH CHECK (status = 'pending')`** — also permitted anonymous inserts.
3. **Duplicate / dead policies:** `Admins can read submissions`, `submissions_admin_select`, `Admins can update submissions`, plus the inert `Users cannot read submissions publicly` (qual=false, contributes nothing under RLS OR semantics).

Database migration applied (manual SQL):

```sql
DROP POLICY IF EXISTS "submissions_public_insert" ON event_submissions;
DROP POLICY IF EXISTS "Anyone can create event submissions" ON event_submissions;
DROP POLICY IF EXISTS "Users cannot read submissions publicly" ON event_submissions;
DROP POLICY IF EXISTS "Admins can read submissions" ON event_submissions;
DROP POLICY IF EXISTS "submissions_admin_select" ON event_submissions;
DROP POLICY IF EXISTS "Admins can update submissions" ON event_submissions;
```

Final policy set on `event_submissions` (4 policies):

| policyname | cmd | rule |
|---|---|---|
| `submissions_insert` | INSERT | `auth.uid() IS NOT NULL AND submitted_by_user_id = auth.uid()` |
| `submissions_select` | SELECT | `submitted_by_user_id = auth.uid() OR is_admin()` |
| `submissions_admin_update` | UPDATE | `is_admin()` |
| `submissions_admin_delete` | DELETE | `is_admin()` |

Verified live via `SET LOCAL ROLE anon` insert test (rejected, 42501) and `SET LOCAL ROLE authenticated` + spoofed `submitted_by_user_id` insert test (also rejected). Legitimate signed-in submit flow unchanged; `/submit-event` still redirects anonymous users at the auth gate.

**No code changes.** App-side submit form (`app/submit-event/page.tsx` line 119) already sets `submitted_by_user_id: user.id`, so the tightened policy was already compatible.

### H1 — `/events?time=tonight` activates the time filter
Events page now reads `?time=` from URL on mount with a `'tonight' | 'weekend'` whitelist. The URL-sync effect writes `time=` when the active filter is non-default. The homepage Tonight CTA now actually filters the events page.

### H3 — LandingNavbar visible on `/map`
Removed the `if (pathname === '/map') return null` early-return. On `/map` the navbar uses a slightly more transparent background (`bg-[#070b14]/55`) so the map shows through. FilterBar's top offset moved from `top-4`/`top-3` to `top-20` so it clears the 64px navbar.

### H4 — Sign-up redirect / message behavior
After `signUp` succeeds, if `data.session` is non-null (email confirmation disabled), `router.push('/')` + `router.refresh()`. Otherwise the message reads "Account created. Check your email to confirm, then sign in." with a green pill **Go to sign in →** linking to `/sign-in`.

### H5 — Sign-in `next` open-redirect protection
`next` parameter now must start with `/`, NOT start with `//`, NOT start with `/\`. Anything else falls back to `/`. Closes the protocol-relative URL hole.

### M3 — Inactive venues 404 on `/places/[slug]`
`fetchVenue` adds `.or('status.eq.active,status.is.null')` so `pending` and `inactive` venues 404 instead of rendering. Null branch keeps legacy data working in case `status` was added with a default but pre-existing rows weren't backfilled.

### L6 — Verified badge gated on `place.verified`
Trending Places mapping in `app/page.tsx` now includes `verified: p.verified ?? false`. The "Verified" chip is wrapped in `{place.verified && (...)}` so it only shows for venues actually marked verified.

### FilterBar UX polish (extra this session)
`/map` filters were too visually heavy after the navbar appeared. The desktop bar shrank from ~225px tall to ~110px:
- Width 720px → 600px, padding `p-3` → `p-2`, lighter shadow
- Removed redundant Home button and inner LanguageSwitcher (both in navbar now)
- Time + category chips in one row, smaller (`px-3 py-1.5 text-xs rounded-full`)
- **Tags row hidden by default** behind a `Tags` expand button (only renders when `availableOptionChips.length > 0`)
- Stats and Reset collapsed from chunky pills to a thin text line at the bottom
- Mobile bar: removed Home button, tightened padding from `p-2.5` → `p-2`. Bottom sheet untouched.

All filter functionality preserved.

---

## Files changed and committed

| File | Action | What |
|---|---|---|
| `app/admin/page.tsx` | Rewrite | Server component — auth + admin role guard, redirects on fail. Renders `<AdminClient />` only after both pass. |
| `app/admin/AdminClient.tsx` | NEW | Existing admin client logic (state, approve/reject, JSX) lifted out of `page.tsx`. |
| `app/events/page.tsx` | Modify | Read `?time=` from URL on mount; URL-sync effect now also writes `time=`. |
| `app/page.tsx` | Modify | Place mapping includes `verified`; Verified badge gated on `place.verified`. |
| `app/places/[slug]/page.tsx` | Modify | `fetchVenue` adds `.or('status.eq.active,status.is.null')`. |
| `app/sign-in/page.tsx` | Modify | `next` parameter validated against `//` and `/\` prefixes. |
| `app/sign-up/page.tsx` | Modify | Redirect on session; prominent sign-in link otherwise. |
| `components/layout/LandingNavbar.tsx` | Modify | Renders on `/map` with slightly transparent background. |
| `components/layout/FilterBar.tsx` | Modify | Slimmer desktop + mobile layouts; tags collapsed; `top-20` for navbar clearance. |
| `docs/next-session.md` | Modify | This document. |

**Ten files: one new, nine modified.**

---

## Current Phase status

| Phase | Status |
|---|---|
| Phase 1 — Venue foundation | Complete |
| Phase 2 — Auth + submissions + moderation | Complete |
| Stabilization pass | Complete |
| Phase 3 — Global full-text search + DB-driven locations | Complete and verified |
| UX polish batch (May 9) | Complete |
| Phase 4 — Event detail pages | Complete and verified |
| Phase 5 — Saved events | Complete and verified |
| Phase 6 — Venue detail pages | Complete and verified |
| Audit batch (May 10) | Complete and committed |
| **C2 RLS tightening (May 11)** | **Complete and verified — DB only** |
| Phase 7 | Not started — recommendations below |

---

## Audit findings still open

C2 is resolved (see section above). Remaining open items, in rough priority order:

| Tag | Issue | Severity | Notes |
|---|---|---|---|
| H6 | Submitted events with new venue → `place_id = null` after approval, never on map | high | Architectural gap. Stopgap: refuse approval when `place_id IS NULL`. Full fix: in-app venue linker for admins. |
| M1 | Submit-event location dropdown ignores referrer context | medium | Read `?location=` from URL on mount; pass through from homepage CTA. |
| M2 | `getLocationBySlug` silently falls back to Tirana for unknown slugs | medium | Synthesize a fallback `LocationOption` from the slug instead. |
| M4 | `SaveEventButton` shows no error feedback to user on save failure | medium | Add 3-sec inline tooltip. |
| M5 | Admin approve flow has partial-failure window (insert events ok, update submission fails) | medium | Wrap in a Postgres function (`approve_submission(submission_id)`). |
| M6 | Hero CTAs on homepage are desktop-tuned; huge on mobile | medium | Drop to `px-6 py-3 text-base` below sm breakpoint. |
| M7 | No `sitemap.xml` or `robots.txt` | medium | Static `app/robots.ts` + dynamic `app/sitemap.ts` listing event/venue slugs. |
| M8 | Hardcoded category list duplicated in 3+ files | medium | Centralize in `lib/categories.ts`. Pure refactor. |
| M9 | "Open in Map" CTA on event detail page is a dead link when `place_id` is null | medium | Hide or rename when null. |
| L1–L10 | Various small polish items | low | See audit transcript for details. |

---

## Current architecture state

### Pages

| Route | Auth | Component type | Notes |
|---|---|---|---|
| `/` | Public | Client | Featured events + Trending Places. Heart on event cards (logged-in). Verified badge gated. |
| `/events` | Public | Client (Suspense) | Cross-location search. Heart on cards. **Reads `?time=` from URL.** |
| `/events/[slug]` | Public | Server | Phase 4. Heart in CTA row. |
| `/places/[slug]` | Public | Server | Phase 6. **Filters out inactive/pending venues.** |
| `/map` | Public | Client | MapLibre. **LandingNavbar now visible.** Slimmer FilterBar. |
| `/submit-event` | Required | Client | |
| `/dashboard` | Required | Server | Saved events section + submissions/admin actions |
| `/admin` | **Admin only (server-guarded)** | **Server** | Phase: split into server guard + AdminClient. |
| `/sign-in` | Public | Client | Open-redirect protection on `next=`. |
| `/sign-up` | Public | Client | Redirects on session; pill link to sign-in. |

### Key lib files

```
lib/
  locations.ts         LocationOption[], getLocationBySlug(), fetchLocations()
  useLocations.ts      'use client' hook — instant fallback array + DB update
  dateFilters.ts       isToday(), isThisWeekend(), getTodayDateString()
  eventLinks.ts        Phase 4 — buildMapHref(), buildDirectionsHref()
  savedEvents.ts       Phase 5 — fetchSavedEventIds(), saveEvent(), unsaveEvent()
  supabase/
    browser.ts         createClient() for client components
    server.ts          createClient() for server components
    middleware.ts      session refresh helper
proxy.ts               Next.js 16 middleware
```

### Supabase tables

| Table | Notes |
|---|---|
| `events` | `slug` populated and unique. RLS public read where `status='published'`. |
| `places` | `slug` populated and unique. `verified` boolean — UI now respects it. RLS public read. |
| `event_submissions` | RLS hardened 2026-05-11 — 4 policies (insert-self / select-own-or-admin / update-admin / delete-admin). |
| `cities` | RLS public read confirmed. |
| `profiles` | Self read only. `role` ('user'\|'admin'). |
| `saved_events` | Per-user RLS (SELECT/INSERT/DELETE all `user_id = auth.uid()`). |

---

## Recommended next: Phase 7 options

Choose one. All build cleanly on top of the audit batch.

**Option A — Saved venues (recommended)**
Symmetric to Phase 5. New `saved_places` table with the same per-user RLS pattern. Heart button on Trending Places cards, the venue detail page, and (optional) the map place panel. Dashboard gets a "Saved venues" section.

**Option B — Run C2 + close audit M-tier**
Run the C2 SQL verification, then knock down M1, M2, M4, M6, M7, M8, M9 in one focused batch. Smaller per-item but high cumulative polish.

**Option C — H6 stopgap (refuse approval without venue link)**
The "submissions with no place_id" architectural gap. One-line guard on the admin approve action; full venue-linker UI is half a session.

**Option D — Custom 404 pages**
`/events/[slug]/not-found.tsx` and `/places/[slug]/not-found.tsx` with friendly empty states.

**Option E — Map clustering**
Independent quality-of-life. MapLibre GeoJSON cluster source.

---

## Exact next steps for next session

1. Pick a Phase 7 direction (see options above).
2. Plan-first via `docs/phase-7-plan.md`.
3. Get approval, then implement.

No critical audit items remain. Submissions surface is locked down at the DB level. Code-side follow-ups (M5 atomic admin approve, H6 admin venue-link UI) can be folded into a Phase 7 batch or deferred.

---

## Next Session First Prompt

```
Read docs/next-session.md and CLAUDE.md before starting.

Context:
- Phases 1–6 + May 10 audit batch + May 11 C2 RLS hardening are all complete.
- main is clean. Build passes.
- No critical audit items remain.

I want to start Phase 7: [A — saved venues / B — close audit M-tier /
  C — H6 stopgap / D — custom 404 / E — map clustering].

Propose docs/phase-7-plan.md covering scope, files, tests, risks, rollback.
Wait for approval before implementing.

Same rules: plan first, get approval, implement.
```
