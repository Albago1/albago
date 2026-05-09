# Phase 4 — Event Detail Pages

**Status:** Plan — awaiting approval before implementation
**Depends on:** Phase 3 verified (cross-location search + DB-driven cities) and the May 9 UX polish batch (location desync fix, Enter-to-search, empty states, stats label) — both shipped in `edb17b4`.
**Goal:** Give every event its own URL, page, and metadata. Unblocks SEO, sharing, and the foundation for saved events / ticketing.

---

## What Phase 4 does

Three concrete deliverables:

1. **New server-rendered route `app/events/[slug]/page.tsx`** that displays full event details: title, date/time, venue, address, description, primary CTAs to open the map and get directions.

2. **`generateMetadata` for SEO and social sharing** — title, description, OpenGraph fields. The first SEO surface the platform has had.

3. **Card href migration** — three callers stop pointing event cards at `/map?place=...` and start pointing at `/events/[slug]`. The map remains accessible as a secondary CTA *from* the event page.

### What Phase 4 deliberately does NOT do

- No image uploads / cover image storage (cover area uses a gradient placeholder)
- No saved events / favorites button
- No comments, ratings, share-count, or social signals
- No organizer edit / cancel buttons (separate phase)
- No venue detail page `/places/[id]` (sibling phase, after this)
- No `generateStaticParams` — keep the route dynamic for now, events change frequently
- No schema changes (the pre-flight SQL checks confirmed `slug` is populated and unique)

---

## Pre-flight checks — already passed

```
[x] All published events have non-empty slugs (0 rows)
[x] No slug collisions (0 rows)
[x] Anon role can SELECT published events (1 row, no permission error)
```

No SQL migration needed for this phase.

---

## File changes

| File | Action | What |
|---|---|---|
| `app/events/[slug]/page.tsx` | **NEW** | Server component, fetches event + venue, renders detail page, exports `generateMetadata` |
| `app/page.tsx` | Modify | Featured Events card href: `getEventMapHref()` → `/events/${event.slug}`. Search-suggestion event item href: `/events?q=...` → `/events/${ev.slug}`. Add `slug` to `SuggestionEvent` type and the suggestion `select(...)`. Add `slug` to the featured events query and `Event` mapping. |
| `app/events/page.tsx` | Modify | Event card href: `buildMapHref()` → `/events/${event.slug}`. The `buildMapHref` helper stays (used by the "Open in map" secondary action on the detail page). |

**Three files total: one new, two modified.**

---

## Route design

### `app/events/[slug]/page.tsx`

Server component. Next.js 16 + React 19 — `params` is a Promise.

```ts
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { getLocationBySlug } from '@/lib/locations'

type Params = { slug: string }

async function fetchEvent(slug: string) {
  const supabase = await createClient()
  const { data } = await supabase
    .from('events')
    .select('*, places ( id, name, address, lat, lng, website_url, image_url )')
    .eq('status', 'published')
    .eq('slug', slug)
    .maybeSingle()
  return data
}

export async function generateMetadata(
  { params }: { params: Promise<Params> }
): Promise<Metadata> {
  const { slug } = await params
  const event = await fetchEvent(slug)
  if (!event) return { title: 'Event not found — AlbaGo' }
  const description = (event.description ?? '').slice(0, 160)
  return {
    title: `${event.title} — AlbaGo`,
    description,
    openGraph: { title: event.title, description, type: 'article' },
  }
}

export default async function EventPage(
  { params }: { params: Promise<Params> }
) {
  const { slug } = await params
  const event = await fetchEvent(slug)
  if (!event) notFound()
  const location = getLocationBySlug(event.location_slug)
  // ...render
}
```

### Page layout

Reuses existing visual language (dark background, glass cards, blue accents). No new design tokens.

```
┌──────────────────────────────────────────────────────────┐
│ LandingNavbar                                            │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  ← Back to events                                        │
│                                                          │
│  [category badge]  [Hot]  [price (if any)]               │
│                                                          │
│  Event Title (h1, large)                                 │
│                                                          │
│  📅 Sat, May 18  · ⏰ 22:00  · 📍 Tirana, Albania        │
│                                                          │
│  [ Open in Map ]   [ Get Directions ]   [ Website ↗ ]    │
│                                                          │
│  ── Venue ───────────────────────────────────────────    │
│  Venue Name                                              │
│  123 Some Street, Tirana                                 │
│                                                          │
│  ── About this event ────────────────────────────────    │
│  Full description text. No truncation.                   │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

### CTA URL generation

- **Open in Map** → existing `buildMapHref(event, '')` semantics: `/map?location=${slug}&place=${place_id}` (+ time hint if today/weekend)
- **Get Directions** → `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}` (only shown if venue has lat/lng)
- **Website** → external link (only shown if `places.website_url` present), `target="_blank"` + `rel="noopener noreferrer"`

Per `docs/platform-architecture.md` §6: do not store external map URLs in DB, generate from coordinates at render time.

### 404 handling

`notFound()` triggers Next.js's default 404. Optional: a custom `app/events/[slug]/not-found.tsx` with a friendly "Event not found, browse all events" CTA. **Defer to Phase 5** — default 404 is fine for now.

---

## Card href migration

### `app/page.tsx`

**Featured Events query** — add `slug` to the mapped `Event` shape so cards have it.

```ts
// Currently:
setFeaturedEvents(eventsRes.data.map((e) => ({
  id: e.id,
  title: e.title,
  // ...
})))

