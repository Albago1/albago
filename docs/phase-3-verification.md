# Phase 3 — Manual Verification Checklist

**Goal:** Confirm that cross-location full-text search, DB-driven location dropdowns, and search UX all work correctly before starting Phase 4.  
**Do this before writing any new code.**

---

## Part 1 — Supabase SQL checks (run first)

Open the Supabase SQL editor and run each block. Fix any failures before opening the browser.

### 1a — Confirm `events.search_vector` is populated

```sql
-- Should return 0 rows. Any rows = backfill failed for those events.
SELECT id, title FROM events WHERE search_vector IS NULL AND status = 'published';
```

**Pass:** 0 rows returned.  
**Fail:** One or more rows — rerun the Phase 3 backfill UPDATE:
```sql
UPDATE events
SET search_vector =
  setweight(to_tsvector('simple', coalesce(title, '')), 'A') ||
  setweight(to_tsvector('simple', coalesce(description, '')), 'B') ||
  setweight(to_tsvector('simple', coalesce(category, '')), 'C')
WHERE search_vector IS NULL;
```

---

### 1b — Confirm `places.search_vector` is populated

```sql
SELECT id, name FROM places WHERE search_vector IS NULL;
```

**Pass:** 0 rows returned.  
**Fail:** Rerun the places backfill:
```sql
UPDATE places
SET search_vector =
  setweight(to_tsvector('simple', coalesce(name, '')), 'A') ||
  setweight(to_tsvector('simple', coalesce(description, '')), 'B') ||
  setweight(to_tsvector('simple', coalesce(category, '')), 'C')
WHERE search_vector IS NULL;
```

---

### 1c — Confirm full-text search returns results

Pick any word that actually appears in an event title in your DB and run:

```sql
SELECT id, title, location_slug
FROM events
WHERE status = 'published'
  AND search_vector @@ plainto_tsquery('simple', 'YOUR_WORD_HERE');
```

**Pass:** One or more rows returned.  
**Fail:** 0 rows — either `search_vector` is not populated or no published events exist. Check 1a again.

---

### 1d — Confirm `cities` table is readable by anon role

```sql
-- Run this as anon (or check via the API with the anon key)
SELECT slug, name, country FROM cities ORDER BY name;
```

If you get a permission error or 0 rows when you know the table has data:

Go to **Supabase Dashboard → Authentication → Policies → cities table** and confirm a policy exists:
- **Policy name:** anything (e.g. `cities_public_read`)
- **Operation:** SELECT
- **Target roles:** `anon`, `authenticated`
- **Expression:** `true`

**Pass:** Rows returned, no permission error.  
**Fail:** Add the missing RLS policy and re-test.

---

## Part 2 — Browser tests

Start the dev server (`npm run dev`) and test each item in order. Use an incognito window to avoid cached state.

---

### Test 1 — Events page loads normally (browse mode)

**URL:** `http://localhost:3000/events?location=tirana`

**Expected:**
- Events for Tirana load within ~1 second
- No city badge on event cards
- Heading reads: `All events in Tirana`
- Location chip reads: `Tirana, Albania`
- Location select is visible (not hidden)

**Failure signals:**
- Blank page or spinner that never resolves → Supabase fetch broken, check browser console
- "All cities" showing when no search query is active → `isSearchMode` logic broken

---

### Test 2 — Cross-location search activates

**URL:** `http://localhost:3000/events?location=tirana`

Type a word from any event title (e.g. `festival`, `jazz`, `night`, or whatever exists in your DB) in the search field.

