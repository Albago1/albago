# Phase 3 — Global Discovery & Search

**Status:** Not yet implemented  
**Depends on:** Phase 1 + Phase 2 complete, stabilization pass complete  
**Goal:** Make the platform genuinely searchable — full-text search across events and venues, location dropdowns driven by the `cities` DB table, cross-location results when a query is present.

---

## What Phase 3 does

Three concrete improvements, each independently deployable:

1. **Full-text search infrastructure** — Add `search_vector tsvector` columns to `events` and `places`, maintained automatically by Postgres triggers. This is the foundation everything else builds on.

2. **`fetchLocations()` wired into the UI** — Location dropdowns on the home page, events page, submit-event form, and map now read from the `cities` table at runtime. The hardcoded `locations` array stays as a fallback — if the DB query fails, nothing breaks.

3. **Cross-location search on the events page** — When the user has typed a search query, results come from all cities, not just the active location. When the search is cleared, the page returns to location-specific browsing. This is the highest-impact user-facing change.

### What Phase 3 deliberately does NOT do

- No changes to the map page beyond wiring in `fetchLocations()` for the FilterBar location list
- No venue/place search results page (places are searched client-side on the map already)
- No removal of `location_slug` — it stays on all tables and all queries
- No ticketing, payments, or organizer features
- No change to the hardcoded `locations` fallback — it stays in `lib/locations.ts`

---

## Step 1 — Supabase SQL migration

Run all three blocks in order. Each is idempotent.

### 3a — Add `search_vector` to `events`

```sql
-- Add column
ALTER TABLE events ADD COLUMN IF NOT EXISTS search_vector tsvector;

-- Backfill existing rows
-- Uses 'simple' config (language-agnostic: no stemming, safe for Albanian + English content)
UPDATE events
SET search_vector =
  setweight(to_tsvector('simple', coalesce(title, '')), 'A') ||
  setweight(to_tsvector('simple', coalesce(description, '')), 'B') ||
  setweight(to_tsvector('simple', coalesce(category, '')), 'C')
WHERE search_vector IS NULL;

-- GIN index for fast lookups
CREATE INDEX IF NOT EXISTS events_search_vector_idx
  ON events USING GIN(search_vector);

-- Trigger function to keep search_vector current on every insert/update
CREATE OR REPLACE FUNCTION update_events_search_vector()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('simple', coalesce(NEW.title, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(NEW.description, '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(NEW.category, '')), 'C');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS events_search_vector_update ON events;
CREATE TRIGGER events_search_vector_update
  BEFORE INSERT OR UPDATE ON events
  FOR EACH ROW EXECUTE FUNCTION update_events_search_vector();
```

### 3b — Add `search_vector` to `places`

```sql
ALTER TABLE places ADD COLUMN IF NOT EXISTS search_vector tsvector;

UPDATE places
SET search_vector =
  setweight(to_tsvector('simple', coalesce(name, '')), 'A') ||
  setweight(to_tsvector('simple', coalesce(description, '')), 'B') ||
  setweight(to_tsvector('simple', coalesce(category, '')), 'C')
WHERE search_vector IS NULL;

CREATE INDEX IF NOT EXISTS places_search_vector_idx
  ON places USING GIN(search_vector);

CREATE OR REPLACE FUNCTION update_places_search_vector()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('simple', coalesce(NEW.name, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(NEW.description, '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(NEW.category, '')), 'C');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS places_search_vector_update ON places;
CREATE TRIGGER places_search_vector_update
  BEFORE INSERT OR UPDATE ON places
  FOR EACH ROW EXECUTE FUNCTION update_places_search_vector();
```

### 3c — Verify backfill succeeded

```sql
-- Should return 0 rows. If any rows appear, rerun the UPDATE statements above.
SELECT id, title FROM events WHERE search_vector IS NULL;
SELECT id, name  FROM places WHERE search_vector IS NULL;
```

---

## Step 2 — Files that need changes

### `lib/locations.ts`

**Current:** exports `fetchLocations()` which queries `cities` table but is never called anywhere.  
**Change:** Add a `useLocations()` React hook that client components can drop in as a replacement for the hardcoded `locations` import.

