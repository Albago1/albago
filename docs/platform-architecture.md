# AlbaGo — Platform Architecture

**Version:** 1.0  
**Date:** 2026-05-07  
**Status:** Design reference — not yet implemented

---

## Preface: current state vs. intended state

`app/docs/backend-plan.md` and `types/backend.ts` already contain the right intuitions: `BackendPlace` has `city`, `address`, `verified`; `BackendEventSubmission` has `submitted_by_user_id`, `place_id`, `admin_note`; `UserRole` already defines `organizer`. The intended schema was planned. The gap is that the live Supabase database and application code never fully implemented it — the `location_slug` crutch, missing `city`/`address` data on venues, the anonymous submission form with a text `venue_name` field instead of a venue FK, and the hardcoded `lib/locations.ts` all exist because the foundation was never laid correctly. This document designs that foundation.

Environment variables required (never hardcode in source files):
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

---

## 1. User types

**Anonymous visitor**  
Can browse everything: home page, events page, map, individual venue panels. Cannot save events, submit events, or access any write operations. This is the largest user group and every page must be fully usable without an account. Conversion to signed-up should be gentle, not forced.

**Logged-in regular user**  
Everything anonymous users can do, plus: save events to a personal list, submit event suggestions (goes to moderation queue), view their own submission history and status. No dashboard — just a simple `/profile` page with saved events and submitted events.

**Event organizer**  
Elevated role above regular user. Organizers run events at real venues regularly. They get: a dedicated `/organizer` dashboard showing all their submitted events, the ability to edit their own pending events, the ability to cancel or postpone events they own, faster moderation (trusted submissions), and an organizer profile page that lists their events publicly. Organizer status is granted by an admin, either on request or automatically after N approved submissions.

**Venue owner / manager**  
A future role. A venue owner can claim an existing venue in the DB (via a verification flow), after which they can: edit the venue's description and photos, add recurring events, and see attendance stats. One venue can have multiple managers. Venue owners cannot approve their own events — moderation still applies.

**Admin / moderator**  
Full access. Can approve/reject event submissions, edit any event or venue, mark venues as verified, grant organizer status, merge duplicate venues, view audit logs, manage users. The current `/admin` and `/dashboard` pages serve this role and will need to expand.

**Future ticket buyer**  
A regular logged-in user who has made a purchase. Has an `/orders` page showing purchase history and QR codes for check-in. No separate user type needed.

---

## 2. Event discovery UX

The core discovery question: *"What can I do tonight in [place], and how do I get there?"* Every flow should answer this in as few taps as possible.

**By city / location**  
The search bar behaves like Airbnb's destination picker. User types a city name → dropdown shows matching cities from the `cities` table plus live geocoding suggestions. Selecting a city sets the active location and refetches events. The URL updates (`/events?city=berlin`). The active city is always visible in the page header.

**By current GPS location**  
Tap GPS button → browser asks permission → if granted, reverse-geocode coordinates to find the nearest city or the city the user is actually in → set as active location. If denied, fall back gracefully without false defaults. On mobile this is a first-class feature.

**By date**  
"Tonight", "This Weekend", "Next Week", and a custom date range picker. Time filters should be prominent pills, not buried in a filter sheet. "Tonight" is always first — it's the most common query.

**By category**  
Category pills: All / Nightlife / Music / Sports / Culture / Food. Mutually exclusive, toggleable. Scroll horizontally on mobile.

**By distance**  
Only relevant once GPS access is granted. "Events near me" becomes a sort mode: events ordered by distance from user's coordinates, with distance displayed on each card ("0.8 km away"). Requires lat/lng on events (denormalized from venues).

**By venue**  
Clicking a venue on the map opens the place panel showing all upcoming events. The `/map?place=X` URL pattern already works well. Future: venues get their own pages at `/venues/[slug]`.

**By search query**  
Free text search across event titles, descriptions, venue names, categories, and city names. Uses Postgres full-text search (`tsvector`) maintained by trigger. Executed server-side, not client-side filter.

**By map area**  
"Search this area" button appears when the user pans the map. Clicking it queries events within the current viewport bounding box via `map.getBounds()`.

