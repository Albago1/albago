# Phase 1 — Venue Foundation

**Status:** Not yet implemented  
**Depends on:** Current working app (commit `4531628`)  
**Goal:** Make venues proper first-class entities with address and external navigation.

---

## What Phase 1 does

The `places` table already has the right shape defined in `types/backend.ts` (`BackendPlace`). The problem is the live Supabase DB is missing several of those columns, and the app never reads or displays them. Phase 1 closes that gap.

Three changes, each independently deployable:

1. **DB migration** — Add missing columns to `places` table. Create `cities` table.
2. **App update** — `lib/locations.ts` reads from `cities` table at runtime.
3. **UI update** — `PlacePanel.tsx` shows address, directions buttons, website link.

No renames. No destructive changes. No data is touched. Rollback on any step is safe.

---

## Step 1 — Supabase SQL migration

Run this in the Supabase SQL editor. Each block is idempotent (safe to run twice).

### 1a — Add missing columns to `places`

```sql
-- Add missing columns to places table
-- All use IF NOT EXISTS-equivalent pattern (ALTER TABLE ADD COLUMN is idempotent in Postgres 9.6+)

ALTER TABLE places
  ADD COLUMN IF NOT EXISTS address        text,
  ADD COLUMN IF NOT EXISTS google_place_id text,
  ADD COLUMN IF NOT EXISTS website_url    text,
  ADD COLUMN IF NOT EXISTS phone          text,
  ADD COLUMN IF NOT EXISTS status         text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS cover_image_url text,
  ADD COLUMN IF NOT EXISTS images         text[];

-- google_place_id should be unique but we can't enforce it if there are nulls
-- Add a partial unique index instead (nulls are excluded)
CREATE UNIQUE INDEX IF NOT EXISTS places_google_place_id_unique
  ON places (google_place_id)
  WHERE google_place_id IS NOT NULL;

-- Backfill status for existing rows that have no status yet
UPDATE places SET status = 'active' WHERE status IS NULL;
```

### 1b — Create `cities` table

```sql
CREATE TABLE IF NOT EXISTS cities (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug          text UNIQUE NOT NULL,
  name          text NOT NULL,
  country       text NOT NULL,
  country_code  text NOT NULL,
  lat           float8 NOT NULL,
  lng           float8 NOT NULL,
  timezone      text,
  zoom          float8 NOT NULL DEFAULT 12.5,
  is_featured   boolean NOT NULL DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- Seed the 4 current locations from lib/locations.ts
INSERT INTO cities (slug, name, country, country_code, lat, lng, zoom, is_featured)
VALUES
  ('tirana',         'Tirana',         'Albania', 'AL', 41.3275, 19.8187, 12.5, true),
  ('durres',         'Durrës',         'Albania', 'AL', 41.3231, 19.4565, 12.5, true),
  ('albanian-coast', 'Albanian Coast', 'Albania', 'AL', 40.25,   19.75,   7.5,  true),
  ('prishtina',      'Prishtina',      'Kosovo',  'XK', 42.6629, 21.1655, 12.5, true)
ON CONFLICT (slug) DO NOTHING;
```

### 1c — RLS policies for `cities`

```sql
-- Cities are public read, admin write
ALTER TABLE cities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cities_public_read"
  ON cities FOR SELECT
  USING (true);

-- Only admins can insert/update/delete cities
-- This uses the existing is_admin() helper
CREATE POLICY "cities_admin_write"
  ON cities FOR ALL
  USING (is_admin());
```

> **Note:** If `is_admin()` does not exist yet in your Supabase project, create it first:
> ```sql
> CREATE OR REPLACE FUNCTION is_admin()
> RETURNS boolean LANGUAGE sql SECURITY DEFINER
> SET search_path = public
> AS $$
>   SELECT EXISTS (
>     SELECT 1 FROM profiles
>     WHERE id = auth.uid() AND role = 'admin'
>   );
> $$;
> ```

---

## Step 2 — Files that need changes

### `lib/locations.ts`

**Current:** hardcoded array of 4 locations.  
**Change:** Add a server-side fetch function that queries the `cities` table. Keep the hardcoded array as a fallback so the app never breaks if the query fails.

The exported `locations` array stays identical for all existing client-side code. Only add one new exported async function `fetchLocations()` that returns from DB.

> Do not change the `LocationOption` type or the `getLocationBySlug` function — everything that imports those must keep working.

**New export to add:**
```ts
// Async version — use in server components or initial page loads
export async function fetchLocations(): Promise<LocationOption[]>
```

**Implementation:** Query `cities` table ordered by `is_featured DESC, name ASC`. Map each row to `LocationOption` shape. On error, return the hardcoded `locations` array as fallback.

---

### `components/place/PlacePanel.tsx`

**Current:** Shows category, options chips, event list, description. No address. No navigation.  
**Change:** Add three new display elements:

1. **Address line** — below the venue name, when `place.address` is not null:
   `<MapPin icon> {place.address}`

2. **"Get Directions" button** — opens in a new tab. Uses stored `lat`/`lng`:
   - On iOS (detected via `navigator.userAgent`): Apple Maps deep link
   - On all other platforms: Google Maps directions URL
   - If `lat`/`lng` is null: button is hidden

