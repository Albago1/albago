# AlbaGo — Next Session Handoff

**Last updated:** 2026-05-10
**Branch:** main
**Stack:** Next.js 16 (App Router) · React 19 · TypeScript · TailwindCSS v4 · Supabase · MapLibre GL
**Build status:** ✓ `next build` passes — 0 TypeScript errors. Route `/events/[slug]` registered as dynamic.
**Phase 3 status:** ✓ Verified end-to-end on 2026-05-09.
**Phase 4 status:** ✓ Browser-verified and committed on 2026-05-10.

---

## Session summary (2026-05-10)

This session implemented and shipped Phase 4 (event detail pages) per `docs/phase-4-plan.md`. No scope creep.

The 14-test browser checklist passed. Phase 4 is fully landed.

---

## What was completed this session

### Phase 4 — Event detail pages

**1. New route `/events/[slug]`** — server-rendered detail page.
- Server component using `lib/supabase/server.ts`
- Single Supabase query joins `events` to `places` for venue info
- `notFound()` triggers default Next.js 404 if slug doesn't exist or `status ≠ 'published'`
- Page layout: back link, category/Hot/price badges, title, date/time/city row, three CTAs, Venue card, About section
- `Get Directions` only renders when venue has `lat` and `lng`
- `Website` only renders when venue has `website_url`
- `About` section omitted when description is empty
- Uses existing dark/glass visual language; no new design tokens

**2. SEO metadata** — `generateMetadata` exported from the route.
- Title: `${event.title} — AlbaGo`
- Description: first 160 chars of event description
- OpenGraph: title, description, type=`article` (image deferred — out of scope)
- Title for missing slugs: `Event not found — AlbaGo`

**3. Card href migration** — three callers now point at `/events/[slug]`.
- Homepage Featured Events card
- Homepage search-suggestion event item (was `/events?q=...`)
- Events page event card
- "Open in map" label relabeled to "View event" on event cards. Trending Places cards on the homepage still say "Open in map" (those still go to the map).

**4. Shared link helpers extracted** — `lib/eventLinks.ts`.
- `buildMapHref({ location_slug, place_id, date }, query?)` — moved from `app/events/page.tsx`
- `buildDirectionsHref(lat, lng)` — generates Google Maps URL from coordinates (per `docs/platform-architecture.md` §6: never store external map URLs in DB)

---

## Files changed and committed this session

| File | Action | What |
|---|---|---|
| `app/events/[slug]/page.tsx` | NEW | Server component, fetches event + venue, `generateMetadata`, three CTAs, About section, 404 on miss |
| `lib/eventLinks.ts` | NEW | `buildMapHref` (moved) + `buildDirectionsHref` (new) |
| `types/event.ts` | Modify | Added `slug: string` to `Event` type |
| `app/page.tsx` | Modify | Removed `getEventMapHref` and unused date filter imports; `SuggestionEvent` type and ilike query include `slug`; featured-events mapping includes `slug`; suggestion link → `/events/${slug}`; featured event card href → `/events/${slug}`; "Open in map" → "View event" on event cards (place cards untouched) |
| `app/events/page.tsx` | Modify | `buildMapHref` removed (now in `lib/eventLinks.ts`); event card href → `/events/${event.slug}`; "Open in map" → "View event" |
| `components/map/MapView.tsx` | Modify | One-liner: `slug: e.slug` in the event mapping (compile fix from the `Event` type widening; no behavior change) |
| `docs/phase-4-plan.md` | NEW | Plan written before implementation |
| `docs/next-session.md` | Modify | This document |

**Eight files total: three new, five modified.**

---

## Current Phase status

| Phase | Status |
|---|---|
| Phase 1 — Venue foundation | Complete |
| Phase 2 — Auth + submissions + moderation | Complete |
| Stabilization pass | Complete |
| Phase 3 — Global full-text search + DB-driven locations | Complete and verified |
| UX polish batch (May 9) | Complete |
| Phase 4 — Event detail pages | **Complete and verified** |
| Phase 5 | Not started — recommendations below |

---

## Current architecture state

### Pages

| Route | Auth | Component type | Notes |
|---|---|---|---|
| `/` | Public | Client | Home: search, location, featured events/places. Featured events link to detail pages. |
| `/events` | Public | Client (Suspense) | Event list + cross-location search. Cards link to detail pages. |
| `/events/[slug]` | Public | **Server** | Phase 4: event detail page with SEO metadata. |
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
  useLocations.ts      'use client' hook — instant fallback array + DB update
  dateFilters.ts       isToday(), isThisWeekend(), getTodayDateString()
  eventLinks.ts        Phase 4 — buildMapHref(), buildDirectionsHref()
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
| `events` | `status`, `slug`, `location_slug`, `place_id`, `search_vector` | `slug` confirmed populated and unique. Public detail-page key. |
| `places` | `location_slug`, `search_vector`, `address`, `website_url`, `lat`, `lng` | Joined into the detail-page query |
| `event_submissions` | `status`, `submitted_by_user_id`, `place_id`, `admin_note` | |
| `cities` | `slug`, `name`, `country`, `region`, `lat`, `lng` | |
| `profiles` | `id`, `role` ('user'\|'admin') | |

---

## Recommended next: Phase 5 options

Choose one. All build cleanly on top of Phase 4.

**Option A — Saved events (recommended)**
Now that events have URLs, saving is meaningful. Small migration: `saved_events(user_id, event_id, saved_at)` table, RLS policies, heart button on cards, Saved tab on dashboard. One focused session.

**Option B — Venue detail pages `/places/[id]`**
Mirror of Phase 4 for venues. Reuses the detail-page template. Lets a user open a venue page showing all upcoming events at that venue + address + map embed.

**Option C — Custom 404 for `/events/[slug]/not-found.tsx`**
Smaller polish. Friendly empty state with "Browse all events" CTA instead of the default Next.js 404.

**Option D — OpenGraph images for event pages**
Once event covers exist (or a generated banner per category), wire them into the `openGraph.images` field for richer social sharing previews.

---

## Exact next steps for next session

1. Pick a Phase 5 direction.
2. Plan-first via `docs/phase-5-plan.md`.
3. Get approval, then implement.

---

## Next Session First Prompt

```
Read docs/next-session.md and CLAUDE.md before starting.

Context:
- Phases 1, 2, 3, 4 are complete, verified, and committed.
- main is clean and matches origin/main.
- Build passes.

I want to start Phase 5: [Option A — saved events / B — venue detail pages /
C — custom 404 / D — OG images].

Propose docs/phase-5-plan.md covering scope, files to touch, test checklist,
risks, and rollback. Wait for approval before implementing.

Same rules: plan first, get approval, implement.
```