**When no events exist in a searched location**  
Never show empty state that feels like failure. Show venue markers for that city even if no events exist, show a CTA to submit an event ("Know of something happening here? Submit it"), suggest upcoming events in nearby cities. Message: "Nothing scheduled yet — be the first to add one."

---

## 3. Location and venue architecture

**The core problem**  
The current app conflates three concepts:
1. A geographic region used for filtering (the `location_slug` system)
2. A venue/place shown on the map (the `places` table)
3. A city used for display context

These must be separated.

**Geographic hierarchy**  
Cities and regions should be stored as data, not as a hardcoded TypeScript file. The `lib/locations.ts` file with 4 entries should be replaced by a `cities` table in Supabase. Each city has: `id`, `slug`, `name`, `country`, `country_code`, `lat`, `lng`, `timezone`, `is_featured` (controls which cities appear in the quick-pick UI).

**Venues table** (rename from `places`)  
The `places` table should become `venues`. All the right columns already exist in the `BackendPlace` type — they just aren't fully populated in the live DB. Full ideal column set:

```
id              uuid PK
name            text NOT NULL
slug            text UNIQUE NOT NULL
category        text NOT NULL
description     text
address         text
city            text
country         text
country_code    text
lat             float8
lng             float8
google_place_id text UNIQUE         -- deduplication key
cover_image_url text
images          text[]
website_url     text
phone           text
options         text[]
status          text DEFAULT 'active'   -- 'pending', 'active', 'inactive'
verified        boolean DEFAULT false
claimed_by      uuid FK profiles(id)
created_by      uuid FK profiles(id)
location_slug   text                    -- kept for migration compatibility
created_at      timestamptz
updated_at      timestamptz
```

**Why `google_place_id` is critical**  
It is a globally unique, stable identifier for any real-world venue. Even without calling the Google Places API, storing this field when available prevents duplicate venue records. Two submissions for "Radio Bar, Tirana" are the same venue if they share a Google Place ID. Without it, you need fuzzy name matching to detect duplicates.

**How events attach to venues**  
`events.venue_id` (renamed from `place_id`) is a nullable FK to `venues`. Nullable because: (a) some events are outdoor/pop-up with no fixed venue, (b) a submission may reference a venue not yet created. When `venue_id` is null, the event must have `venue_name` (text), `city`, and `country` columns for display. The admin's job during moderation is to link submissions to real venue records.

**Map marker generation**  
Markers come from the `venues` table, not from events. A venue appears on the map regardless of whether it has upcoming events — it shows an "empty" state when selected. When events exist, the marker gets a count badge. This matches how Google Maps works: the place exists independently of what's happening there.

**Duplicate venue prevention**  
Three layers:
1. `google_place_id` UNIQUE constraint — hard deduplication if Google ID is available
2. Admin review of new venue submissions before going live
3. In the submission form: fuzzy search against existing venues before allowing "create new", so organizers see and can select an existing match

**What happens if the venue doesn't exist yet**  
1. Organizer types venue name → search queries `venues` table
2. Results show matched venues with address/category to help distinguish
3. If no match → "Can't find your venue? Add it"
4. Inline venue creation collects: name, address (geocoded to lat/lng), category
5. New venue created with `status: 'pending'` — visible to admin, not yet on public map
6. Event submission references the pending venue ID
7. When admin approves the event, they also review and activate the venue

---

## 4. Event submission flow

**Current problem**  
The submission form captures `venue_name` as free text. This means: the event has no real venue link, the admin has to manually match venue names to DB records, and every approval requires extra work.

**Ideal organizer submission flow**

Step 1 — Venue selection  
Search bar queries `venues` table. Shows name + address + category of each result. "Not listed → Add new venue" if no match.

Step 2 — Event details (all on one page)  
- Title (required)
- Category (required, predefined list)
- Date (required)
- Start time (required)
- End time (optional)
- Description (required, min 50 chars to enforce quality)
- Cover image upload (optional, Supabase Storage)

Step 3 — Ticket information  
- Free event toggle (default on)
- If not free: price range or single price, external ticket URL
- Optional: "Tickets available on the platform" (future)

Step 4 — Submitter information  
- Contact email (pre-filled if logged in)
- Organizer name / organization (optional)
- Note to reviewer (optional)