3. **"Open in Maps" button** — opens venue location in Google Maps (or Apple Maps on iOS). Separate from directions.

4. **Website link** — when `place.website_url` is not null. Opens in new tab. Plain text link or a small button.

**Icons to use:** `Navigation` (for directions), `Globe` (for website) — both already in Lucide. `MapPin` is already imported.

---

### `types/place.ts`

**Current:**
```ts
export type Place = {
  id: string
  name: string
  category: string
  lat: number
  lng: number
  description: string
  options: string[]
  imageUrl?: string
  city?: string
  address?: string
  verified?: boolean
}
```

**Change:** Add `websiteUrl`, `phone`, `status` to match the new DB columns:
```ts
websiteUrl?: string
phone?: string
status?: string
```

---

### `components/map/MapView.tsx`

**Current:** Maps `places` rows to `Place` type. Does not read `address`, `website_url`.  
**Change:** Add `website_url` → `websiteUrl` mapping in the `placesRes.data.map()` call, so the new fields flow through to `PlacePanel`.

---

### `app/page.tsx`

**Current:** Maps `places` rows to `Place` type. Same as above.  
**Change:** Same mapping addition as `MapView.tsx`.

---

## Step 3 — What to test

After running the SQL migration and deploying the app changes, verify:

| Test | Expected result |
|---|---|
| Home page loads | No errors, featured events and places appear |
| Map page loads | Venues appear as markers, no console errors |
| Click any venue marker | Place panel opens, address shown if populated in DB |
| Place panel: venue with address | Address line visible below venue name |
| Place panel: venue with lat/lng | "Get Directions" and "Open in Maps" buttons visible |
| Place panel: venue without lat/lng | Direction buttons hidden (not broken) |
| Click "Get Directions" | Opens Google Maps (or Apple Maps on iOS) to correct location |
| Click "Open in Maps" | Opens venue location in correct map app |
| Place panel: venue with website_url | Website link visible |
| Events page loads | Location selector still shows 4 locations |
| Submit event page | Still submits to Supabase without errors |
| Sign in as admin | Dashboard still shows stats |
| Admin review page | Submissions still list and approve/reject correctly |
| `getLocationBySlug('tirana')` | Returns correct location object |

---

## Step 4 — Rollback plan

Each step is independently reversible:

**Rollback Step 1a (added columns to `places`):**
```sql
ALTER TABLE places
  DROP COLUMN IF EXISTS address,
  DROP COLUMN IF EXISTS google_place_id,
  DROP COLUMN IF EXISTS website_url,
  DROP COLUMN IF EXISTS phone,
  DROP COLUMN IF EXISTS cover_image_url,
  DROP COLUMN IF EXISTS images;

-- Note: do NOT drop 'status' without first checking if app code references it
-- Safe if you haven't deployed the app changes yet
ALTER TABLE places DROP COLUMN IF EXISTS status;
```

**Rollback Step 1b (cities table):**
```sql
DROP TABLE IF EXISTS cities;
```

**Rollback app changes:**  
Revert the git commit. Because the app change only *adds* reading of new columns, the old app continues working on the new DB schema (it just ignores the new columns). No dual-version compatibility issues.

---

## Step 5 — Risks specific to this phase

**Adding `status` column with DEFAULT 'active'**  
All existing `places` rows will get `status = 'active'`. This is correct — existing venues should remain visible. The `UPDATE places SET status = 'active' WHERE status IS NULL` in the migration is a safety net, not strictly needed given the DEFAULT, but safe to run.

**`google_place_id` partial unique index**  
We use a partial index (`WHERE google_place_id IS NOT NULL`) rather than a column UNIQUE constraint so that NULL values don't conflict. This is correct Postgres behavior for optional unique identifiers. If you later add a second NULL google_place_id row, it is allowed — only non-null values are deduplicated.

**The `cities` table seeding**  
Uses `ON CONFLICT (slug) DO NOTHING` — safe to run multiple times. If you later update a city's coordinates or zoom, the `DO NOTHING` means the seed won't overwrite your changes. Update cities manually via the Supabase table editor after the initial seed.

**`lib/locations.ts` async fallback**  
If the Supabase query for cities fails (network issue, wrong credentials), the hardcoded fallback ensures the app still works. The tradeoff: if someone adds a 5th city to the DB, users on a stale/failed fetch see only 4. Acceptable for Phase 1.

**PlacePanel navigation buttons on venues with no coordinates**  
The current DB has `lat`/`lng` on all existing venues (required at insert time). But newly created venues from Phase 2 (organizer-submitted, pending geocoding) may have null coordinates. The buttons must be conditionally rendered — not just hidden via CSS — so no broken link appears.

---

## Order of execution

1. Run Step 1a SQL in Supabase SQL editor
2. Run Step 1b SQL (cities table + seed)
3. Run Step 1c SQL (RLS policies)
4. Deploy app changes (all files in Step 2)
5. Run manual tests from Step 3
6. If tests pass: commit and push

Do not deploy app changes before the SQL migration — the new fields would just be undefined in existing data, which is safe, but the navigation buttons would never render.
