# AlbaGo — Next Session Handoff

**Last updated:** 2026-05-09
**Branch:** master · last commit: `39ad5fd` (all current work is uncommitted)
**Stack:** Next.js 16 (App Router) · React 19 · TypeScript · TailwindCSS v4 · Supabase · MapLibre GL
**Build status:** ✓ `next build` passes — 0 TypeScript errors, 0 compile errors
**Phase 3 status:** ✓ Verified end-to-end in browser. Cross-location full-text search works. DB-driven city dropdowns confirmed.

---

## Session summary (2026-05-09)

This session covered Phase 3 browser verification and a small, high-impact UX polish batch. No new Phase was started. All changes are uncommitted.

The 5-item polish batch focused on bugs that would block Phase 4 from feeling clean:
- a silent location-input/active-slug desync on the homepage
- no Enter-to-search on either search input
- generic empty-state copy that didn't differentiate filter-miss from genuinely-empty cities
- a stats row that mixed global numbers with location-scoped page content

---

## What was completed this session

### 1. Phase 3 browser verification — passed

Cross-location full-text search activates on a typed query, city badges appear on result cards, the "Showing results across all cities" note renders, and clearing the query returns to browse mode. Location dropdowns on `/`, `/events`, `/submit-event`, and `/map` all read from the `cities` table via `useLocations()` with the hardcoded array as instant fallback.

SQL spot-checks (`search_vector IS NULL` queries, `cities` SELECT) returned the expected results.

**Phase 3 is done.** No remaining tasks before Phase 4.

### 2. UX polish batch — five fixes

**Homepage location input desync — fixed**
The previous behavior allowed the visible location label to drift from `activeLocationSlug`. A user who typed "Ber" and clicked outside (or pressed Search) silently slugified to `ber` and produced an empty events page.

Changes in `app/page.tsx`:
- Removed `resolveLocationSlug()` entirely — it was the source of the slugify-garbage path.
- `buildSearchUrl()` now takes a slug directly. All four call sites (Search button, Browse Events CTA, View-all Events, View-all Map) pass `activeLocationSlug`.
- Click-outside on the location dropdown now commits or reverts: if the typed text exactly matches a known city label (case-insensitive), it activates that city; otherwise it restores `prevLocationLabel.current`.
- Pressing **Enter** on the location input applies the same commit-or-revert rule and closes the dropdown.
- Added `locationOptionsRef` so the click-outside handler can read the latest options without rebinding.
- Category-pill links and the Tonight CTA now use `activeLocationSlug` instead of resolving from the typed input.

**Enter-to-search — added**
- Homepage search input: `Enter` → `router.push(buildSearchUrl('/events', activeLocationSlug, searchQuery))`. Imports `useRouter` from `next/navigation`.
- Events page search input: `Enter` → `setDebouncedSearch(searchQuery)` immediately, bypassing the 350ms debounce.

**Events page empty state — three variants**
The previous single message ("No events match this filter yet") covered three different situations confusingly. Replaced with conditional copy:
1. Search mode + zero results → `No events match "query"` + "Try a different keyword, or clear the search to browse a city."
2. Browse mode + active slug not in `locationOptions` (GPS-resolved unknown city) → `No upcoming events near you yet` + featured-cities chips that switch the active location on click.
3. Browse mode + known location → original copy preserved.

**Homepage stats row — labeled scope**
Added a small uppercase caption "Across the platform" above the three counters so users understand the numbers are global, not scoped to the active city.

---

## Files changed this session (all uncommitted)

| File | What changed |
|---|---|
| `docs/next-session.md` | This document |
| `app/page.tsx` | Removed `resolveLocationSlug`; `buildSearchUrl` now takes slug; click-outside + Enter commit-or-revert on location input; Enter-to-search on search input; stats row "Across the platform" caption; imports `useRouter` |
| `app/events/page.tsx` | Enter-to-search bypasses debounce; empty state has 3 variants (search-miss / unknown-city with featured-cities chips / filter-miss) |