Step 5 — Review and submit  
Summary before final submit. Clear statement: "Your event will be reviewed before appearing on the map."

**Required vs optional fields**  
Required: title, venue (can be pending), date, start time, category, description, contact email  
Optional: end time, price, ticket URL, cover image, organizer name, note to reviewer

**After submission**  
Success screen with submission ID. If logged in, status viewable at `/profile`. Email notification on admin decision (via Supabase trigger).

**Edit after submission**  
Allowed while `status = 'pending'`. If already `approved`, editing creates a new draft submission that goes back through moderation — original event remains live.

**Cancellation / postponement**  
Organizers can mark their own events as `cancelled` or `postponed` from their organizer dashboard. Requires `organizer_id = auth.uid()` ownership check.

---

## 5. Map integration

**Marker strategy**  
Two types:
1. Venue markers — always present, show venue name
2. Event count badge — overlaid when upcoming filtered events exist (`1`, `2+`, `Hot`)

Selected state: marker scales up, changes to white background. Place panel opens alongside.

**Clustering**  
MapLibre GL natively supports clustering via GeoJSON source with `cluster: true`. When zoom is below a threshold, nearby markers cluster into a count bubble. Add when the map has 30+ venues.

**"Search this area" button**  
Appears after the user pans the map. Clicking takes `map.getBounds()` → `{north, south, east, west}` → queries `venues` and `events` within those bounds:
```sql
WHERE lat BETWEEN :south AND :north
AND lng BETWEEN :west AND :east
```

**Opening external navigation**  
Generated from stored `lat`/`lng` at render time. Never store pre-built URLs in the DB.

```
Google Maps view:       https://maps.google.com/?q={lat},{lng}
Google Maps directions: https://www.google.com/maps/dir/?api=1&destination={lat},{lng}
Apple Maps view:        https://maps.apple.com/?ll={lat},{lng}&q={venue_name}
Apple Maps directions:  https://maps.apple.com/?daddr={lat},{lng}
```

On iOS, Apple Maps URLs open the Maps app natively. On Android/desktop, Google Maps URLs open the app or browser.

**Handling missing coordinates**  
Events where `lat`/`lng` is null: show in the events list but not on the map. The place panel can show the address text even without a pin.

**Filter persistence**  
Map filter state (time, category, location) always lives in the URL via `useSearchParams`. Extend to support viewport coordinates for "search this area".

---

## 6. Google Maps / Apple Maps interoperability

**Store coordinates, not external URLs**  
Never store Google Maps or Apple Maps URLs in the DB. Store `lat`, `lng`, and optionally `google_place_id`. Generate navigation URLs at render time. Reasons:
- Google has changed URL formats multiple times historically
- Coordinates are portable — usable for distance calculations, clustering, any future map provider
- Apple Maps URLs only work on Apple devices

**Google Places API decision**  
Do not use the Google Places API yet. It is powerful but expensive at scale:
- Autocomplete: ~$0.0028/request
- Place Details: ~$0.017/request
- Nearby Search: ~$0.032/request

For MVP:
- Use Nominatim (free, OpenStreetMap) for geocoding addresses to lat/lng
- Store `google_place_id` when it becomes available for deduplication
- Let organizers paste an address and geocode it with Nominatim

When the platform grows past ~10,000 MAU, introduce Google Places autocomplete in the venue search field only. Cache results in the `venues` table so each venue is fetched only once.

**Platform detection for navigation buttons**  
iOS: show both Apple Maps and Google Maps buttons (Apple Maps is native).  
Android / Desktop: show Google Maps button only (Apple Maps is browser-only on these platforms).

---

## 7. Database design

### `profiles` (extend existing)

```sql
id              uuid PK REFERENCES auth.users(id)
email           text
display_name    text
avatar_url      text
role            text DEFAULT 'user'          -- 'user', 'organizer', 'admin', 'moderator'
organizer_name  text
organizer_bio   text
organizer_verified boolean DEFAULT false
created_at      timestamptz
updated_at      timestamptz
```

Purpose: user identity and role management.  
RLS: users read/update their own row (non-role fields only). Only admins update `role`.  
Indexes: `id` (PK), `role`.

---