```ts
// New export — client components use this instead of the static `locations` array
export function useLocations(): LocationOption[] {
  const [list, setList] = useState<LocationOption[]>(locations) // hardcoded fallback is immediate

  useEffect(() => {
    fetchLocations().then((fetched) => {
      if (fetched.length > 0) setList(fetched)
    })
  }, [])

  return list
}
```

This hook:
- Returns the hardcoded `locations` array on the first render (instant, no flicker)
- Replaces it with DB results once the fetch completes
- Falls back silently if `fetchLocations()` fails (returns the same hardcoded array)
- Requires `'use client'` context — this is fine since all callers are already client components

> **Important:** The existing `locations` array, `LocationOption` type, `getLocationBySlug()`, and `fetchLocations()` are all untouched. `useLocations()` is additive only.

---

### `app/events/page.tsx`

This file has the most changes. Three separate concerns:

**2a — Replace static `locations` import with `useLocations()` hook**

```ts
// Before:
import { getLocationBySlug, locations } from '@/lib/locations'

// After:
import { getLocationBySlug, useLocations } from '@/lib/locations'
// ...
const locationOptions = useLocations()
// replace all uses of `locations` in JSX with `locationOptions`
```

The location select `<select>` maps over `locations` — replace with `locationOptions`.

**2b — Add debounced search state**

The current search is purely client-side: all events for the location are fetched once, then `filteredEvents` filters them in `useMemo`. Cross-location search requires a DB query on every changed search term, but not on every keystroke.

Add a debounced search state:
```ts
const [debouncedSearch, setDebouncedSearch] = useState(initialSearchQuery)

useEffect(() => {
  const timer = setTimeout(() => setDebouncedSearch(searchQuery), 350)
  return () => clearTimeout(timer)
}, [searchQuery])
```

`searchQuery` drives the input value (instant). `debouncedSearch` drives the DB fetch (350ms after the user stops typing).

**2c — Modify the fetch effect to support cross-location search**

Replace the single fetch effect with one that handles two modes:

```ts
useEffect(() => {
  const fetchEvents = async () => {
    setIsLoading(true)
    setErrorMessage(null)

    if (debouncedSearch.trim()) {
      // — Cross-location search mode —
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .eq('status', 'published')
        .textSearch('search_vector', debouncedSearch, { type: 'plain', config: 'simple' })
        .order('date', { ascending: true })
        .limit(60)

      setIsLoading(false)
      if (error) { setErrorMessage(error.message); return }

      const results = data ?? []
      setEvents(results)

      // Fetch venue names for only the places that appear in results
      const placeIds = [...new Set(results.flatMap(e => e.place_id ? [e.place_id] : []))]
      if (placeIds.length > 0) {
        const { data: placesData } = await supabase
          .from('places').select('id, name').in('id', placeIds)
        if (placesData) setPlaceNames(new Map(placesData.map(p => [p.id, p.name])))
      } else {
        setPlaceNames(new Map())
      }
    } else {
      // — Location-specific browse mode (current behavior, unchanged) —
      const [eventsRes, placesRes] = await Promise.all([
        supabase.from('events').select('*')
          .eq('status', 'published')
          .eq('location_slug', activeLocationSlug)
          .order('date', { ascending: true })
          .order('time', { ascending: true }),
        supabase.from('places').select('id, name')
          .eq('location_slug', activeLocationSlug),
      ])
      setIsLoading(false)
      if (eventsRes.error) { setErrorMessage(eventsRes.error.message); return }
      setEvents(eventsRes.data ?? [])
      if (placesRes.data) setPlaceNames(new Map(placesRes.data.map(p => [p.id, p.name])))
    }
  }
  fetchEvents()
}, [supabase, activeLocationSlug, debouncedSearch])
```

The effect depends on `debouncedSearch` instead of `searchQuery`. When the user types, the input updates instantly; 350ms later `debouncedSearch` updates and the fetch fires.

**2d — Show city label on event cards in cross-location mode**

When `debouncedSearch.trim()` is non-empty, event cards should show the city. The `location_slug` is already on each event. Use `getLocationBySlug(event.location_slug)` to get the label.

Add a conditional city badge inside each event card:
```tsx
{debouncedSearch.trim() && (
  <span className="inline-flex items-center gap-1.5 text-xs text-white/45">
    <MapPin className="h-3 w-3" />
    {getLocationBySlug(event.location_slug).label}
  </span>
)}
```

**2e — Show a "searching everywhere" context note**

