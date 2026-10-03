# Phase 41 — Platform Cleanup: clean, understandable, complete

**Status:** PLAN — awaiting approval. Nothing is implemented.
**Written:** 2026-10-03
**Trigger:** an outside AI review of albago.org (scores: content 5/10, trust 6/10) plus our own
verification of every claim against the live site, the code and the live database.
**Parked:** Phase 40 (event series) stays on its branch `phase-40-event-series`, unmerged, until
this phase is done.

> Rule for this phase: **no new features.** Every step makes something that already exists
> correct, consistent or visible. Each step is one commit, ships alone, and is verified by you
> before the next one starts.

---

## 1. What is actually wrong (verified 2026-10-03)

Read-only check of the live database (published events) and albago.org:

| # | Problem | Evidence | Root cause |
|---|---|---|---|
| P1 | **Almost no live content** | 60+ published events in the DB, only **4** upcoming (+1 recurring protest) | Imports dried up; Scout blocked on paid search key + `CRON_SECRET` |
| P2 | **Counters disagree** | Home: 5 events / 3 cities. /events: 6. Map: 3 (reviewer saw 14) | Home, /events, map and city pages each run their own query with their own idea of "live" |
| P3 | **"0 Venues" on the homepage** | 60 of 60 events have no `place_id` | Venue counter only counts linked places; no importer creates places |
| P4 | **One country, many names** | Albania stored as `Shqipëria` (32) **and** `Albania` (2); Austria as `Austria` + `Österreich`; Belgium as `België / Belgique / Belgien`; North Macedonia in Cyrillic | `country` is free text in whatever language the source used; the map groups by raw text |
| P5 | **One city, many slugs** | `tirane` (10) **and** `tirana` (1); `deutschland` used as a city; cards say "Tirane", city list says "Tirana" | Importers slugify the source's spelling; no alias table |
| P6 | **"Unknown" shown to visitors** | Berlin event price = `Unknown`; wizard/crawler write `'Unknown'` as country fallback | Placeholder strings stored as data (`lib/wizardSubmit.ts`, `lib/crawl/toSubmission.ts`, `lib/locations.ts`) |
| P7 | **Prices are unreadable free text** | 48 of 60 empty; the rest mix "Hyrja falas", "Free", "30 EUR", "Standard and VIP tickets available"… | `price` is free text; structured `price_from_cents` exists but is rarely filled |
| P8 | **Trust fields exist but are empty** | 0 of 60 have `last_verified_at`; 57 of 60 have no `official_source_url` | Approval doesn't stamp them, even though importers know the source URL |
| P9 | **Noise in quick locations** | Homepage offers "Baks Rrjolle" next to Tirana and Prishtina | Location list includes every imported place name |
| P10 | **First impression is a protest, not discovery** | Top of homepage: "Flamingo Revolution · JOIN THE REVOLUTION", above "Every Event. One Map." | Campaign banner placed above the hero |

**Already built (the review assumed missing):** report-event button, "Details last verified"
line, official-source link, verified-organizer badge (`verification_tier`), share, directions,
save, `docs/listing-quality-standard.md`. These need data and visibility, not code.

---

## 2. The order, and why

```
41.1 Definitions ─► 41.2 Countries ─► 41.3 Cities ─► 41.4 Prices & "Unknown"
                                                              │
41.8 Trust page ◄─ 41.7 Homepage ◄─ 41.6 Counters & lists ◄─ 41.5 Publishing standard
        │
        └─► 41.9 Content push (operations) ─► 41.10 Deferred extras (only after content)
```

Standards first, so existing data is cleaned **once**. Counters after standards, so they count
clean data. Homepage after counters, so the new layout shows correct numbers. Content last, so
everything imported lands in the clean format.

---

## 3. The steps

Each step lists: **goal → changes → SQL → you verify.** SQL is always handed to you as a
copy-paste block when the step starts; never run by Claude.

### 41.1 — One definition of "live", "city", "country", "venue"
**Goal:** every page means the same thing by the same word.
- New `lib/liveEvents.ts`: one shared query builder + `isEventActive` → used by every public
  surface. Definitions written at the top of the file and in `docs/platform-architecture.md`:
  - *Live event* = published, not cancelled, has a future occurrence.
  - *City* = canonical location slug (see 41.3). *Country* = ISO code (see 41.2).
  - *Venue* = a `places` row. Events without one still count as events, never as venues.
- No visible change yet. **SQL:** none. **Verify:** build green.

### 41.2 — Countries as ISO codes
**Goal:** "Albania" appears once, in the visitor's language.
- Add `events.country_code` (`AL`, `XK`, `DE`, `AT`, `BE`, `MK`, `IT`, `FR`, `GB`, `US`…).
- Backfill from all current spellings (mapping table in the migration).
- Display name via `Intl.DisplayNames` in the chosen language (sq → "Shqipëria", en → "Albania").
- All writers (wizard, Radar, Crawl, GPT ingest, Scout, Lens resolver) write the code.
- Map country chips group by code.
- **SQL:** add column + backfill + CHECK (2 letters). Old `country` text kept, read-only, until 41.4 is verified.
- **Verify:** map shows one Albania; event pages show the country in your language.

### 41.3 — Cities: one slug per city, with aliases
**Goal:** "Tirana" everywhere, never "Tirane" next to it.
- Alias table in code (`tirane`→`tirana`, `prishtine`→`prishtina`, `durres`, `vlore`, `shkoder`,
  `korce`, `milano`/`milan`, `wien`/`vienna`…); importers resolve through it.