### `venues` (rename from `places`, add missing columns)

```sql
id              uuid PK DEFAULT gen_random_uuid()
name            text NOT NULL
slug            text UNIQUE NOT NULL
category        text NOT NULL
description     text
address         text
city            text
country         text
country_code    text
lat             float8
lng             float8
google_place_id text UNIQUE
cover_image_url text
images          text[]
website_url     text
phone           text
options         text[]
status          text NOT NULL DEFAULT 'active'   -- 'pending', 'active', 'inactive'
verified        boolean DEFAULT false
claimed_by      uuid REFERENCES profiles(id)
created_by      uuid REFERENCES profiles(id)
location_slug   text                             -- migration compatibility, deprecate in Phase 6
created_at      timestamptz DEFAULT now()
updated_at      timestamptz DEFAULT now()
```

Purpose: real-world venues that appear on the map.  
RLS: anyone reads `status = 'active'`. Admins insert/update any. Claimed owners update non-critical fields on their own venue.  
Indexes: `slug`, `google_place_id`, `location_slug`, `status`, `(lat, lng)`, `(city, country)`.

---

### `events` (extend existing)

```sql
id              uuid PK DEFAULT gen_random_uuid()
title           text NOT NULL
slug            text UNIQUE NOT NULL
venue_id        uuid REFERENCES venues(id) ON DELETE SET NULL   -- renamed from place_id
venue_name      text                    -- display fallback when venue_id is null
city            text                    -- denormalized for search
country         text
country_code    text
lat             float8                  -- denormalized from venue for bbox queries
lng             float8
category        text NOT NULL
description     text
cover_image_url text
date            date NOT NULL
time            time NOT NULL
end_time        time
is_free         boolean DEFAULT true
price_display   text                    -- e.g. "500 ALL" or "€10–€20"
ticket_url      text
highlight       boolean DEFAULT false
status          text NOT NULL DEFAULT 'pending'  -- 'pending','published','rejected','cancelled','postponed'
organizer_id    uuid REFERENCES profiles(id)
search_vector   tsvector               -- maintained by trigger
location_slug   text                   -- migration compatibility, deprecate in Phase 6
created_at      timestamptz DEFAULT now()
updated_at      timestamptz DEFAULT now()
```

Full-text search trigger:
```sql
CREATE OR REPLACE FUNCTION events_search_vector_update()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.search_vector := to_tsvector('english',
    coalesce(NEW.title, '')       || ' ' ||
    coalesce(NEW.description, '') || ' ' ||
    coalesce(NEW.city, '')        || ' ' ||
    coalesce(NEW.venue_name, '')
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER events_search_vector_trigger
BEFORE INSERT OR UPDATE ON events
FOR EACH ROW EXECUTE FUNCTION events_search_vector_update();

CREATE INDEX events_search_vector_idx ON events USING gin(search_vector);
```

RLS: anyone reads `status = 'published'`. Organizers read/update their own. Admins full access.  
Indexes: `status`, `date`, `venue_id`, `organizer_id`, `location_slug`, `(lat, lng)`, `(city, country)`, GIN on `search_vector`.

---

### `event_submissions` (restructure)

```sql
id              uuid PK DEFAULT gen_random_uuid()
submitter_id    uuid REFERENCES profiles(id)    -- null = anonymous
contact_email   text NOT NULL
title           text NOT NULL
venue_id        uuid REFERENCES venues(id)       -- set when venue found in DB
venue_name      text                             -- set when venue_id is null
city            text
country         text
category        text NOT NULL
description     text
date            date NOT NULL
time            time NOT NULL
end_time        time
is_free         boolean DEFAULT true
price_display   text
ticket_url      text
cover_image_url text
note_to_reviewer text
status          text NOT NULL DEFAULT 'pending'  -- 'pending','approved','rejected','more_info_needed'
admin_notes     text
reviewed_by     uuid REFERENCES profiles(id)
reviewed_at     timestamptz
event_id        uuid REFERENCES events(id)       -- set after approval
created_at      timestamptz DEFAULT now()
updated_at      timestamptz DEFAULT now()
```

RLS: submitters read their own rows. Admins full access.

---

### `cities` (new — replaces `lib/locations.ts`)