**Wait ~400ms (don't type anything else).**

**Expected:**
- Heading changes to: `Results for "YOUR_WORD"`
- Location chip changes to: `All cities`
- Note appears below the search bar: `Showing results across all cities`
- Event cards from multiple `location_slug` values appear (if data exists across cities)
- Each card shows a city badge with a `MapPin` icon and city label (e.g. `Tirana`)
- Location `<select>` dropdown is hidden

**Failure signals:**
- Heading doesn't change → `isSearchMode` not triggering, debounce broken
- 0 results but you confirmed events match in SQL check 1c → `.textSearch()` call broken, check console for Supabase error
- Results appear but no city badge → `debouncedSearch.trim()` check in JSX broken

---

### Test 3 — Clearing search returns to browse mode

While still on `/events`, clear the search field completely.

**Expected:**
- Heading reverts to: `All events in Tirana`
- Location chip reverts to: `Tirana, Albania`
- `Showing results across all cities` note disappears
- City badges disappear from event cards
- Location `<select>` reappears
- Events reload for Tirana only

**Failure signals:**
- Search mode UX persists after clearing → state not clearing properly

---

### Test 4 — URL sync works

After typing a search query (e.g. `music`), check the browser address bar.

**Expected URL:** `http://localhost:3000/events?location=tirana&q=music`

Navigate directly to that URL in a new tab.

**Expected:**
- Page loads already in search mode with `music` pre-filled in the search input
- Cross-location results already shown (not flicker-then-load)

**Failure signals:**
- URL doesn't contain `q=` → URL sync effect broken
- Direct URL load shows browse mode briefly before switching → initial state not reading from URL params

---

### Test 5 — Filters apply on top of search results

While in search mode (query active), click a category pill (e.g. `Nightlife`).

**Expected:**
- Results narrow to only nightlife events from the global cross-location results
- Search query and category both active simultaneously

Click a time filter (e.g. `Tonight`).

**Expected:**
- Results narrow further to tonight's events matching the search query + category

**Failure signals:**
- Category or time filter clears the search query → filter state interaction broken

---

### Test 6 — Location dropdown reads from `cities` table

**URL:** `http://localhost:3000/events?location=tirana`

Open the location `<select>` dropdown.

**Expected:**
- Dropdown shows the cities from your Supabase `cities` table (not just the 4 hardcoded ones if you've added more)
- If `cities` table has the same 4 as hardcoded, behavior is identical — this still passes as long as no console error appears

**Failure signals:**
- Console error about `cities` fetch → RLS policy missing (fix from SQL check 1d)
- Dropdown shows only 4 hardcoded locations AND you've added more in the DB → `fetchLocations()` silently failing

---

### Test 7 — Home page location dropdown

**URL:** `http://localhost:3000`

Open the location picker (click the location selector on the home page).

**Expected:**
- Dropdown shows cities from the `cities` table
- Selecting a city and clicking "Search" or "Explore" navigates to `/events?location=SLUG`

**Failure signals:**
- Only 4 locations shown when DB has more → `useLocations()` hook not wired into home page (it is, but verify)

---

### Test 8 — Submit-event location select

**URL:** `http://localhost:3000/submit-event` (must be logged in)

Open the location `<select>` on the form.

**Expected:**
- Shows cities from the `cities` table
- Selecting any city works without JS error

---

### Test 9 — Map FilterBar location list

**URL:** `http://localhost:3000/map`

Open the location filter in the FilterBar.

**Expected:**
- Shows cities from the `cities` table

---

## Part 3 — Known acceptable gaps (do not fix now)

These are documented risks that are intentionally deferred to Phase 4:

1. **Venue name search in cross-location mode** — searching "Hemingway" (a venue name) will not return events at that venue via DB full-text. This is by design: `search_vector` on `events` covers title/description/category, not venue name. The client-side `placeNames` filter handles it for browse mode only.

2. **No pagination** — browse mode has no row limit. Acceptable for current data size.

3. **`lib/supabase/client.ts` shim** — harmless, leave it.

---

## Test order

Run in this exact order — each step validates a prerequisite for the next:

```
1. SQL check 1a  → events.search_vector populated
2. SQL check 1b  → places.search_vector populated
3. SQL check 1c  → full-text query actually returns rows
4. SQL check 1d  → cities table readable by anon
5. Browser Test 1  → browse mode works (baseline)
6. Browser Test 2  → cross-location search activates
7. Browser Test 3  → clearing search returns to browse mode
8. Browser Test 4  → URL sync (q= param)
9. Browser Test 5  → filters work on top of search results
10. Browser Tests 6–9  → location dropdowns read from cities table
```

**If SQL checks 1a–1d all pass and Browser Tests 1–3 pass, Phase 3 core is working.**  
Tests 4–9 verify polish and secondary surfaces — fix any failures before starting Phase 4.