// Change: include e.slug
```

The `Event` type in `types/event.ts` may need `slug` added (verify before implementing).

**Featured Events card href** — change from `getEventMapHref(event.placeId, event.date)` to `/events/${event.slug}`.

**Search suggestion event item** — change `SuggestionEvent` type to include `slug`, fetch it in the ilike query, and link to `/events/${ev.slug}` instead of `/events?q=${title}`.

**Helpers** — `getEventMapHref` may become unused on this page. Verify and delete if so.

### `app/events/page.tsx`

**Event card href** — change `buildMapHref(event, searchQuery)` to `/events/${event.slug}`. `buildMapHref` stays in the file (used by the detail page CTA), or move it to a shared util.

**The "Open in map" arrow at the bottom of cards** — relabel to "View event" so the affordance matches the destination.

---

## Test checklist

| # | Test | Expected |
|---|---|---|
| 1 | Visit `/events/{real-slug}` | Page renders with title, date, venue, description |
| 2 | Visit `/events/nonexistent-slug` | 404 page |
| 3 | View page source | `<title>` and meta description present |
| 4 | Click event card on `/` (Featured Events) | Navigates to detail page |
| 5 | Click event card on `/events` | Navigates to detail page |
| 6 | Click event suggestion on home search | Navigates to detail page |
| 7 | "Open in Map" CTA on detail page | Opens `/map` with correct place selected |
| 8 | "Get Directions" CTA | Opens Google Maps in new tab with correct lat/lng |
| 9 | Website link (if venue has one) | Opens website in new tab |
| 10 | Event without place_id | Page renders, "Get Directions" hidden, "Open in Map" still works (just no marker) |
| 11 | Event without description | Page renders, About section shows graceful empty state or omits |
| 12 | Mobile (≤ 375px width) | Layout doesn't break, CTAs stack |
| 13 | Direct URL load (no referrer) | Renders correctly server-side |
| 14 | Build (`npm run build`) | 0 TypeScript errors, route appears in build output as `/events/[slug]` |

---

## Risks and edge cases

**Slug not present on a featured event**
The `featuredEvents` mapping currently doesn't pull `slug`. Adding it is safe but every reference to `event.slug` must check it's a string before using. Mitigation: include `slug` in the query and the `Event` type; if a row somehow has null slug, hide the card.

**RLS on places join**
The `select('*, places (...)')` join requires the anon role to read both `events` and `places`. Both are already publicly readable per Phases 1–2. Verify with a quick incognito test before declaring the route done.

**`buildMapHref` lives in `app/events/page.tsx`**
The detail page wants to call it too. Two options: (a) duplicate the function inline in the detail page; (b) extract to `lib/eventLinks.ts`. **Recommendation: option (b)** — small shared helper, no new abstraction surface.

**Server component + Supabase server client**
`lib/supabase/server.ts` exists and is the right import. Confirm it accepts being called from a route's default async export with no cookies-mutation requirement.

**OpenGraph images**
Not in scope. The `openGraph` field will only have title + description. Adding images is a separate small task once event covers exist.

**Stale data**
Server component renders on each request by default (no caching configured). For now this is fine — events are infrequent. If RSC caching becomes a concern later, set `export const revalidate = 60` or similar.

**`getEventMapHref` on home page**
If this helper becomes unused after migration, delete it. If it's still used (e.g., by the place cards that link to `/map?place=...&time=tonight`), leave it alone. Verify by grep before deleting.

**Card visual regression**
The card itself doesn't change — only its href. Hover states, badges, and layout are untouched. The bottom-right "Open in map" label changes to "View event" so the affordance matches.

---

## Order of execution

1. Verify `Event` type in `types/event.ts` accepts `slug` (add if missing).
2. Extract `buildMapHref` to `lib/eventLinks.ts` if we go with the shared-helper approach.
3. Write `app/events/[slug]/page.tsx` (route + metadata + page).
4. Test the route in isolation with a known slug.
5. Migrate `app/page.tsx` card hrefs (Featured Events + suggestions). Add `slug` to queries and types.
6. Migrate `app/events/page.tsx` card href. Relabel "Open in map" → "View event".
7. Run `npm run build` — confirm 0 TS errors and `/events/[slug]` appears in the route table.
8. Manual browser checklist (14 items).
9. Commit.

---

## Estimated work

One focused session. The route file is ~80 lines. Card migration is mechanical. Metadata + 404 handling are stock Next.js patterns.

---

## Rollback plan

Revert the commit. No DB changes, no schema changes, no external state. Card hrefs return to map-pointing. Detail route disappears. No data loss possible.

---

## After Phase 4

Natural follow-ups, in priority order:

1. **Saved events** — heart button on cards + dashboard "Saved" tab. Now that events have URLs, saving is meaningful.
2. **Venue detail pages `/places/[id]`** — same shape as event pages but for venues. Reuses the detail-page template.
3. **OpenGraph images** — once event covers are uploadable.
4. **Custom 404 for `/events/[slug]/not-found.tsx`** — friendly redirect.
5. **Map clustering** — independent of detail pages; whenever the map starts to feel crowded.