When in cross-location mode, show a small indicator below the search bar:
```tsx
{debouncedSearch.trim() && (
  <p className="mt-2 text-xs text-white/40">
    Showing results across all cities
  </p>
)}
```

This makes the cross-location behavior explicit rather than surprising.

---

### `app/page.tsx` (home page)

**Change:** Replace `locations` with `useLocations()` in the location dropdown.

```ts
// Before:
import { getLocationBySlug, locations } from '@/lib/locations'

// After:
import { getLocationBySlug, useLocations } from '@/lib/locations'
// ...
const locationOptions = useLocations()
```

Replace every `locations.map(...)` in JSX with `locationOptions.map(...)`. The "Quick locations" row, the location dropdown, and the `matchingLocations` filter all use `locations` — update all of them to `locationOptions`.

The `resolvedLocation` and `handleDetectLocation` logic uses `locations` for nearest-city lookup. Keep those on `locationOptions` too.

---

### `app/submit-event/page.tsx`

**Change:** Replace `locations` with `useLocations()` in the location `<select>`.

```ts
import { getLocationBySlug, useLocations } from '@/lib/locations'
// ...
const locationOptions = useLocations()
```

Replace the `locations.map(...)` inside the `<select>` with `locationOptions.map(...)`. The `getLocationBySlug(locationSlug)` call in `handleSubmit` is unchanged.

---

### `components/map/MapView.tsx`

**Change:** Replace `locations` with `useLocations()` for the `locationOptions` prop passed to `FilterBar`.

```ts
import { getLocationBySlug, useLocations } from '@/lib/locations'
// ...
const locationOptions = useLocations()
// in JSX:
locationOptions={locationOptions}  // was: locationOptions={locations}
```

The `getLocationBySlug(locationSlug)` calls inside MapView for `location.center` and `location.zoom` are unchanged — they still use the imported `getLocationBySlug` which internally searches the hardcoded array (which is always available and always correct).

---

## Step 3 — Expected UX behavior

### Events page — browse mode (no search query)

Identical to today. Events load for the active location. Time and category filters work client-side. Location dropdown shows up to date city list from DB.

### Events page — search mode (query typed)

1. User types a query (e.g. "jazz")
2. Input updates instantly, dropdown shows as before
3. 350ms after typing stops: DB query fires against `events.search_vector`
4. Results replace the current event list — from ALL cities
5. Each card gains a city badge (e.g. "Tirana" or "Prishtina")
6. Below the search bar: "Showing results across all cities"
7. Time and category filters still apply to the global results client-side
8. User clears the search → location-specific events reload

### Home page

No change to search behavior. The home page builds a URL (`/events?location=...&q=...`) and navigates to the events page, which handles the search. The only change: the location dropdown now reads from the `cities` table.

### Submit-event

Location dropdown reads from `cities` table. If a 5th city is added in Supabase, it appears in the form without a code deploy.

### Map

Location list in FilterBar reads from `cities` table. No other map behavior changes.

---

## Step 4 — Test checklist

| Test | Expected result |
|---|---|
| Events page loads, no search | Events for active location shown, identical to before Phase 3 |
| Events page: type "jazz" in search | After 350ms, results from all cities appear |
| Search results: city badge | Each card shows city name (Tirana / Prishtina / etc.) |
| Search results: "searching everywhere" note | Visible below search input |
| Clear search query | Location-specific events reload, city badges disappear |
| Category filter during search | Applied on top of cross-location results |
| Time filter during search | Applied on top of cross-location results |
| Search for a venue name (e.g. "Hemingway") | Events at that venue appear (via venue name in client-side filter, not DB full-text) |
| Location dropdown shows DB cities | After ~100ms the dropdown updates from `cities` table |
| Add a new city to `cities` table in Supabase | Appears in every dropdown without code deploy |
| Home page location dropdown | Reads from DB, same locations shown |
| Submit-event location select | Reads from DB, same locations shown |
| Map FilterBar location list | Reads from DB, same locations shown |
| `getLocationBySlug('tirana')` | Still returns correct location (uses hardcoded array, unchanged) |
| DB fetch fails (simulate by revoking cities RLS) | All dropdowns fall back to hardcoded 4 locations, no errors |
| Search with no results | Empty state shown: "No events match this search" |
| Search a word that exists only in description | Event appears (description is weight B in search_vector) |
| Search a category (e.g. "nightlife") | Events with that category appear |
| Admin approves a new event | Event gets `search_vector` set automatically via trigger |
| Edit an existing event in Supabase | `search_vector` updates automatically via trigger |

