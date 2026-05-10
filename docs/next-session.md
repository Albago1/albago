# AlbaGo — Next Session Handoff

**Last updated:** 2026-05-10
**Branch:** main
**Stack:** Next.js 16 (App Router) · React 19 · TypeScript · TailwindCSS v4 · Supabase · MapLibre GL
**Build status:** ✓ `next build` passes — 0 TypeScript errors. 11 routes intact.
**Phases 1–6:** Complete and verified.
**Audit batch (May 10):** Complete and committed.

---

## Session summary (2026-05-10)

This session shipped Phases 4 (event detail pages), 5 (saved events), 6 (venue detail pages), and an **audit batch** addressing the highest-impact issues found in a senior-level audit (security, UX dead-ends, open-redirect, data correctness, visual polish).

The audit batch landed as a single commit covering 7 fixes plus a FilterBar polish.

---

## Audit batch — what shipped

### C1 — Admin role guard on `/admin`
The admin route now does a server-side check: redirects to `/sign-in?next=/admin` if not authenticated, redirects to `/dashboard` if `profile.role !== 'admin'`. Previously any logged-in user could load the admin UI. The page is split into `app/admin/page.tsx` (server component, the guard) and `app/admin/AdminClient.tsx` (the existing client logic — state, approve/reject, JSX). Mirrors the pattern already used by `/dashboard`.

### C2 — SQL verification for `event_submissions` policies
**Not yet run.** The verification query was provided but the user committed before reporting results. **Action for next session:** run the query in Supabase and report. If policies are too permissive, send a follow-up SQL tightening.

```sql
SELECT policyname, cmd, roles, qual, with_check
FROM pg_policies
WHERE tablename = 'event_submissions'
ORDER BY policyname;
```

Looking for: SELECT restricted to `submitted_by_user_id = auth.uid()` (or admin); INSERT with `with_check` enforcing same; UPDATE/DELETE admin-only.

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
| **Audit batch (May 10)** | **Complete and committed** |
| Phase 7 | Not started — recommendations below |

---

## Audit findings still open (deferred from this session)

The audit identified more issues than this batch shipped. Open items, in rough priority order:

| Tag | Issue | Severity | Notes |
|---|---|---|---|
| C2 | SQL verification of `event_submissions` policies | critical | Run query above, report. May need policy tightening. |
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
| `event_submissions` | **C2 verification pending** — run the SQL above. |
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

1. **Run the C2 SQL verification** and report results. This is the only remaining critical audit item.
2. Pick a Phase 7 direction.
3. Plan-first via `docs/phase-7-plan.md`.
4. Get approval, then implement.

---

## Next Session First Prompt

```
Read docs/next-session.md and CLAUDE.md before starting.

Context:
- Phases 1, 2, 3, 4, 5, 6 + audit batch are complete and committed.
- main is clean. Build passes.
- C2 SQL verification still pending — please run the query in next-session.md
  and report the policies on event_submissions.

After C2:
- I want to start Phase 7: [A — saved venues / B — close audit M-tier /
  C — H6 stopgap / D — custom 404 / E — map clustering].

Propose docs/phase-7-plan.md covering scope, files, tests, risks, rollback.
Wait for approval before implementing.

Same rules: plan first, get approval, implement.
```