```sql
id              uuid PK DEFAULT gen_random_uuid()
slug            text UNIQUE NOT NULL
name            text NOT NULL
country         text NOT NULL
country_code    text NOT NULL
lat             float8 NOT NULL
lng             float8 NOT NULL
timezone        text
zoom            float8 DEFAULT 12.5
is_featured     boolean DEFAULT false    -- appears in quick-pick UI
created_at      timestamptz DEFAULT now()
```

Purpose: curated list of cities for quick-pick UI and map camera defaults. Not a gate on what cities events can exist in.  
Seed: the 4 current locations from `lib/locations.ts`.

---

### `saved_events` (new)

```sql
id              uuid PK DEFAULT gen_random_uuid()
user_id         uuid REFERENCES profiles(id) ON DELETE CASCADE
event_id        uuid REFERENCES events(id) ON DELETE CASCADE
saved_at        timestamptz DEFAULT now()
UNIQUE(user_id, event_id)
```

RLS: users read/write their own rows only.

---

### `venue_claims` (new — future Phase 4)

```sql
id              uuid PK DEFAULT gen_random_uuid()
venue_id        uuid REFERENCES venues(id)
claimant_id     uuid REFERENCES profiles(id)
status          text DEFAULT 'pending'    -- 'pending', 'approved', 'rejected'
verification_note text
reviewed_by     uuid REFERENCES profiles(id)
created_at      timestamptz DEFAULT now()
reviewed_at     timestamptz
```

---

### Future tables (design now, implement Phase 5–6)

**`tickets`** — ticket tiers per event (name, price, quantity, sale window)  
**`orders`** — purchase records linking user + event + ticket tier(s), Stripe payment intent ID  
**`order_items`** — individual tickets within an order, each with a unique QR code  
**`audit_log`** — append-only log of every status change on events and venues (who, what, old status, new status, timestamp)

---

## 8. Ticketing future

**Phase 0 (now):** Store `is_free`, `price_display`, and `ticket_url` on events. Show "Buy Tickets" button that opens external URL. Zero platform infrastructure required.

**Phase 1 (internal):** Add `tickets` table with tiers. Organizers configure tiers when creating events. "Get Tickets" modal on the platform. No payment yet — collect attendee info and send confirmation email.

**Phase 2 (Stripe):**
- Organizer connects a Stripe account via Stripe Connect
- User buys a ticket → Stripe PaymentIntent with destination charge to organizer
- Platform takes a percentage fee via `application_fee_amount`
- On success: create `order` + `order_items` records, generate unique QR code per item
- Send QR code to buyer via email

**Phase 3 (check-in):**
- Organizer opens check-in URL on mobile
- Scan QR code → verify against `order_items`
- Mark `checked_in_at`, prevent duplicate scans

**Key decisions:**  
QR codes must be random tokens (UUID or signed JWT), not sequential IDs — prevents guessing. Refunds are processed via Stripe API, reflected as `status: 'refunded'` on the order. Platform never handles raw card numbers — PCI compliance delegated entirely to Stripe.

---

## 9. Moderation and trust

**Current system gaps:**  
No way to ask for more info without rejecting. No submitter notification. No audit trail. Fully anonymous submissions possible.

**Submission statuses:**  
`pending` → `under_review` → `approved` | `rejected` | `more_info_needed`

`more_info_needed`: admin adds a note, submitter is notified by email. Submission re-enters queue when updated.

**Submission confidence scoring:**  
Each submission gets a trust score that guides auto-approval:
- Verified organizer account: +40
- Submission links to a verified venue: +20
- Has cover image: +10
- Anonymous submission: −20
- Account < 7 days old: −10

Score ≥ 70 → auto-approve. Everything else → moderation queue. Admins tune the threshold.

**Duplicate venue detection:**  
1. `google_place_id` UNIQUE constraint (hard)
2. Fuzzy match: `WHERE similarity(name, :input) > 0.6 AND city = :city` via `pg_trgm`
3. Show potential duplicates to admin with "Merge" option

**Duplicate event detection:**  
Same venue + same date + similar title → flag as potential duplicate. Admin must dismiss the flag consciously.

**Reporting:**  
Logged-in users can report events or venues (wrong info, spam, cancelled). Three reports on the same item surfaces it for review.