Plus the 7 files modified in the prior session (still uncommitted):
- `app/sign-in/page.tsx`, `app/sign-up/page.tsx` — back link
- `app/admin/page.tsx`, `app/dashboard/page.tsx` — LandingNavbar + `pt-24`
- `components/layout/LandingNavbar.tsx` — user avatar pill + dropdown, mobile sign-out moved to hamburger

Untracked: `docs/phase-3-plan.md`, `docs/phase-3-verification.md`.

---

## Current Phase status

| Phase | Status |
|---|---|
| Phase 1 — Venue foundation | Complete |
| Phase 2 — Auth + submissions + moderation | Complete |
| Stabilization pass | Complete |
| Phase 3 — Global full-text search + DB-driven locations | **Complete and verified** |
| UX polish batch (May 9) | Complete |
| Phase 4 | Not started — recommendation below |

---

## Current architecture state

### Pages

| Route | Auth | Component type | Notes |
|---|---|---|---|
| `/` | Public | Client | Home: search, location, featured events/places. Stats row labeled "Across the platform". |
| `/events` | Public | Client (inside Suspense) | Full event list + cross-location full-text search. Empty state has 3 variants. |
| `/map` | Public | Client | MapLibre map — LandingNavbar returns null here |
| `/submit-event` | Required | Client | Auth-gated form with venue search |
| `/dashboard` | Required | Server | Admin stats + actions OR user submissions list |
| `/admin` | Admin only | Client | Approve/reject submissions |
| `/sign-in` | Public | Client | Supabase auth, supports `?next=` redirect |
| `/sign-up` | Public | Client | Supabase auth |

### Key lib files

```
lib/
  locations.ts         LocationOption[], getLocationBySlug(), fetchLocations()
                       DB column is 'name'; code maps to 'label' in LocationOption
  useLocations.ts      'use client' hook — instant fallback array + DB update
  dateFilters.ts       isToday(), isThisWeekend(), getTodayDateString()
  supabase/
    browser.ts         createClient() for client components
    server.ts          createClient() for server components
    client.ts          legacy re-export shim → browser.ts (safe to keep)
    middleware.ts      session refresh helper
proxy.ts               Next.js 16 middleware (named proxy, not middleware)
```

### Supabase tables

| Table | Key columns | Notes |
|---|---|---|
| `events` | `status`, `slug`, `location_slug`, `place_id`, `search_vector` | Full-text via tsvector. **`slug` already exists** — needed for Phase 4. |
| `places` | `location_slug`, `search_vector`, `address`, `website_url` | Full-text via tsvector |
| `event_submissions` | `status`, `submitted_by_user_id`, `place_id`, `admin_note` | |
| `cities` | `slug`, `name`, `country`, `region`, `lat`, `lng` | Column is `name` not `label`. Anon SELECT policy confirmed. |
| `profiles` | `id`, `role` ('user'\|'admin') | Auto-created by trigger on auth.users INSERT |

---

## Recommended next: Phase 4 — Event detail pages `/events/[slug]`

This is the highest-value next step and unblocks several downstream features.

### Why this phase

Today, every event card on `/` and `/events` links to `/map?place=...&time=...`. The map opens with a marker. There is no place where an event has its own URL, no description page, no shareable link, no SEO surface. For a discovery platform this is the single biggest content gap. Saving events, social sharing, ticketing, and venue detail pages all become more valuable once events have proper homes.

### Scope (smallest viable cut)

**1. New route: `app/events/[slug]/page.tsx`**
Server component (good for SEO and initial render speed). Fetches:
- The event by slug from `events` where `status = 'published'`
- The associated venue from `places` (left join via `place_id`) for name, address, lat/lng, website
- The location label via `getLocationBySlug(event.location_slug)`

If the slug isn't found or the event isn't published → `notFound()` → Next.js 404.

**2. Page content (above the fold)**
- Category badge + Hot badge (if highlighted)
- Title (large)
- Date · Time · City label
- Venue name (linked to `/map?place=ID` for now)
- Address (if present)
- Description (full text, no truncation)
- Two CTAs: "Open in Map" (existing map URL) and "Get Directions" (Google Maps URL generated from venue lat/lng — pattern from `docs/platform-architecture.md` § 6)
- Optional: external website link (if venue has `website_url`)

