# AlbaGo — Next Session Handoff

**Last updated:** 2026-05-10
**Branch:** main
**Stack:** Next.js 16 (App Router) · React 19 · TypeScript · TailwindCSS v4 · Supabase · MapLibre GL
**Build status:** ✓ `next build` passes — 0 TypeScript errors. All 11 routes intact.
**Phase 3 status:** ✓ Verified end-to-end on 2026-05-09.
**Phase 4 status:** ✓ Verified and committed on 2026-05-10.
**Phase 5 status:** ✓ Verified and committed on 2026-05-10.
**Phase 6 status:** ✓ Browser-verified and committed on 2026-05-10.

---

## Session summary (2026-05-10)

This session shipped Phases 4 (event detail pages), 5 (saved events), and 6 (venue detail pages) — each with its own plan doc, browser verification, and commit. No scope creep across any of them.

Phase 6 mirrors Phase 4: a server-rendered detail route per venue, `generateMetadata` for SEO, and three callers redirected from `/map?place=...` to `/places/[slug]`. Upcoming events at the venue render with the existing card design plus heart buttons (Phase 5 reused).

---

## What was completed this session

### Phase 6 — Venue Detail Pages

**1. SQL pre-flight checks passed.** All four V1–V4 queries on `places.slug` came back clean. No backfill required.

**2. New route `/places/[slug]`** — server-rendered detail page.
- Server component using `lib/supabase/server.ts`
- Two queries: venue by slug, then upcoming events at this venue (`gte('date', today)`, `limit(30)`)
- Batched `saved_events` lookup with `.in('event_id', ...)` so the heart on each upcoming event card has the right initial state
- `notFound()` triggers default Next.js 404 if the slug doesn't resolve
- Layout: back link, category badge + Verified pill, title, address line, three CTAs (Open in Map, Get Directions, Website), About section, Upcoming events grid
- Empty state on venues with no upcoming events: "No upcoming events scheduled yet" + Browse events CTA
- About section omitted gracefully when description is empty
- "Get Directions" only renders when both `lat` and `lng` are present
- "Website" only renders when `website_url` is present

**3. SEO metadata** — `generateMetadata` exported from the route.
- Title: `${venue.name} — AlbaGo`
- Description: first 160 chars of venue.description, falling back to `${category} in ${city}` when no description
- OpenGraph: title, description, type=`profile`
- Title for missing slugs: `Venue not found — AlbaGo`

**4. Card href migration** — two callers now point at `/places/[slug]`.
- Homepage Trending Places card (was `/map?place=${id}&category=...`)
- Map's PlacePanel gains a primary blue "View details" button above the existing chips
- "Open in map" label on Trending Places cards relabeled to "View venue"

**5. `Place` type widened.** Added `slug: string`. Cascaded fix in `MapView.tsx` (single line `slug: p.slug` in the place mapping).

---

## Files changed and committed in Phase 6

| File | Action | What |
|---|---|---|
| `app/places/[slug]/page.tsx` | NEW | Server component, fetches venue + upcoming events + savedIds. `generateMetadata`. 404 on miss. |
| `types/place.ts` | Modify | Added `slug: string` to `Place` type |
| `app/page.tsx` | Modify | Place mapping includes `slug`; Trending Places card href → `/places/${slug}`; "Open in map" → "View venue" on place cards |
| `components/map/MapView.tsx` | Modify | One-liner: `slug: p.slug` in the place mapping (compile fix from Place widening; no behavior change) |
| `components/place/PlacePanel.tsx` | Modify | Imports `Link` and `ArrowRight`; adds a primary blue "View details" button at the top of the action area pointing to `/places/${slug}`; existing chips moved to a sibling row |
| `docs/phase-6-plan.md` | NEW | The plan |
| `docs/next-session.md` | Modify | This document |

**Seven files: two new, five modified.**

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
| Phase 6 — Venue detail pages | **Complete and verified** |
| Phase 7 | Not started — recommendations below |

---

## Current architecture state

### Pages