**Audit log:**  
Every status change on events and venues appends a row to `audit_log`: who, what table, what ID, old status, new status, note, timestamp. Read-only for admins.

**Organizer verification:**  
User submits a request with organization name, social/website link, and description. Admin approves → `profiles.role = 'organizer'`, `organizer_verified = true`. Verified organizer events get a badge.

---

## 10. Search architecture

**Layer 1 — City search (geocoding)**  
User types a city name → query `cities` table first. If not found, call Nominatim:
```
https://nominatim.openstreetmap.org/search?q={query}&format=json&limit=5&addressdetails=1
```
Free, no API key, rate limit 1 req/sec — acceptable with debouncing. Cache successful lookups in a `geocode_cache` table to avoid repeated calls for the same city.

**Layer 2 — Bounding box query**  
Once lat/lng is known (from city selection, GPS, or map viewport), query events:
```sql
SELECT * FROM events
WHERE status = 'published'
  AND lat BETWEEN :south AND :north
  AND lng BETWEEN :west AND :east
ORDER BY date ASC, time ASC
```
Works without PostGIS. Index on `(lat, lng)` makes it fast.

**Layer 3 — Full-text search**  
```sql
SELECT * FROM events
WHERE status = 'published'
  AND search_vector @@ plainto_tsquery('english', :query)
ORDER BY ts_rank(search_vector, plainto_tsquery('english', :query)) DESC
```

**Layer 4 — PostGIS (future)**  
When dataset grows large enough that bbox queries slow down, add the PostGIS extension and a `GEOGRAPHY` column. Enables `ST_DWithin` for true radius search and more efficient spatial indexing. Application API stays unchanged — only the SQL changes.

**Combined query pattern:**
```sql
SELECT e.*, v.name AS venue_name
FROM events e
LEFT JOIN venues v ON e.venue_id = v.id
WHERE e.status = 'published'
  AND (:query   IS NULL OR e.search_vector @@ plainto_tsquery('english', :query))
  AND (:slug    IS NULL OR e.location_slug = :slug)
  AND (:cat     IS NULL OR :cat = 'all' OR e.category = :cat)
  AND (:time    IS NULL OR
        (:time = 'tonight' AND e.date = CURRENT_DATE) OR
        (:time = 'weekend' AND e.date BETWEEN :fri AND :sun))
ORDER BY e.highlight DESC, e.date ASC, e.time ASC
```

---

## 11. Migration strategy

Principle: never break working features. Each phase is independently deployable and testable.

### Phase 0 — Baseline (current)
Working app: Supabase, auth, map, events page, admin. `location_slug` crutch. 4 hardcoded locations. No address/navigation on venues.

### Phase 1 — Venue foundation
**Goal:** Make venues proper first-class entities with address and navigation links.

DB changes:
- Add missing columns to `places` table: `address`, `google_place_id`, `website_url`, `status`, `verified` (aligns with what `BackendPlace` already defines)
- Create `cities` table, seed with 4 current locations

App changes:
- `lib/locations.ts` → fetches from `cities` table at runtime (hardcoded array stays as fallback)
- `PlacePanel.tsx` → shows address, "Get Directions" button, website link
- `types/backend.ts` → verify all fields match the updated table

**Testable when:** 4 locations still work, place panel shows address and directions button.

### Phase 2 — Event submission improvement
**Goal:** Submissions reference real venue records, not free text.

DB changes:
- Add `venue_id` (nullable FK) to `event_submissions`
- Add `note_to_reviewer`, `is_free`, `ticket_url` to `event_submissions`

App changes:
- `/submit-event` gets venue search step
- Admin page shows linked venue and allows linking submissions to existing venues

### Phase 3 — Global location search
**Goal:** Any city in the world, not just 4 preset ones.

DB changes:
- Add `search_vector` column + trigger to `events`
- Add `(lat, lng)` index to `events`
- Add `geocode_cache` table

App changes:
- Home page location picker becomes real autocomplete (Nominatim)
- Events page location selector becomes search input
- "Search this area" button on the map
- Bounding box query when a geocoded city is used

### Phase 4 — Organizer dashboard
**Goal:** Organizers manage their own events.