**3. Metadata (for SEO and sharing)**
`generateMetadata({ params })` returning title, description, OG image (placeholder until images are real). This is the SEO win.

**4. Wire up event card hrefs**
Update three callers to point at `/events/[slug]` instead of `/map?place=...`:
- `app/page.tsx` Featured Events card (currently `getEventMapHref(...)`)
- `app/events/page.tsx` event card (currently `buildMapHref(...)`)
- Homepage search suggestion event item (currently `/events?q=...`) — change to `/events/[slug]` so suggestion-click goes straight to the event

Keep "Open in Map" as a secondary CTA on the detail page so users can still see the venue context.

**5. Slug uniqueness sanity check**
Before shipping, run a SQL check:
```sql
SELECT slug, COUNT(*) FROM events GROUP BY slug HAVING COUNT(*) > 1;
```
If duplicates exist, fix them in DB before deploying. Going forward, slug should be set on insert (already happens — verify the submit-event path).

### What Phase 4 deliberately does NOT do

- No saved events / favorites (that's a separate phase, depends on event detail being shareable)
- No comments, ratings, or social signals
- No image uploads (event covers stay aspirational until image storage is wired)
- No edit-event UI for organizers (separate phase)
- No `/places/[id]` venue detail pages (sibling phase)
- No restructuring of the `events` table schema

### Estimated work

One session if scoped tight. The route file is the main work; metadata and href updates are mechanical.

### Risks

- **Slug collisions** if any exist. Fix in DB first.
- **Server-rendered Supabase query** — needs `lib/supabase/server.ts` (already exists). Confirm RLS allows server-side reads of `events` where `status = 'published'`.
- **Card link visual regression** — the existing "Open in map" arrow on cards should be relabeled or kept consistent with the new primary navigation.

### Pre-Phase-4 SQL check (run before starting)

```sql
-- 1. Confirm all published events have slugs
SELECT id, title FROM events WHERE status = 'published' AND (slug IS NULL OR slug = '');
-- Expected: 0 rows

-- 2. Confirm no slug collisions
SELECT slug, COUNT(*) FROM events GROUP BY slug HAVING COUNT(*) > 1;
-- Expected: 0 rows

-- 3. Confirm anon role can SELECT events
SELECT id, title, slug FROM events WHERE status = 'published' LIMIT 1;
-- Expected: 1 row, no permission error
```

If any of these fail, fix the data before writing the route.

---

## Other future options (not recommended for next session)

- **Venue detail pages `/places/[id]`** — natural sibling of event pages, but lower discovery impact. Do after event pages.
- **Saved events** — small migration + UI; depends on event pages existing.
- **Map clustering** — quality-of-life for the map page; independent of everything else.
- **"Tonight" / "This weekend" rails on the homepage** — surfaces existing filters more prominently. Pure UX, no schema change.

---

## Exact next steps for next session

1. Decide whether to commit the current 10 uncommitted files first (recommended — clean slate before Phase 4).
2. Run the three pre-Phase-4 SQL checks above.
3. If checks pass: design the route file, get plan approval, implement.

---

## Next Session First Prompt

```
Read docs/next-session.md and CLAUDE.md before starting.

Context:
- Phases 1, 2, 3, stabilization, and a UX polish pass are all complete and verified.
- 10 files uncommitted on master.
- Build passes. Phase 3 browser-tested.

I want to proceed with Phase 4: event detail pages /events/[slug].

Before writing code:
1. Run the three pre-Phase-4 SQL checks from next-session.md and report results.
2. Propose docs/phase-4-plan.md covering:
   - Route file structure (server component, server-side Supabase query, notFound handling)
   - generateMetadata for SEO
   - Page layout: title, date/time, venue, address, description, primary CTAs (Map / Directions)
   - Card href migration plan (homepage, events page, search suggestions)
   - Slug uniqueness handling
3. Wait for approval before implementing.

Same rules: plan first, get approval, then implement. Small, reversible commits.
```
