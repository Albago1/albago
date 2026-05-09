# Phase 6 — Venue Detail Pages

**Status:** Plan — awaiting approval before implementation
**Depends on:** Phase 4 complete (event detail pages — same pattern, mirrored for venues)
**Goal:** Give every venue its own URL, page, and metadata. Mirrors Phase 4 for the `places` table. Surfaces "all upcoming events at this venue" — the missing bridge between event-first and venue-first browsing.

---

## What Phase 6 does

Three concrete deliverables:

1. **New server-rendered route `app/places/[slug]/page.tsx`** displaying venue details: name, category, address, description, plus a list of upcoming events at this venue with the existing card design and Save buttons.

2. **`generateMetadata` for SEO and social sharing** — same pattern as Phase 4. Title, description, OpenGraph type=`profile`.

3. **Card href migration** — two callers (Trending Places on the homepage, and the map's selected-place panel) gain a way to land on `/places/[slug]`. Map functionality is preserved as a sibling CTA.

### What Phase 6 deliberately does NOT do

- No saved venues / `saved_places` table
- No claim-this-venue flow (organizer/owner verification)
- No venue editing UI
- No new venue-submission form (separate from event submission)
- No image uploads or photo galleries
- No reviews, ratings, or comments
- No past events tab — only upcoming
- No pagination of upcoming events (cap at ~30, defer pagination until needed)
- No schema rename `places → venues` (deferred to a dedicated Phase per platform-architecture.md §11 Phase 6)

---

## Pre-flight SQL — run first

The `places` table has had a `slug` column added during Phase 1, but we must verify it is populated and unique before relying on it for routing.

### V1 — Does `places.slug` exist?

```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'places' AND column_name = 'slug';
```

**Pass:** 1 row returned (column exists). Note the `is_nullable` value.
**Fail:** 0 rows. Column missing — see "Backfill SQL" below.

### V2 — Are all slugs populated?

```sql
SELECT id, name FROM places WHERE slug IS NULL OR slug = '';
```

**Pass:** 0 rows.
**Fail:** Some places are missing slugs — see "Backfill SQL".

### V3 — Are slugs unique?

```sql
SELECT slug, COUNT(*) FROM places GROUP BY slug HAVING COUNT(*) > 1;
```

**Pass:** 0 rows.
**Fail:** Collisions exist — see "Backfill SQL".

### V4 — Anon role can SELECT a place by slug

```sql
SELECT id, name, slug FROM places LIMIT 1;
```

**Pass:** 1 row returned, no permission error.
**Fail:** RLS issue — verify the public-read policy on `places` (the same policy used for `/events` to read venue names should already cover this).

---

## Backfill SQL (run only if V1, V2, or V3 fail)

Idempotent, safe to re-run. Generates URL-safe slugs from the `name` column and disambiguates collisions by suffixing the first 6 chars of the venue's UUID.

```sql
-- 1. Ensure column exists
ALTER TABLE places ADD COLUMN IF NOT EXISTS slug text;

-- 2. Populate empty slugs from name
UPDATE places
SET slug = lower(regexp_replace(trim(name), '[^a-zA-Z0-9]+', '-', 'g'))
WHERE slug IS NULL OR slug = '';

-- 3. Trim leading/trailing dashes
UPDATE places
SET slug = regexp_replace(slug, '^-+|-+$', '', 'g')
WHERE slug LIKE '-%' OR slug LIKE '%-';

-- 4. Disambiguate any duplicates by appending the first 6 chars of the UUID.
--    Run this twice to catch any collisions introduced by step 2.
UPDATE places p
SET slug = p.slug || '-' || substring(p.id::text, 1, 6)
WHERE p.slug IN (
  SELECT slug FROM places GROUP BY slug HAVING COUNT(*) > 1
);

-- 5. Enforce going-forward
ALTER TABLE places ALTER COLUMN slug SET NOT NULL;

-- Idempotent unique index (safer than ADD CONSTRAINT for re-runs)
CREATE UNIQUE INDEX IF NOT EXISTS places_slug_key ON places(slug);
```

After running the backfill, re-run V1–V4 and confirm all four pass before any code changes.

---

## Files to touch

| File | Action | What |
|---|---|---|
| `app/places/[slug]/page.tsx` | **NEW** | Server component, fetches venue + upcoming events + user/savedIds. `generateMetadata`. 404 on miss. |
| `types/place.ts` | Modify | Add `slug: string` to `Place` type |
| `app/page.tsx` | Modify | Trending Places card href: `/map?place=${place.id}&category=...` → `/places/${place.slug}`. Include `slug` in the place mapping. |
| `components/map/MapView.tsx` | Modify | Add `slug: p.slug` to the place mapping (compile fix from `Place` type widening). Add a "View details" link inside the selected-place panel pointing to `/places/${selectedPlace.slug}`. Keep all existing map panel functionality. |
| `docs/phase-6-plan.md` | NEW | This plan |
| `docs/next-session.md` | Modify | Refresh after implementation |

**Six files: two new, four modified.**

---

## Route design

### `app/places/[slug]/page.tsx`

Server component using `lib/supabase/server.ts`. Mirrors Phase 4 exactly.

```ts
type Params = { slug: string }

async function fetchVenue(slug: string) {
  const supabase = await createClient()
  const { data } = await supabase
    .from('places')
    .select('id, slug, name, category, description, address, city, country, lat, lng, website_url, image_url, location_slug, verified, status')
    .eq('slug', slug)
    .maybeSingle()
  return data
}

async function fetchUpcomingEvents(venueId: string) {
  const supabase = await createClient()
  const today = new Date().toISOString().split('T')[0]
  const { data } = await supabase
    .from('events')
    .select('id, slug, title, date, time, category, highlight, price, place_id, location_slug')
    .eq('place_id', venueId)
    .eq('status', 'published')
    .gte('date', today)
    .order('date', { ascending: true })
    .order('time', { ascending: true })
    .limit(30)
  return data ?? []
}
```

`generateMetadata`:
- Title: `${venue.name} — AlbaGo`
- Description: first 160 chars of venue.description (or `${venue.category} in ${venue.city}` if no description)
- OpenGraph: title, description, type=`profile`

### Page layout

```
┌──────────────────────────────────────────────┐
│ LandingNavbar                                │
├──────────────────────────────────────────────┤
│  ← Back                                      │
│                                              │
│  [category badge]  [Verified ✓ if true]      │
│                                              │
│  Venue Name (h1, large)                      │
│  📍 Address · City, Country                  │
│                                              │
│  [ Open in Map ] [ Get Directions ]          │
│  [ Website ↗ ]                               │
│                                              │
│  ── About this venue ─────────────────────   │
│  Description (whitespace-pre-line)           │
│                                              │
│  ── Upcoming events ──────────────────────   │
│  [event card] [event card]                   │
│  [event card] [event card]                   │
│                                              │
│  Empty state: "No upcoming events scheduled  │
│  yet" + link to events page                  │
└──────────────────────────────────────────────┘
```

### CTA URL generation

- **Open in Map** → `/map?place=${venue.id}` (existing pattern, kept)
- **Get Directions** → `buildDirectionsHref(lat, lng)` from `lib/eventLinks.ts` (only when lat/lng both present)
- **Website** → external link with `target="_blank" rel="noopener noreferrer"`, only when `website_url` present

### Event cards on venue page

Reuse existing event card visuals. Each card:
- Wrapped in `<Link href="/events/[slug]">` (Phase 4)
- Contains the `<SaveEventButton>` (Phase 5)
- Server-side fetch of `user` and `savedIds` for these specific event IDs determines initial heart state

### 404 handling

`notFound()` triggers default Next.js 404. Custom 404 page deferred (same call as Phase 4).

---

## Detail of card href migration

### `app/page.tsx` (Trending Places)

The existing fetch already does `select('*')` on `places` — so `slug` is already in the response. But the current `Place` mapping doesn't include slug. Add it:

```ts
// After:
const mapped: Place[] = placesRes.data.map((p) => ({
  id: p.id,
  slug: p.slug,            // ← new
  name: p.name,
  // ...
}))
```

Card href change:
```tsx
// Before:
href={`/map?place=${place.id}&category=${place.category}`}

// After:
href={`/places/${place.slug}`}
```

### `components/map/MapView.tsx`

Two changes:
1. Add `slug: p.slug` to the place mapping (compile-time requirement after `Place` type widens)
2. In the selected-place panel JSX (look for `selectedPlace` rendering around line 200–250), add a small "View details" link/button that navigates to `/places/${selectedPlace.slug}`. Keep the rest of the panel — map filters, event count, etc. — untouched.

### Place card label

The Trending Places card on the homepage currently has "Open in map" at the bottom (matched to the old map-href destination). Change to "View venue" so the affordance matches the new destination.

---

## Test checklist

### SQL pre-flight (run before any code changes)

| # | Check | Expected |
|---|---|---|
| S1 | V1 — slug column exists | 1 row |
| S2 | V2 — no null/empty slugs | 0 rows |
| S3 | V3 — no slug collisions | 0 rows |
| S4 | V4 — anon SELECT works | 1 row, no permission error |

If any fail: run the backfill SQL, then re-run S1–S4.

### Browser tests (after implementation)

| # | Test | Expected |
|---|---|---|
| 1 | Visit `/places/{real-slug}` | Page renders: back link, badge, title, address, CTAs, About, Upcoming events |
| 2 | Visit `/places/nonexistent-slug` | Default 404 |
| 3 | View page source on `/places/{real-slug}` | `<title>` reads `{Venue Name} — AlbaGo`; meta description present |
| 4 | Click any Trending Places card on `/` | Navigates to `/places/{slug}`, NOT to `/map` |
| 5 | "Open in Map" CTA on venue page | Opens `/map?place={id}` and the marker is selected |
| 6 | "Get Directions" CTA | Opens Google Maps in new tab to venue's lat/lng |
| 7 | "Website" link | Opens venue website in new tab (only when `website_url` present) |
| 8 | Venue with `lat=null` or `lng=null` | "Get Directions" hidden; page renders correctly |
| 9 | Venue with empty description | About section omitted gracefully |
| 10 | Venue with no upcoming events | Empty state rendered: "No upcoming events scheduled yet" + link to `/events` |
| 11 | Venue with upcoming events | Cards render, click any → navigates to `/events/{event-slug}` |
| 12 | Heart on a venue-page event card while logged in | Saves correctly (Phase 5 still works on this surface) |
| 13 | Mobile width (≤375px) | Layout doesn't break, CTAs wrap |
| 14 | Map page: click a venue marker | Place panel opens with a "View details" link → `/places/{slug}` |
| 15 | Map page: existing place-panel features | Unchanged — event count, filter chips, marker behavior all still work |
| 16 | Trending Places card label | Reads "View venue", not "Open in map" |
| 17 | Build (`npm run build`) | 0 TS errors, `/places/[slug]` appears as dynamic |

---

## Risks and edge cases

**`Place` type widening cascades**
Adding `slug` to `Place` will surface compile errors in any other file that constructs a `Place` literal. Same pattern as Phase 4's Event widening — `MapView.tsx` is the only known consumer. If others surface, fix in the same commit.

**Slug column missing or partially populated**
The pre-flight catches both. If a backfill is needed, the SQL is conservative: it only touches rows where slug is NULL or empty, suffixes UUID fragments only on collisions, and uses `IF NOT EXISTS` everywhere. Re-running the backfill is safe.

**Slug uniqueness drifts post-Phase-6**
Going forward, every new place (whether admin-inserted or via the venue submission flow when it eventually exists) needs a slug. The `NOT NULL` constraint and `UNIQUE` index enforce this at the DB level. Anything that tries to insert a duplicate slug will fail loudly. Mitigation: the venue-submission flow (separate phase) must generate slugs at insert time.

**Performance on the venue page**
Two queries: one for the venue, one for upcoming events (capped at 30). Both index-friendly (slug PK-style; place_id + status + date for the events lookup). Sub-100ms even at scale.

**Stale upcoming events**
Queries use `gte('date', today)`. If the user keeps the page open past midnight, today's events that are now in the past will still display until reload. Acceptable.

**Cascade behavior on event delete**
Existing FK on `events.place_id` is `ON DELETE SET NULL` per Phase 4. If a venue is deleted, events become orphans. The venue page would simply show no events for the (now-deleted) venue, then 404 when navigated to. No corruption.

**Map panel "View details" link**
The map's place panel is rendered inside `MapView.tsx`. Adding a link there must not interfere with the existing click handler that selects/deselects markers. Safe pattern: render the link inside the panel container, away from the map canvas; clicking the link triggers Next.js navigation, not the map's click handler.

**SaveEventButton on venue-page event cards**
Server-side fetch needs user + savedIds for the events on this page. Two options: (a) batched query `WHERE event_id IN (...)`, (b) per-card check. Option (a) — single query — is simpler and faster. Same pattern as the Phase 4 detail page does for one event.

---

## Order of execution

1. You run V1–V4. Report results.
2. If any fail, you run the backfill SQL. Re-run V1–V4. Confirm all pass.
3. I add `slug` to `Place` type.
4. I update `app/page.tsx` (Trending Places card href + mapping) and the "Open in map" → "View venue" label.
5. I update `MapView.tsx` (slug in mapping + View details link in selected-place panel).
6. I write `app/places/[slug]/page.tsx` (route + metadata + page).
7. Run `npm run build` — confirm 0 TS errors and `/places/[slug]` listed as dynamic.
8. You run the 17-test browser checklist.
9. If everything passes, commit + push.

---

## Rollback plan

**App rollback:** revert the commit. Trending Places cards return to map-pointing. Map panel View-details link disappears. `/places/[slug]` 404s.

**DB rollback:** if a backfill was applied, the slug column stays — no rollback needed since nothing else broke. If you want to undo:
```sql
ALTER TABLE places DROP COLUMN slug;  -- destructive; only if no other code uses it
```

---

## After Phase 6

Natural next steps, all independent:

1. **Saved venues** — symmetric `saved_places` table + heart on venue cards. Small.
2. **Custom 404** for `/places/[slug]/not-found.tsx` and `/events/[slug]/not-found.tsx` together.
3. **OpenGraph images** — once venue/event covers exist.
4. **Map clustering** — independent of detail pages.
5. **Past events tab** on venue pages.