- Backfill existing rows to canonical slugs; fix rows using a country as a city (`deutschland`).
- City labels come from the locations list only, so cards and lists can't disagree.
- **SQL:** UPDATE backfill (with a dry-run SELECT first).
- **Verify:** /events city filter and event cards show identical names.

### 41.4 — Prices and the end of "Unknown"
**Goal:** a visitor never sees a technical value.
- Price state, derived for display: **Free** · **From €X** · **Price not announced**
  (translated in all 4 languages). Free-text `price` stays as "ticket notes" under it.
- Recognise free variants on import ("Free", "Hyrja falas", "Gratis", "Eintritt frei").
- Stop writing `'Unknown'` anywhere: `lib/wizardSubmit.ts` (4 places), `lib/crawl/toSubmission.ts`,
  `lib/locations.ts`, admin palette fallback. Missing = `NULL`, the UI decides the wording.
- **SQL:** `UPDATE … SET price = NULL WHERE price = 'Unknown'`, same for country.
- **Verify:** Berlin event shows "Price not announced".

### 41.5 — Publishing standard enforced at approval
**Goal:** nothing incomplete goes live; trust fields fill themselves.
- Approval (queue, Radar, Compose) blocks publish unless the listing has: date + time, address
  or online link, city, country, organizer, description, price state, ticket link **or** source.
  (Aligns `lib/radar/approvalValidation.ts` with `docs/listing-quality-standard.md`.)
- On approve: stamp `last_verified_at = now()`; copy the import's source URL into
  `official_source_url`.
- One-time review list of the 4–5 live events to complete them by hand.
- **SQL:** none (or a small backfill of `official_source_url` from `event_import_candidates`).
- **Verify:** every live event page shows "Details last verified" + a source link.

### 41.6 — Counters, map and lists agree
**Goal:** home, /events, map and city pages show the same numbers.
- Home stats, category tiles, /events, city pages and map all use `lib/liveEvents.ts`.
- Worldwide map shows **all** live events with coordinates (today: civic only).
- Venues counter hidden while 0 → replaced by **Countries** (meaningful for the diaspora).
- Quick locations = cities that have live events, then the core list (Tirana, Prishtina,
  Durrës, Albanian Coast, Berlin, Online). Imported village names never appear there.
- **SQL:** none.
- **Verify:** pick any city — the number matches on all four pages.

### 41.7 — Homepage order (stage-and-confirm, one block per commit)
**Goal:** a first-time visitor understands AlbaGo in 3 seconds.

| Order | Block | Status |
|---|---|---|
| 1 | Hero: search + location | exists — moves to the very top |
| 2 | Tonight | new rail, same card |
| 3 | This weekend | new rail |
| 4 | Categories | exists |
| 5 | Map preview → /map | new, small |
| 6 | Popular in Tirana / Prishtina / Berlin | adapts existing featured block |
| 7 | For organizers: "Add your event for free" | exists, reworded |
| 8 | **Civic & Community** — own section, links to the campaign | moved down from the top |

- Top-of-page Flamingo banner becomes a slim one-line strip (or removed — **your decision**).
- Nav: "Protests" → "Civic" (**your decision**).
- Empty rails hide themselves; no empty shells.
- **Verify:** after each block, on your phone.

### 41.8 — "How AlbaGo works" trust page
**Goal:** answer the reviewer's trust questions in one place.
- One page (linked from footer, About, FAQ and every event page): who runs AlbaGo, how events
  are checked, what "Verified organizer" means, how to report an error, civic policy (peaceful,
  lawful) and how it ties to moderation.
- **Needs from you:** 2–3 sentences about the team / founder.
- **SQL:** none.

### 41.9 — Content push (operations, mostly you + Claude together)
**Goal:** the site looks alive before it is promoted.
- Unblock the Scout: paid search key + `CRON_SECRET` in Vercel (parked 2026-08-24 — **your call**).
- Build a source list of 20–30 real venue/ticket sites (Tirana, Prishtina, Durrës, Vlorë,
  Berlin, London, Milan, Zürich, New York) and run Radar/Crawl over them.
- **Targets before promotion:** 50+ live events · 8+ cities · 10–20 for the coming weekend.
- Outreach to organizers → organizer accounts → "Verified organizer" badges.

### 41.10 — Deferred until 41.9 targets are met
Not built now (features without content feel like noise): add-to-calendar on event pages
(ICS code already exists for tickets), city event alerts / newsletter, follow organizer,
"claim this event".

---

## 4. Rules for every step

1. Branch from `main` (not the Phase 40 branch). Commit message `Phase 41.N: …`.
2. Gates: `npx tsc --noEmit`, `npx eslint`, `npm run build` — all green before commit.
3. All 4 languages updated together (key parity stays exact).
4. SQL: dry-run SELECT first, then the change, then a verification query — pasted inline.
5. You verify on the live site before the next step starts.

## 5. Decisions needed from you

| # | Question | Default if you don't mind |
|---|---|---|
| D1 | Approve this order? | — |
| D2 | Flamingo banner on top: slim strip or remove? | Slim strip |
| D3 | Rename nav "Protests" → "Civic"? | Yes |
| D4 | Venues counter: replace with "Countries"? | Yes |
| D5 | Unblock the Scout now (paid key) or later? | Later, after 41.6 |
