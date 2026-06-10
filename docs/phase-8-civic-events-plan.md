# Phase 8 — Civic / Movement Events

**Status:** Planned.  
**Scope:** Add lightweight civic-event support and the first featured movement page (Albanian Revolution).  
**Compatibility:** Additive only. All new columns are nullable. Existing rows and queries continue to work unchanged.

---

## 1. Goal

Extend the `events` pipeline so AlbaGo can host civic gatherings, peaceful demonstrations, and movement campaigns alongside nightlife, music, sports, culture, and food — without splitting the platform into separate apps.

Civic events are special only in that they expose extra organizing context (Telegram/WhatsApp coordination links, safety notes, expected attendance) and may be attached to a long-running movement page (e.g. `albanian-revolution`).

---

## 2. New event category

Add `civic` to the canonical list. No DB CHECK constraint exists on `events.category` today, so the change is purely UI + content:

```
existing: nightlife | music | sports | culture | food
phase 8 : nightlife | music | sports | culture | food | civic
```

`civic` is the umbrella value. Finer-grained intent lives in the new optional column `event_type` (see §3).

---

## 3. SQL migration (run in Supabase SQL editor)

All columns nullable. Backfill is unnecessary — existing rows treat NULL as "no civic context attached."

```sql
-- Phase 8.1 — Civic / movement extension on events
ALTER TABLE events
  ADD COLUMN IF NOT EXISTS event_type             text,
  ADD COLUMN IF NOT EXISTS is_civic               boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS featured_movement_slug text,
  ADD COLUMN IF NOT EXISTS organizer_contact      text,
  ADD COLUMN IF NOT EXISTS telegram_link          text,
  ADD COLUMN IF NOT EXISTS whatsapp_link          text,
  ADD COLUMN IF NOT EXISTS safety_notes           text,
  ADD COLUMN IF NOT EXISTS expected_attendees     integer;

-- Optional: constrain event_type to known values. Drop and re-add to extend later.
ALTER TABLE events
  ADD CONSTRAINT events_event_type_check
  CHECK (
    event_type IS NULL OR event_type IN (
      'protest', 'civic_gathering', 'movement_event', 'demonstration'
    )
  );

-- Index for the featured-movement page query (only relevant rows are indexed).
CREATE INDEX IF NOT EXISTS events_featured_movement_idx
  ON events (featured_movement_slug, date)
  WHERE featured_movement_slug IS NOT NULL;

-- Index for civic filtering on the events list.
CREATE INDEX IF NOT EXISTS events_is_civic_date_idx
  ON events (is_civic, date)
  WHERE is_civic = true;
```

### Phase 8.2 — Optional seed for the Albanian Revolution movement

These are seeded as `status = 'published'` so they appear in the featured page. Adjust dates as appropriate; SQL provided as a copy-paste block for the user to run.

```sql
INSERT INTO events (
  slug, title, category, event_type, is_civic, featured_movement_slug,
  description, date, time, price, highlight, status,
  location_slug, country, region,
  organizer_contact, telegram_link, expected_attendees, safety_notes
) VALUES
(
  'albanian-revolution-tirana',
  'Tirana — Peaceful Civic Gathering',
  'civic', 'protest', true, 'albanian-revolution',
  'A peaceful civic gathering in the heart of Tirana to call for transparent institutions and a fair future. Open to all citizens. Bring water, comfortable shoes, and respect for fellow demonstrators.',
  '2026-07-04', '18:00', 'Free', true, 'published',
  'tirana', 'Albania', 'Tirana County',
  'tirana@albago.org', 'https://t.me/+example_tirana', 12000,
  'Peaceful and lawful. Coordinated with local authorities. Family-friendly, no alcohol, no political party signage. Stay hydrated and follow marshal instructions.'
),
(
  'albanian-revolution-prishtina',
  'Prishtina — Sheshi Nënë Tereza',
  'civic', 'protest', true, 'albanian-revolution',
  'Solidarity march for civic rights and transparent governance. Family-friendly, peaceful, and inclusive.',
  '2026-07-04', '17:30', 'Free', true, 'published',
  'prishtina', 'Kosovo', NULL,
  'prishtina@albago.org', 'https://t.me/+example_prishtina', 8000,
  'Peaceful and lawful. Inclusive event. No alcohol. Bring ID for entry to the central square.'
);
```