DB changes: `events.organizer_id` column, `organizer` role usage in profiles

App changes: `/organizer` dashboard, edit/cancel/postpone own events, admin grants organizer status

### Phase 5 — Ticketing foundation (external links)
**Goal:** Events carry ticket information; external purchase links.

DB changes: `is_free`, `price_display`, `ticket_url` on events and submissions

App changes: ticket section in submission form, "Free" / "Buy Tickets" labels on cards, ticket info in place panel

### Phase 6 — Rename places → venues (breaking migration)
Execute when schema is stable and Phase 5 is complete.
1. `ALTER TABLE places RENAME TO venues;`
2. Rename FK columns: `events.place_id` → `events.venue_id`
3. Update all application code
4. Drop `location_slug` once city/country is fully populated
5. Requires maintenance window and tested rollback SQL

---

## 12. Product roadmap

| Phase | Focus | Duration |
|---|---|---|
| 1 | Venue & location foundation | Weeks 1–3 |
| 2 | Submission improvement & moderation | Weeks 4–6 |
| 3 | Global discovery & search | Weeks 7–10 |
| 4 | Organizer dashboard | Weeks 11–14 |
| 5 | Ticketing foundation (external links) | Weeks 15–18 |
| 6 | Payments, QR codes, check-in | Months 5–8 |

---

## 13. Risks

**Google API cost**  
Google Places Autocomplete can cost ~$0.0028/request. 10,000 venue searches/day at 5 keystrokes each = $140/day. Use Nominatim as primary geocoder. Reserve Google Places for deduplication only (one call per new venue created, not per keystroke).

**Bad location data**  
Wrong coordinates → wrong map pin → wrong navigation directions. Every venue created by a non-admin must go to `status: 'pending'` and be reviewed before public display. Never trust user-submitted coordinates without review.

**Map performance at scale**  
MapLibre handles 100–200 markers. Above that, mobile frame rate degrades. Enable clustering (built into MapLibre GeoJSON source) and server-side viewport filtering (only fetch venues within map bounds, not entire DB).

**Auth and RLS complexity**  
Multiple roles with different permissions across many tables. A mistake in RLS can expose private data or silently block legitimate access. Write explicit permission tests for each role before deploying policy changes.

**Duplicate venues**  
Without Google Place ID enforcement, the same real venue will accumulate multiple DB records. Events split across them. The longer this persists, the worse it gets. Mitigation: fuzzy matching in submission form, admin merge tool, and `google_place_id` UNIQUE constraint.

**Ticket and payment liability**  
Processing payments creates legal obligations: PCI compliance (delegated to Stripe), refund policies, potential payments license in some jurisdictions. Do not build payment processing until there is a legal entity, terms of service, and privacy policy. Phase 6 depends on this.

**Schema migration mistakes**  
Renaming `places` to `venues`, removing `location_slug`, restructuring FKs are destructive changes with existing production data. Every migration must have a tested rollback SQL. Use `ADD COLUMN` before `DROP COLUMN` patterns. Never run destructive migrations without a backup.

**`location_slug` as a hidden dependency**  
Every event record contains a hardcoded string tied to 4 cities. If slugs change or new cities are added, queries break silently. Phase 3 must replace this with `city`/`country` columns before the event count grows too large to migrate.

---

## 14. Immediate next step

**Phase 1 — Venue foundation.**

Three concrete actions:

1. **Add missing columns to the `places` table**: `address`, `google_place_id`, `website_url`, `status`, `verified`. These are already planned in `BackendPlace` — they just don't exist in the live DB yet.

2. **Create the `cities` table** with the 4 current locations seeded. Update `lib/locations.ts` to query this table at runtime, with the current hardcoded array as fallback during the transition.

3. **Update `PlacePanel.tsx`** to display `address` and show "Get Directions" / "Open in Maps" buttons generated from stored `lat`/`lng`. This is the highest-visibility user-facing improvement and is immediately testable without any other changes.

Everything else — global search, organizer flow, ticketing — depends on venues being real, addressable, navigable entities. Phase 1 is the prerequisite for all of it.

---

*See `docs/phase-1-plan.md` for the detailed implementation plan for Phase 1.*