---

## Step 5 — Rollback plan

**Rollback SQL:**
```sql
DROP TRIGGER IF EXISTS events_search_vector_update ON events;
DROP FUNCTION IF EXISTS update_events_search_vector();
DROP INDEX IF EXISTS events_search_vector_idx;
ALTER TABLE events DROP COLUMN IF EXISTS search_vector;

DROP TRIGGER IF EXISTS places_search_vector_update ON places;
DROP FUNCTION IF EXISTS update_places_search_vector();
DROP INDEX IF EXISTS places_search_vector_idx;
ALTER TABLE places DROP COLUMN IF EXISTS search_vector;
```

**Rollback app changes:**
Revert the git commit. The events page falls back to client-side search on location-filtered events. The location dropdowns fall back to the hardcoded `locations` array (which `useLocations()` uses as its initial state anyway). No data loss.

---

## Step 6 — Risks and edge cases

**`'simple'` vs `'english'` text search config**  
`'english'` applies stemming: "dancing" matches "dance". `'simple'` does not — "dancing" only matches "dancing". Since event titles are often proper nouns and the content is a mix of Albanian and English, `'simple'` is safer for Phase 3. The downside is reduced recall. Upgrade to a multilingual config in a later phase if needed.

**`plainto_tsquery` vs `to_tsquery`**  
Supabase's `.textSearch()` with `type: 'plain'` uses `plainto_tsquery` under the hood, which converts free text to a safe AND query: "jazz club" → `'jazz' & 'club'`. This is safe for user input. Never use `to_tsquery` directly on user input — it throws on characters like `&`, `|`, `:`, `!`.

**`search_vector` null on existing rows**  
The `UPDATE ... WHERE search_vector IS NULL` backfill runs at migration time. Any row not covered (e.g. if the UPDATE is interrupted) will have `NULL` search_vector and will not appear in search results. Step 3c verifies this. Run it after the migration.

**Cross-location results with 60-row limit**  
The cross-location query uses `.limit(60)`. This is intentional — returning unlimited rows from a global query is expensive at scale, and 60 results is more than a user will scroll through. If the most relevant results are past position 60, ranking (not just recency) is needed. This is a Phase 4+ concern.

**Debounce 350ms on slow connections**  
On slow mobile connections, the DB query itself may take 500–800ms. The perceived delay is debounce + network latency. The loading state indicator handles this gracefully, but it's a known trade-off versus instant client-side filtering.

**Location dropdown flicker**  
`useLocations()` returns the hardcoded array immediately, then replaces it after the DB fetch. If the DB returns the same 4 cities, there is no visible change. If it returns more cities, the list grows after ~100ms. This is acceptable — no flash or layout shift because the initial list is valid.

**`useLocations()` hook requires `'use client'`**  
The hook uses `useState` and `useEffect`. It cannot be called in a server component. All four callers (home, events, submit-event, MapView) are already client components so this is not a constraint. Do not call `useLocations()` from a server component.

**Search does not include venue names in DB full-text**  
The `events.search_vector` covers title, description, and category — not the venue name. Searching for "Hemingway" (a venue) will not find events at Hemingway via DB full-text search. However, the client-side filter in `filteredEvents` does check `placeNames` (added in the stabilization pass), so venue name search works for already-loaded results. For Phase 3 this is acceptable. Phase 4 can denormalize the venue name into `search_vector` via a join-based trigger.

**`handleDetectLocation` in home page uses `locations` array for nearest-city calculation**  
This function must be updated to use `locationOptions` (from `useLocations()`) instead of the imported `locations` constant, so that GPS nearest-city detection includes any cities added to the DB.

---

## Order of execution

1. Run Step 3a SQL (events search_vector + trigger)
2. Run Step 3b SQL (places search_vector + trigger)
3. Run Step 3c SQL verification — confirm zero NULL rows
4. Deploy app changes (all 5 files in Step 2)
5. Run manual tests from Step 4
6. If tests pass: commit and push

> Deploy the SQL before the app. The app changes will still work without `search_vector` (the cross-location query will just return no results until the column exists), but it's cleaner to have the DB ready first.