---

## 4. RLS

No new policies needed. The existing `"Enable read access for all users"` SELECT policy on `events` already covers civic rows because they ship with `status = 'published'`. Future restriction work (per Phase 7B `events_select_published`) does not need to change.

---

## 5. Application changes

| File | Change |
|---|---|
| `app/page.tsx` | Add `civic` to `categories` so the homepage chip surface renders it. |
| `app/events/page.tsx` | Add `civic` to the categories tuple and treat the filter the same as other categories. |
| `app/events/albanian-revolution/page.tsx` | **New.** Cinematic featured-movement page (server-rendered) — see §6. |
| `components/cinematic/*` | **New.** UI primitives ported from Albanian_Revolution: `Reveal`, `SectionLabel`, `CinematicButton`. |
| `components/protest/*` | **New.** `ProtestMap`, `ProtestList`, `MovementCounter`, `FeaturedCities`, `Timeline`, `Testimonials`, `SafetyPanel`, `VolunteerPanel`. |
| `types/event.ts` | Extend with optional civic fields (TypeScript-only; DB still source of truth). |
| `app/globals.css` | Add cinematic utilities (`display-text`, `kicker`, `bg-grid`, `shine-text`, `bg-noise`, `animate-ping-soft`, `animate-marquee`, `shadow-glow-*`). |
| `app/layout.tsx` | Load Instrument Serif font for the `--font-display` CSS variable. |
| `package.json` | Add `framer-motion` for cinematic motion on the featured page only. |

---

## 6. Featured movement page (`/events/albanian-revolution`)

Server component. Reads `events` directly using the cookie-authenticated server client. Filters by:

```ts
.eq('status', 'published')
.eq('featured_movement_slug', 'albanian-revolution')
.order('date', { ascending: true })
```

Page sections (composed cinematically):

1. **Hero** — Instrument Serif headline, animated radial flame, "Find / Register / Volunteer" CTAs, live attendance counter.
2. **Movement counter** — sum of `expected_attendees` across the movement's events.
3. **Mission** — peaceful + lawful + worldwide messaging.
4. **Featured cities** — top six cities for this movement (by attendance).
5. **Upcoming gatherings** — protest cards (countdown, organizer, contact, telegram).
6. **Map** — AlbaGo MapLibre map showing only this movement's protests (lat/lng comes from `places.lat/lng` via the existing `place_id` linkage, or from a separate `lat`/`lng` if added to events later).
7. **Volunteer roles** — link to `/volunteer` with structured role chips (organizer, designer, video editor, translator, marshal, social, legal observer).
8. **Safety & legality panel** — required disclosure block: peaceful, lawful, family-friendly, no violence, no harassment, no extremism.
9. **Media wall** — optional, hidden if no rows.
10. **Final CTA banner** — Find a Protest / Register a Protest / Volunteer / Share the Movement.

---

## 7. Backwards-compatibility checks

- All existing `events` rows continue to return for `/events`, `/`, `/map`, `/events/[slug]` — they have `is_civic = false` (default) and `featured_movement_slug = NULL`.
- The events list query does not filter on `is_civic` unless the user picks the `civic` category, so the default page is unaffected.
- The map query still selects all places for a location; civic markers are visually labeled but use the same renderer.

---

## 8. How to verify locally

```powershell
# 1. From the AlbaGo/albago directory, install the new dependency
npm install

# 2. Apply the SQL migration above in the Supabase SQL editor

# 3. Run the dev server
npm run dev
```

Then visit:
- `http://localhost:3000/` — original home, unchanged for nightlife users; new "Featured movement" surface visible at the bottom.
- `http://localhost:3000/events` — `civic` chip appears in the category filter.
- `http://localhost:3000/events/albanian-revolution` — the cinematic featured-movement page.

---

## 9. Out of scope (deferred)

- Poster generator (Albanian_Revolution had a stub; not migrated yet — adds `html2canvas`/`jspdf` bulk that nightlife users don't need).
- Push notifications.
- Real-time attendance updates (the live ticker in the hero uses optimistic local increments).
- Per-protest standalone routes (`/events/albanian-revolution/[city]`). The current `/events/[slug]` server route is reused — each protest is an `events` row with a normal slug.