| Route | Auth | Component type | Notes |
|---|---|---|---|
| `/` | Public | Client | Featured events + Trending Places. Heart on event cards (logged-in). Trending Places now link to `/places/[slug]`. |
| `/events` | Public | Client (Suspense) | Event list + cross-location search. Cards link to detail pages. Heart on every card. |
| `/events/[slug]` | Public | **Server** | Phase 4. Heart in CTA row (size md). |
| `/places/[slug]` | Public | **Server** | Phase 6. Lists upcoming events with heart buttons. |
| `/map` | Public | Client | MapLibre map. PlacePanel has a "View details" button → `/places/[slug]`. |
| `/submit-event` | Required | Client | Auth-gated form with venue search |
| `/dashboard` | Required | Server | "Saved events" section above existing content for both admin and regular users |
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
  savedEvents.ts       Phase 5 — fetchSavedEventIds(), saveEvent(), unsaveEvent()
  supabase/
    browser.ts         createClient() for client components
    server.ts          createClient() for server components
    client.ts          legacy re-export shim → browser.ts (safe to keep)
    middleware.ts      session refresh helper
proxy.ts               Next.js 16 middleware
```

### Supabase tables

| Table | Key columns | RLS | Notes |
|---|---|---|---|
| `events` | `status`, `slug`, `location_slug`, `place_id`, `search_vector` | Public read where `status='published'` | Slug confirmed populated and unique |
| `places` | `status`, `slug`, `location_slug`, `search_vector`, `address`, `website_url`, `lat`, `lng`, `verified` | Public read | **Slug confirmed populated and unique (Phase 6 pre-flight)** |
| `event_submissions` | `status`, `submitted_by_user_id`, `place_id`, `admin_note` | Submitter + admin | |
| `cities` | `slug`, `name`, `country`, `region`, `lat`, `lng` | Public read | |
| `profiles` | `id`, `role` ('user'\|'admin') | Self read | |
| `saved_events` | `user_id`, `event_id`, `saved_at`, UNIQUE(user_id, event_id) | Self only (SELECT/INSERT/DELETE all `user_id = auth.uid()`) | |

---

## Recommended next: Phase 7 options

Choose one. All build cleanly on top of Phase 6.

**Option A — Saved venues (recommended)**
Symmetric to Phase 5. New `saved_places` table with the same per-user RLS pattern. Heart button on Trending Places cards, the venue detail page, and (optional) the map place panel. Dashboard gets a "Saved venues" section. Same shape as Phase 5 — should ship faster the second time.

**Option B — Custom 404 pages**
Smaller polish. `app/events/[slug]/not-found.tsx` and `app/places/[slug]/not-found.tsx` — friendly empty states with browse CTAs instead of the default Next.js 404. One session at most.

**Option C — Past events tab on venue pages**
Toggle between Upcoming and Past on `/places/[slug]`. Two queries instead of one; `lt('date', today) ORDER BY date DESC`. Surfaces venue history.

**Option D — Map clustering**
Independent quality-of-life win as the venue count grows. MapLibre GeoJSON cluster source.

**Option E — OpenGraph images**
Once event/venue covers exist (or generated banners per category), wire into `openGraph.images` for richer social sharing previews. Bigger lift if image storage isn't yet wired.

---

## Exact next steps for next session

1. Pick a Phase 7 direction.
2. Plan-first via `docs/phase-7-plan.md`.
3. Get approval, then implement.

---

## Next Session First Prompt

```
Read docs/next-session.md and CLAUDE.md before starting.

Context:
- Phases 1, 2, 3, 4, 5, 6 are complete, verified, and committed.
- main is clean.
- Build passes. 11 routes including /events/[slug] and /places/[slug].

I want to start Phase 7: [A — saved venues / B — custom 404 / C — past events
tab / D — map clustering / E — OG images].

Propose docs/phase-7-plan.md covering scope, files, tests, risks, rollback.
Wait for approval before implementing.

Same rules: plan first, get approval, implement.
```
