# ALBAGO EVENT SYSTEM — CURRENT-STATE TECHNICAL AUDIT

**Repository:** `AlbaGo/albago` · **Branch:** `main` @ `038b905` ("Phase 36: Edit uses the create wizard for published events too")
**Stack:** Next.js 16.2.10 (App Router) · React 19.2.4 · TypeScript 5 · Tailwind v4 · Supabase (Postgres + RLS + RPC + Storage) · MapLibre GL · Vercel
**Audit date:** 2026-08-12
**Purpose:** current-state foundation for designing a new AlbaGo Event Intelligence Engine. No architecture is proposed here.

> **Global caveat on the database:** the repository contains **no full DDL for the base `events` / `event_submissions` / `places` / `cities` tables.** Those were created outside version control (Supabase Studio / an earlier base44 fork). `docs/seeds/*.sql` contains only *additive* migrations from Phase 8 onward, with no applied-ledger. `docs/schema-reference.md` is a hand-maintained document last dated 2026-05-14 and is now materially out of date in several places. Where doc and code disagree, this report states the code and flags the discrepancy.

---

## SECTION 1 — HIGH-LEVEL ARCHITECTURE

There are **five distinct intake paths** into the `events` table. The crawler/AI path is only one of them.

```
                       ┌──────────────────── INTAKE PATHS ────────────────────┐

(A) DISCOVERY AGENT (autonomous)
    crawl_sources (DB registry, /admin/sources)
        │  Vercel Cron  GET /api/cron/discover   (daily 04:00 UTC)
        │  or  POST /api/admin/sources/run  ("Run all now")
        ↓
    runRegistryDiscovery()            lib/radar/discovery.ts
        ↓
    expandSource(url)
        ├─ discoverEventLinks()       lib/crawl/discover.ts   (anchors + JSON-LD urls)
        └─ discoverFromSite()         lib/crawl/site.ts       (robots.txt → sitemap → homepage)
        ↓  (same-host event-detail URLs, ≤15 found, ≤12 read per source)
    importFromUrl(eventUrl)           lib/radar/service.ts
        ├─ safeFetch (SSRF-guarded)   lib/ssrfGuard.ts
        ├─ fetchUrlContent()          lib/ai/urlReader.ts  (OG + JSON-LD + <title> + body text + image)
        ├─ readEventFromContent()     → Gemini (AI SDK) → PosterReading JSON
        ├─ resolvePoster()            lib/lens/resolve.ts  (city, venue, geocode, duplicate)
        ├─ assessReading()            lib/radar/assess.ts  (confidence + warnings + missing_fields)
        └─ upsert on normalized_url
        ↓
    event_import_candidates  (status = needs_review | failed)
        ↓
(B) ADMIN URL PASTE      POST /api/admin/event-radar             { url }
(C) ADMIN TEXT PASTE     POST /api/admin/event-radar/import-text { text }
        ↓  (same importFromUrl / importFromText, same candidate table)

    /admin/event-radar  →  /admin/event-radar/[id]   (human review #1 + field edits)
        │  action: approve
        ↓
    crawlReadingToSubmission()        lib/crawl/toSubmission.ts
        ↓
    event_submissions   (status = 'pending', submitted_by_user_id = approving admin)
        │
(D) COMMUNITY WIZARD  /submit-event → EventCreationWizard (mode 'community')
        │  submitCommunityEvent() → RPC submit_event_submission(p_payload jsonb)
        ↓
    event_submissions   (status = 'pending')
        │
        ↓
    /admin/queue  (AdminClient.tsx) — human review #2 — approve
        │  client-side supabase.from('events').insert({...}) + status='approved' on the submission
        ↓
    events  (status = 'published')  ←── PUBLIC
        ↑
(E) ADMIN WIZARD      /admin/events/new  → submitAdminEvent() → direct events INSERT, status='published'
(F) ORGANIZER WIZARD  /organizer/create  → RPC organizer_create_event_v2() → events status='draft'
                                          → RPC organizer_submit_event() → 'pending_review'
                                          → /admin/queue → RPC admin_publish_event() → 'published'

                       └──────────────────────────────────────────────────────┘

POST-PUBLICATION MONITORING
    Vercel Cron GET /api/cron/verify (daily 05:00 UTC)
        ↓ verifyEvents()  lib/radar/verify.ts
    events WHERE status='published' AND official_source_url IS NOT NULL AND date >= today
        ↓ re-read source via readEventFromUrl()
        ↓ decideVerify()  lib/radar/verifyDecide.ts
    → stamps events.last_verified_at, may set events.listing_status='updated'
    → never auto-cancels; anomalies are only returned in the cron response body (nothing reads it)
```

**Key fact:** `event_import_candidates` is an inbox in front of `event_submissions`, which is in front of `events`. An imported event passes through **three tables and two human approvals** before it is public.

---

## SECTION 2 — DATABASE / DATA MODEL

### 2.1 Table inventory

| Table | Origin of DDL | Purpose |
|---|---|---|
| `events` | **not in repo** (base) + 20+ additive seeds | Canonical published event |
| `event_submissions` | **not in repo** (base) + additive seeds | Community/import moderation queue |
| `event_import_candidates` | `docs/seeds/radar-1-event-import-candidates.sql` | Radar/Discovery staging + evidence |
| `crawl_sources` | `docs/seeds/crawl-sources.sql` | Source registry for the nightly cron |
| `places` | **not in repo** | Venues |
| `cities` | **not in repo** + `phase-12-city-autoseed.sql` | Location metadata |
| `organizers` | **not in repo** + `phase-17-organizer-verification.sql` | Organizer identity |
| `organizer_onboarding_responses` | **not in repo** | Onboarding survey |
| `saved_events` | **not in repo** | User bookmarks |
| `ticket_tiers`, `orders`, `order_items`, `tickets`, `ticket_scans` | `phase-33-ticketing.sql` | Free e-ticketing |
| `volunteer_signups` | `phase-9-volunteer-signups.sql` | Civic volunteering |
| `interactions` | `phase-26-interactions.sql` | PII-free analytics |
| `profiles` | Supabase trigger | Roles (`role`, `studio_access`) |
| `push_subscriptions` | `app-1-push-subscriptions.sql` | Web push |
| `social_accounts` / `social_campaigns` / `social_posts` | `bc-1-broadcast.sql` | Broadcast |

**NOT IMPLEMENTED:** no `venues` table (venues are `places`), no `event_categories` table, no `tags` table, no `event_images`/`event_media` table, no `event_occurrences` table, no `translations` table.

### 2.2 `events`

Assembled from seed migrations, live RPC bodies, and the TypeScript row types (`types/event.ts` `OrganizerEvent`, `app/events/[slug]/page.tsx` `EventRecord`, `components/events/EventCard.tsx` `PublicEvent`, `app/admin/AdminClient.tsx` `EventRow`).

```
-- identity / core (base table, DDL not in repo)
id                      uuid          NOT NULL  DEFAULT gen_random_uuid()   PK
title                   text          NOT NULL
slug                    text          NOT NULL  UNIQUE
place_id                uuid          nullable  FK → places(id) ON DELETE SET NULL
category                text          NOT NULL
description             text          NOT NULL
date                    date          NOT NULL
time                    time          nullable    ← see note T1
price                   text          nullable    (display string, never parsed)
highlight               boolean       NOT NULL  DEFAULT false
status                  text          NOT NULL  DEFAULT 'published'
                                      CHECK IN (draft, pending_review, published,
                                                rejected, cancelled, completed)
location_slug           text          NOT NULL    (soft ref to cities.slug — NOT a FK)
country                 text          NOT NULL
region                  text          nullable
search_vector           tsvector      nullable   (trigger-maintained, GIN)
created_at              timestamptz   NOT NULL  DEFAULT now()
updated_at              timestamptz   NOT NULL  DEFAULT now()

-- Phase 7B (organizer platform)
organizer_id            uuid          nullable  FK → organizers(id) ON DELETE SET NULL
origin                  text          NOT NULL  DEFAULT 'admin_seeded'
                                      CHECK IN (admin_seeded, organizer_dashboard,
                                                community_submission, imported)
banner_url              text          nullable
published_at            timestamptz   nullable
admin_note              text          nullable

-- Phase 13 (rich data) — docs/seeds/phase-13-event-rich-data.sql
end_time                text          nullable
timezone                text          nullable  DEFAULT 'Europe/Tirane'
tags                    text[]        nullable  DEFAULT '{}'
language                text          nullable  DEFAULT 'en'
address                 text          nullable
is_online               boolean       NOT NULL  DEFAULT false
online_url              text          nullable
organizer_name          text          nullable
organizer_phone         text          nullable
organizer_website       text          nullable
organizer_socials       jsonb         nullable

-- Phase 8 (civic)
is_civic                boolean       nullable
event_type              text          nullable  CHECK IN (protest, civic_gathering,
                                                movement_event, demonstration) OR NULL
featured_movement_slug  text          nullable
organizer_contact       text          nullable
telegram_link           text          nullable
whatsapp_link           text          nullable
safety_notes            text          nullable
expected_attendees      integer       nullable

-- geo (base)
lat                     float8/numeric nullable
lng                     float8/numeric nullable

-- Phase 15 (recurrence) — docs/seeds/phase-15-recurring-events.sql
recurrence              text          NOT NULL  DEFAULT 'none'
                                      CHECK events_recurrence_check IN (none, daily, weekly)
recurrence_until        date          nullable
recurrence_days_of_week integer[]     nullable  DEFAULT '{}'   (ISO 1=Mon..7=Sun)
recurrence_exceptions   date[]        nullable  DEFAULT '{}'

-- Phase 18 (gallery) — docs/seeds/phase-18-event-gallery.sql
gallery_urls            text[]        NOT NULL  DEFAULT '{}'

-- Phase 27
address_hint            text          nullable

-- Phase 31 (i18n) — docs/seeds/phase-31-event-i18n.sql
title_i18n              jsonb         nullable   ({en,sq,de,es})
description_i18n        jsonb         nullable

-- Phase 34 (provenance)
submitted_by_user_id    uuid          nullable  FK → auth.users(id)

-- Phase 35 (media sections) — docs/seeds/phase-35-media-sections.sql
cover_in_gallery        boolean       NOT NULL  DEFAULT true
content_sections        jsonb         NOT NULL  DEFAULT '[]'   ([{title, body, urls[]}])

-- audit §11/§14/§16 batch (2026-07-14, per schema-reference)
ticket_url              text          nullable
ticket_provider         text          nullable
price_from_cents        integer       nullable  CHECK >= 0
price_currency          char(3)       NOT NULL  DEFAULT 'EUR'
ticket_sales_status     text          nullable  CHECK IN (on_sale, sold_out)
door_tickets            boolean       NOT NULL  DEFAULT false
age_restriction         text          nullable
official_source_url     text          nullable   ← the verification-loop key
last_verified_at        timestamptz   nullable
listing_status          text          nullable  CHECK IN (confirmed, updated,
                                                postponed, cancelled)
doors_time              text          nullable
practical_info          jsonb         nullable
end_date                date          nullable  CHECK end_date >= date
```

**Note T1 — `events.time` is a Postgres `time`, not `text`.** `docs/schema-reference.md` says `text`. The code disproves it:
- `admin_update_event` (regenerated from **live** `pg_get_functiondef` on 2026-07-22, `docs/seeds/multiday-end-date.sql:63`) does `COALESCE(NULLIF(patch->>'time','')::time without time zone, time)`. COALESCE requires a common type; `time` and `text` are different categories and would error.
- `lib/dateFilters.ts:52` `formatEventTimeLabel` exists to *"strip trailing seconds from a Postgres 'HH:MM:SS'"*.

**`events.time` is nullable** — `OrganizerEvent.time: string | null`, `EventRow.time: string | null`, and `lib/wizardSubmit.ts:458` inserts a possibly-null value. (`EventRecord.time: string` on the detail page is a typing lie about a nullable column.)

**Constraints known from code:** `UNIQUE (slug)` · `events_recurrence_check` · `CHECK end_date >= date` · `events_civic_no_tickets` (is_civic ⇒ no `ticket_url`, no positive `price_from_cents`) · `event_type IN (civic subtypes) OR NULL`.

**Triggers:** `events_search_vector_update` (BEFORE INSERT/UPDATE) · `events_sync_banner_from_gallery` (BEFORE INSERT OR UPDATE OF `gallery_urls` → forces `banner_url := gallery_urls[1]`). **No `updated_at` trigger** — RPCs set it manually.

**RLS** (composite of `phase-13.1`, `phase-36`, schema-reference):
```
events_select_published   SELECT USING (status = 'published')
events_select_owner       SELECT USING (organizer_id = auth.uid())
events_select_admin       SELECT USING (is_admin())
events_insert_organizer   INSERT WITH CHECK (organizer_id = auth.uid()
                                             AND status='draft'
                                             AND origin='organizer_dashboard')
events_admin_write        ALL TO authenticated USING (is_admin())      ← insert + delete
admins_update_events      UPDATE TO authenticated USING/CHECK is_admin()  ← Phase 36
```

### 2.3 `event_submissions`

```
id                      uuid          NOT NULL  DEFAULT gen_random_uuid()   PK
title                   text          NOT NULL
venue_name              text          NOT NULL      ← 'TBA' fallback supplied by callers
place_id                uuid          nullable  FK → places(id) ON DELETE SET NULL
category                text          NOT NULL      ← 'culture' fallback in the RPC
description             text          NOT NULL
date                    date          NOT NULL      ← note D1
end_date                date          nullable      (added 2026-07-22)
time                    time          NOT NULL      ★★★ the constraint behind the reported error
end_time                time          nullable
timezone                text          nullable  DEFAULT 'Europe/Tirane'
price                   text          nullable
contact_email           text          nullable?     ← note C1
submitted_by_user_id    uuid          NOT NULL?     ← note S1
status                  text          NOT NULL  DEFAULT 'pending'  (pending|approved|rejected)
admin_note              text          nullable
country                 text          NOT NULL
region                  text          nullable
location_slug           text          NOT NULL
created_at / updated_at timestamptz   NOT NULL  DEFAULT now()

-- Phase 8.3 civic:  event_type (CHECK), is_civic NOT NULL DEFAULT false,
--                   featured_movement_slug, organizer_contact, telegram_link, whatsapp_link
-- Phase 13:         lat, lng, address, is_online NOT NULL DEFAULT false, online_url,
--                   tags text[] DEFAULT '{}', language DEFAULT 'en', organizer_name,
--                   organizer_phone, organizer_website, organizer_socials jsonb,
--                   safety_notes, expected_attendees
-- Phase 27:         address_hint
-- Phase 15:         recurrence NOT NULL DEFAULT 'none' (CHECK), recurrence_until,
--                   recurrence_days_of_week int[], recurrence_exceptions date[]
-- Phase 18/31/35:   banner_url, gallery_urls text[] NOT NULL DEFAULT '{}',
--                   title_i18n jsonb, description_i18n jsonb,
--                   cover_in_gallery boolean NOT NULL DEFAULT true,
--                   content_sections jsonb NOT NULL DEFAULT '[]'
```

- **D1:** schema-reference claims `date text NOT NULL`; the live RPC casts `v_date::date` and the value is copied straight into `events.date`. Treat as `date`. Discrepancy flagged.
- **C1:** schema-reference says `contact_email NOT NULL`; `lib/crawl/toSubmission.ts:106` sets it to `null` and Radar approval succeeds in production → **nullable**. Discrepancy flagged.
- **S1:** schema-reference says `submitted_by_user_id` nullable; commit `61d40f6` and the comment at `toSubmission.ts:127-129` (*"satisfies the queue's `submitted_by_user_id` NOT NULL constraint"*) mean it was made **NOT NULL**. Discrepancy flagged.

**Trigger:** `event_submissions_sync_banner_from_gallery` (same banner↔gallery[1] lockstep).

**RLS:** `submissions_select` (own OR admin) · `submissions_insert` (auth.uid() = submitted_by_user_id) · `submissions_admin_update` · `submissions_admin_delete`.

### 2.4 `event_import_candidates` — `docs/seeds/radar-1-event-import-candidates.sql`

```
id                   uuid PK DEFAULT gen_random_uuid()
source_url           text NOT NULL
normalized_url       text NOT NULL          ← UNIQUE INDEX (dedup key)
source_name          text
image_url            text
parser_version       text                   ('radar-1')
status               text NOT NULL DEFAULT 'needs_review'
                     CHECK IN (processing, needs_review, approved, rejected, failed)
error                text
confidence           text CHECK IN (high, medium, low)
warnings             jsonb NOT NULL DEFAULT '[]'   ([{code,message}])
missing_fields       jsonb NOT NULL DEFAULT '[]'
reading              jsonb                  ← the full PosterReading
resolution           jsonb                  ← the full LensResolution
title / event_date / venue_name / city_label / country    (denormalized for the list view)
duplicate_status     text CHECK IN (live, in_review, none)
duplicate_event_slug text
submission_id        uuid                   ← the event_submissions row created on approval
admin_note           text
imported_by / decided_by  uuid FK auth.users ON DELETE SET NULL
created_at / updated_at   timestamptz NOT NULL DEFAULT now()

UNIQUE INDEX event_import_candidates_normalized_url_key (normalized_url)
INDEX         event_import_candidates_status_idx (status, created_at DESC)
RLS: event_import_candidates_admin_all FOR ALL TO authenticated (profiles.role='admin')
```
No FK from `submission_id` → `event_submissions.id` (soft link only).

### 2.5 `crawl_sources` — `docs/seeds/crawl-sources.sql`

```
id, url NOT NULL, normalized_url NOT NULL (UNIQUE), label,
kind text CHECK IN (venue, promoter, ticketing, listing, event),
enabled boolean NOT NULL DEFAULT true,
last_run_at timestamptz, last_found_count integer,
last_status text CHECK IN (ok, error, empty),
created_by uuid FK auth.users, created_at, updated_at

INDEX crawl_sources_enabled_idx (enabled, created_at DESC)
RLS: crawl_sources_admin_all FOR ALL TO authenticated (profiles.role='admin')
```
Seeded rows: `gowild.al`, `enterevents.al/events`, `event.bna.al/en/eventet`.
**No `crawl_interval`, no `trust`, no `city`/`country`, no `next_run_at`.**

### 2.6 `places`

```
id, name NOT NULL, slug NOT NULL UNIQUE, category NOT NULL, description,
city, address, lat float8, lng float8,
image_url, cover_image_url, images text[],
options text[] NOT NULL DEFAULT '{}', verified boolean NOT NULL DEFAULT false,
website_url, phone, status text NOT NULL DEFAULT 'active',
google_place_id text (partial UNIQUE WHERE NOT NULL),
location_slug text NOT NULL, country text NOT NULL, search_vector tsvector,
created_at, updated_at
```
RLS: `SELECT USING (true)`. **No INSERT/UPDATE/DELETE policies at all.**

### 2.7 `cities`

```
id, slug NOT NULL UNIQUE, name NOT NULL, country NOT NULL,
country_code (NULL allowed since phase-12), lat NOT NULL, lng NOT NULL,
timezone, zoom NOT NULL DEFAULT 12.5, is_featured NOT NULL DEFAULT false, created_at
RLS: cities_public_read (true) · cities_admin_write (is_admin())
```

### 2.8 Relationships

```
auth.users ─1:1─ profiles (role, studio_access)
auth.users ─1:1─ organizers (id = auth.users.id)
                   └─1:1─ organizer_onboarding_responses

places ──1:N──> events.place_id            (ON DELETE SET NULL)
places ──1:N──> event_submissions.place_id (ON DELETE SET NULL)
organizers ──1:N──> events.organizer_id    (ON DELETE SET NULL)
events ──1:N──> saved_events, ticket_tiers, tickets, volunteer_signups

cities.slug  ←soft, NO FK—  events.location_slug / places.location_slug
                            event_submissions.location_slug

event_import_candidates.submission_id  ←soft, NO FK—  event_submissions.id
event_submissions  ←NO LINK AT ALL—  events
crawl_sources  ←NO LINK—  event_import_candidates
```

**Critical gap:** no FK or column links a published `events` row back to the `event_submissions` row it came from, nor to the `event_import_candidates` row. The only forward-carried provenance is `events.official_source_url` (copied at approval, `AdminClient.tsx:473-474`) and `events.submitted_by_user_id`.

### 2.9 DATE AND TIME — the `null value in column "time"` error, explained

**Which table:** `event_submissions.time` is `NOT NULL`.

**Which migration created it:** **NOT IN REPOSITORY.** The base table was created outside `docs/seeds/`. No file adds, drops, or alters that NOT NULL.

**Current type:** the live `submit_event_submission` RPC inserts `nullif(p_payload->>'time','')::time` → the column is a Postgres **`time`** (schema-reference's "text" is stale).

**Can time be unknown?** **No, not for a submission.** Every writer maps blank → SQL NULL:
- `lib/wizardSubmit.ts:81` — `time: trim(draft.time)` → `null`
- `lib/crawl/toSubmission.ts:105` — `time: orNull(reading.time)` → `null`

And no earlier layer requires it: the wizard's `when` step (`EventCreationWizard.tsx:87-101`) validates only `date` / `end_date`, and `WhenStep.tsx` gives `time` an explicit clear (×) button.

`lib/radar/approvalValidation.ts` documents the bug verbatim: *"`time` maps through `orNull()` → NULL and trips `time NOT NULL` (the observed production bug)."* Its `missingApprovalFields()` blocks approval until title/date/**time** are non-blank; `translateSubmissionError()` maps PG `23502` on `"time"` to *"Start time is required by the event submission workflow."*

**Published events do NOT have this limitation** — `events.time` is nullable and the read stack tolerates it. **That asymmetry is the bug:** a timeless event is representable in `events` but not in the queue it must pass through.

**Start/end date:** separate — `events.date` + `events.end_date` (nullable, `CHECK end_date >= date`), mirrored on submissions.
**Multi-day:** yes, one *continuous* run only. `docs/schema-reference.md:287` states `multiple_dates` / `ongoing` / `time_slots` are **deliberately not modeled**.
**Multiple dates / venues:** **NOT IMPLEMENTED.**

---

## SECTION 3 — CURRENT EVENT MODEL

An "event" today is **one row in `events`**: one title, one slug, one date (or one contiguous range, or one repeat rule), one time, one location, one price string, one banner.

| Capability | Supported? | Mechanism |
|---|---|---|
| One date | YES | `events.date` |
| Start + end date | YES | `date` + `end_date`, `CHECK end_date >= date` |
| One venue | YES | `place_id` **or** free-text `address` + `lat`/`lng` |
| Multiple venues | **NO** | single `place_id`, single `lat`/`lng` |
| Multiple dates (non-contiguous) | **NO** | only `daily`/`weekly` rules + `recurrence_exceptions` |
| Multiple cities | **NO** | single `location_slug`, single `country` |
| Multiple ticket links | **NO** | single `events.ticket_url` |
| Multiple prices | partial | one `price` string + one `price_from_cents`; `ticket_tiers` allows many tiers but all share one event/date/venue |
| Multiple start times | **NO** | single `events.time` |
| Recurring dates | YES (limited) | `recurrence` in {none,daily,weekly}, `recurrence_until`, `recurrence_days_of_week`, `recurrence_exceptions` (`lib/recurrence.ts`) |
| Tour stops | **NO** | no grouping entity of any kind |
| Sessions / sub-events | **NO** | `content_sections` jsonb is presentational photo/text bands only |

### Example A — Korça Beer Fest, 12–16 August, one venue

Representable as a **single row**: `date=2026-08-12`, `end_date=2026-08-16`, `recurrence='none'`, `time` = start on the first day, `end_time` = end on the LAST day (`schema-reference:288`), one `place_id`/`lat`/`lng`. The detail page shows both dated lines + "Five-day event"; the card shows a two-day tile; JSON-LD emits a real multi-day `endDate`. This case works well.

Modelling it as `recurrence='daily'` instead is explicitly called out in `schema-reference.md:283` as *"the 'Sundance modeled as Daily' bug"*.

### Example B — Alban Skenderaj European Tour (Berlin 3 Sep / Zurich 7 Sep / London 12 Sep)

**Yes — three separate, entirely unrelated `events` rows.** Each with its own `id`, `slug` (three URLs, three SEO pages, no canonical parent), `date`, `time`, `location_slug`, `country`, `lat`/`lng`, `place_id`, `price`, `ticket_url`, `banner_url`, `gallery_urls`, `official_source_url`, `last_verified_at`.

There is **no column, table, or convention** binding them: no `tour_id`, `series_id`, `parent_event_id`, or `group_slug`. `recurrence` cannot express it (location changes, irregular interval). The Radar dedup keys on date + location + fuzzy title, so it will never associate them.

---

## SECTION 4 — EVENT SUBMISSIONS

### Where submissions are created

| Entry point | File | Mechanism |
|---|---|---|
| Community wizard | `app/submit-event/page.tsx` -> `SubmitEventClient.tsx` -> `components/event-wizard/EventCreationWizard.tsx` | `lib/wizardSubmit.ts` `submitCommunityEvent()` -> `rpc('submit_event_submission', { p_payload })` |
| Radar approval | `lib/radar/service.ts` `approveCandidate()` | `crawlReadingToSubmission()` then `db.from('event_submissions').insert()` via **service-role client** |

`app/submit-event/page.tsx` routes by role first: admins -> `/admin/events/new`, organizers -> `/organizer/create`.

### Required fields

**DB-level (RPC `submit_event_submission`, `docs/seeds/multiday-end-date.sql:329+`):**
- `title` — `raise exception 'title is required'`
- `date` — `raise exception 'date is required'`
- `time` — NOT NULL at column level, **no RPC guard** -> raw `23502`

RPC fallbacks: `category -> 'culture'`, `country -> 'Unknown'`, `location_slug -> 'unknown'`, `recurrence -> 'none'`, `is_online -> false`, `is_civic -> false`.
**Rate limit in the same RPC:** 3/hour, 10/day per `submitted_by_user_id`; admins exempt.

**Client-level (wizard):** type+category, title >=3, description >=20, non-past date, valid `end_date` if set, coords + `location_slug` (or valid `online_url`), organizer name + valid email. **Time is not validated.**

### Statuses

`pending` -> `approved` | `rejected`. No CHECK constraint (application-enforced). No path back.

### Lifecycle files

```
app/submit-event/SubmitEventClient.tsx
components/event-wizard/EventCreationWizard.tsx      collects the draft
types/eventDraft.ts                                  EventDraft + localStorage persistence
lib/wizardSubmit.ts  submitCommunityEvent()          draft -> payload
RPC submit_event_submission(p_payload jsonb)         inserts the pending row (rate-limited)
lib/wizardSubmit.ts  saveSubmissionMedia()           RPC set_submission_media (fail-soft)
      |
app/admin/queue/page.tsx -> app/admin/AdminClient.tsx
   approveSubmission()   (line 450)  events INSERT + submission UPDATE status='approved'
   rejectSubmission()    (line 584)  UPDATE status='rejected' + admin_note
   deleteSubmission()    (line 706)  hard DELETE (window.confirm)
```

### What approval actually does

`AdminClient.approveSubmission()` (`app/admin/AdminClient.tsx:450-582`) — **client-side code running with the admin's own JWT**, not an RPC:

1. slug = `createSlug(title) + '-' + submissionId.slice(0,8)`
2. look up `event_import_candidates` where `submission_id = s.id` -> recover `source_url`; keep only if it matches `^https?://` -> `events.official_source_url` (pasted imports carry a synthetic `paste:` key and are skipped)
3. if `lat`/`lng`/`location_slug` -> `rpc('upsert_city_from_event', ...)` (best-effort, non-fatal)
4. **`supabase.from('events').insert({...})`** — ~35 fields, hardcodes `status:'published'`, `highlight:false`. **`origin` is not set**, so it defaults to `'admin_seeded'` even for community/imported events. `place_id` copied through (always null in practice)
5. `supabase.from('event_submissions').update({ status: 'approved' })`
6. fire-and-forget `POST /api/admin/notify-event-published`

**Approval = COPY, not convert.** A new `events` row is created; the submission is retained forever as an audit trail. **The two are never linked.** Steps 4 and 5 are **two separate queries, not a transaction**.

**Retry extraction:** not available on `event_submissions` — only one stage earlier, on candidates (`retryCandidate()`, allowed only while `needs_review`/`failed`).

**Editing:** submissions are **not editable in the queue**. `QueueRowDetail` (`AdminClient.tsx:1683-1740`) gates Edit/Unpublish/Archive/Restore/Repost behind `row.source === 'event'`. For a submission you get only Approve, Reject, Preview, Delete.

---

## SECTION 5 — CURRENT CRAWLER

A **fetch-based reader, not a browser.** Lives in `lib/crawl/` + `lib/ai/urlReader.ts`, driven by `lib/radar/discovery.ts`.

> **Documentation discrepancy:** `docs/next-session.md:22-59` and `docs/master-plan/07-crawl.md:94` describe `app/api/admin/crawl/route.ts`, a `/admin/crawl` UI, `lib/crawl/crawl.ts`, and `scripts/crawl-batch.mjs`. **None exist** — commit `f5e9b50` removed them. The docs are stale.

### Entry points

| Trigger | Route | Auth | Function |
|---|---|---|---|
| Nightly cron | `GET /api/cron/discover` (`0 4 * * *`) | `Bearer $CRON_SECRET` | `runRegistryDiscovery({deadlineMs:270_000})` |
| Admin "Run all now" | `POST /api/admin/sources/run` | admin session | same |
| Admin one-source | `POST /api/admin/event-radar/discover` `{sourceUrl}` | admin session | `runDiscovery({sourceUrls:[url], deadlineMs:50_000})` |
| Admin single URL | `POST /api/admin/event-radar` `{url}` | admin session | `importFromUrl()` (no link discovery) |
| Verification re-read | `GET /api/cron/verify` (`0 5 * * *`) | `CRON_SECRET` | `verifyEvents()` |

### Inputs

A **source URL only.** No crawl depth parameter, no source ID passed in. Tunables are constants:
`DEFAULT_MAX_PER_SOURCE = 12`, `MAX_DISCOVERED_LINKS = 15`, `POLITE_DELAY_MS = 800`, `DEFAULT_DEADLINE_MS = 50_000` (unreached sources -> `report.remainingSources`).

### Fetching

`safeFetch()` from `lib/ssrfGuard.ts`. **Plain HTTP `fetch()` — no JavaScript execution, no Playwright, no Puppeteer, no browser rendering.** Confirmed: `package.json` has no headless-browser dependency.
- 8 s timeout (`AbortSignal.timeout`)
- spoofed desktop Chrome UA + `Accept-Language: en,sq;q=0.9,de;q=0.8,es;q=0.7`
- `redirect:'manual'`, max 4 hops, each re-validated
- body caps: 800 KB (link discovery), 600 KB (single page), 3 MB (sitemaps)
- content-type must contain `html` or `xml`

### Link discovery — `lib/crawl/discover.ts`

`extractEventLinks(html, baseUrl)` (pure, unit-testable):
1. **JSON-LD first** — `<script type="application/ld+json">` blocks whose `@type` matches `Event|ItemList`; every `"url"` is a trusted signal.
2. **Anchors** — regex over `<a href=...>text</a>`.

`filterEventUrl()` keep-rule: http(s), **same host as the base, always**, host not in `SKIP_HOSTS` (facebook, instagram, x, tiktok, youtube, linkedin, pinterest, wa.me, t.me...), path not containing `SKIP_PATH_FRAGMENTS` (`/tag/`, `/category/`, `/author/`, `/page/`, `/wp-`, `/login`, `/cart`, `/privacy`, `/terms`, `/contact`, `/search`, `/feed`, `/rss`...), and must carry an **event signal** — an `EVENT_TOKENS` match in the path (`event`, `ngjarje`, `aktivitet`, `spektakel`, `koncert`, `party`, `festa`, `festival`, `bileta`, `veranstaltung`, `evento`, `agenda`, `kalendar`, `whats-on`, `/e/`...), a `20\d{2}[/_-]\d{1,2}` date in the path, or an event token in the anchor text. Hash stripped, trailing slash trimmed, deduped, capped at 15.

**Depth = 1.** No recursion, no frontier, no re-descent.

### Site mode — `lib/crawl/site.ts`

Used when in-page discovery yields nothing: `GET /robots.txt` -> parse `Sitemap:` lines; else `/sitemap.xml`, `/sitemap_index.xml`, `/sitemap-index.xml`; sitemap-index aware with children matching `/event|ngjarje|agenda|program|calendar|kalendar/i` prioritized, **max 6 child sitemaps**; every `<loc>` filtered by the same rule; else fall back to `discoverEventLinks(homepage)`. Returns `{ eventUrls, via: 'sitemap'|'homepage'|'none' }`.

### HTML extraction — `fetchUrlContent()`

| Signal | Supported | Implementation |
|---|---|---|
| OpenGraph | YES | `metaContent()`, both attribute orders; `og:title`, `og:description`, `og:image`, `og:image:url`, `og:image:secure_url` |
| Twitter cards | YES | `twitter:image`, `twitter:image:src` |
| JSON-LD / schema.org Event | YES | `extractJsonLd()` — up to 3 blocks matching `"@type":"...Event"` or containing `startDate|location|performer`, 4000 chars each |
| `<title>` | YES | regex |
| Generic meta tags | partial — only the named ones |
| Visible text | YES | `visibleText()` strips script/style/tags |
| `link rel="image_src"` | YES | `linkImageSrc()` |
| Content `<img>` | YES | `firstContentImage()` |
| Microdata / RDFa | **NO** | |
| iCal / .ics | **NO** | |
| RSS / Atom | **NO** | `/feed`, `/rss` explicitly skipped |

**Important:** JSON-LD is **not parsed deterministically.** It is pasted as raw text into the LLM prompt and the model is merely *instructed* to "prefer an explicit startDate in structured data". **There is no `JSON.parse` of a schema.org Event anywhere in the repo.**

Unreadable guard: `!ogTitle && !ogDesc && !jsonLd && body.length < 40` -> `null` -> candidate `status='failed'`.
Model budget: 12 000 chars single event; 32 000 chars list mode.

### Images

Picked in order: `og:image` -> `og:image:url` -> `og:image:secure_url` -> `twitter:image` -> `twitter:image:src` -> `link rel=image_src` -> `firstContentImage()` (handles `data-src`, `data-original`, `data-lazy-src`, `data-lazy`, `srcset`; rejects `data:` URIs, `.svg`, `/(logo|icon|sprite|favicon|avatar|placeholder|spacer|blank|pixel|1x1|badge|loader|loading|facebook\.com\/tr)/i`, and declared `width<150`/`height<150`; two passes, preferring `/(uploads|storage|media|posters?|events?|photos?|files)/`).

Stored as `event_import_candidates.image_url` — a **remote URL reference only**. On approval -> `banner_url` + `gallery_urls[0]`. Validation is `httpImageUrl()` (protocol check only). **Never fetched, never HEAD-checked, never re-hosted, never size/type verified.** `toSubmission.ts:26`: *"referenced as-is (not re-hosted): a deliberate, reversible choice."*

Consequence: crawler images are external hotlinks that bypass `next/image` (only `*.supabase.co` is whitelisted in `next.config.ts`) and break silently when the source rotates the file.

### Error handling

| Concern | Behaviour |
|---|---|
| Retries | **None automatic.** Only a manual admin `retry` on a candidate |
| Timeouts | 8 s per fetch, hard |
| Failures | `readEventFromUrl -> null` -> persisted `failed` candidate with a human-readable `error`. Never a silent drop |
| Dead URLs | `failed` candidates; bulk-clearable via `POST /api/admin/event-radar/clear-failed` |
| Rate limiting (outbound) | `POLITE_DELAY_MS = 800`, sequential, one host at a time; Nominatim gets a global 1 req/s spacing |
| robots.txt | Read **only** for `Sitemap:` lines. `Disallow` is **not parsed or honoured** |
| Logging | `console.log`/`console.error` only; one summary line per cron run; nothing persisted |
| Crash isolation | Every layer try/catch'd; one bad source or page never aborts a run |

### Security

| Threat | Protected | Mechanism |
|---|---|---|
| localhost | YES | `isPublicHttpUrl()` blocks `localhost`, `0.0.0.0`, `*.local`, `*.internal`, `*.localhost` |
| Private IPv4 | YES | 0/8, 10/8, 127/8, 169.254/16 (cloud metadata), 172.16-31, 192.168/16, 100.64-127 (CGNAT), >=224 |
| Private IPv6 | YES | `::1`, `::`, `fe80...`, `fc...`, `fd...`, IPv4-mapped `::ffff:x.x.x.x` |
| DNS rebinding / A-record tricks | YES | `dns.lookup(host,{all:true})`; **every** resolved address must be public |
| Non-standard ports | YES | only empty, 80, 443 |
| Redirects to private hosts | YES | manual redirects, `isPublicHttpUrl()` per hop, max 4 |
| Massive files | YES | byte-slice caps |
| Non-HTML content | YES | content-type gate |

**Residual gaps:** (1) TOCTOU — DNS is validated, then `fetch()` resolves independently; a hostile DNS server could differ. (2) No total-bytes guard *during* the read — a large response is fully buffered before slicing.

---

## SECTION 6 — EVENT EXTRACTION

### The one extraction contract

Poster photo, pasted URL, crawled page, pasted text, and verification re-read all produce the same `PosterReading` (`lib/ai/posterReader.ts:25-58`):

```ts
export type PosterReading = {
  is_event: boolean
  confidence: number            // 0..1, model self-rating
  title: string
  description: string
  category: 'nightlife'|'music'|'sports'|'culture'|'food'|'civic'|''
  is_civic: boolean
  date: string                  // ISO YYYY-MM-DD, or ''
  time: string                  // HH:MM 24h, or ''
  end_time: string
  venue_name: string
  address: string
  city: string
  country: string
  price: string                 // exactly as printed
  language: 'en'|'sq'|'de'|'es'|'it'|'fr'
  tags: string[]                // <=5 lowercase words
  artists: string[]             // <=10
  organizer_name: string
  organizer_website: string
  recurrence: 'none'|'daily'|'weekly'
  recurrence_until: string
  recurrence_days_of_week: number[]   // ISO 1=Mon..7=Sun
}
```
**Absent:** no `end_date` (a range is coerced to `recurrence:'daily'` + `recurrence_until`), no `ticket_url`, no `place_id`, no per-field confidence, no evidence spans, no multi-occurrence array.

### Deterministic vs AI

**Field extraction is 100% AI.** Deterministic layers are only pre-processing (assembling the text blob, picking the image) and post-processing (coercion, resolution, assessment).

| Stage | Kind | Function |
|---|---|---|
| Fetch + distill | deterministic regex | `fetchUrlContent()` |
| Field extraction | **LLM** | `readEventFromContent()` / `readEventListFromContent()` / `readPosterImage()` |
| Coercion / clamping | deterministic | `coercePosterReading()` |
| Entity resolution | deterministic + Nominatim | `resolvePoster()` |
| Quality verdict | deterministic | `assessReading()` |

### AI details

- **Provider:** Google Gemini via Vercel AI SDK v7 (`ai`) + `@ai-sdk/google`
- **Model:** `lib/ai/textModel.ts` -> `google(process.env.AI_TEXT_MODEL || 'gemini-flash-lite-latest')`. Rolling alias because `gemini-2.5-flash` began 404ing in July 2026 and full Flash 503s on free tier
- **Structured output: NOT USED.** No `generateObject`, no Zod, no tool/function calling, no JSON mode. It is `generateText()` + a prompt asking for JSON + `parseModelJson()` + `coercePosterReading()`
- **Temperature / options:** not set (SDK defaults). Only `maxOutputTokens`: 1600 single/poster, 4000 list
- **Files:** `lib/ai/posterReader.ts`, `urlReader.ts`, `translateEvent.ts`, `captionWriter.ts`, `posterArtDirection.ts`, `promptReader.ts`
- **Env:** `GOOGLE_GENERATIVE_AI_API_KEY`, optional `AI_TEXT_MODEL`, `AI_GATEWAY_API_KEY`

### Prompts (three, all in-repo)

1. `posterReader.ts:85-103` — poster photos, 12 rules. Rule 1: *"NEVER invent information... Wrong guesses damage trust; empty fields are fine."* Handles Albanian month names, Albanian weekday names for weekly recurrence, doors-vs-start, `is_event:false`, plus bounding-box `regions` for the scan-theatre UI.
2. `urlReader.ts:234-251` — a single event page, 11 rules. *"Ignore navigation menus, cookie banners, related-event lists, and comments — extract only the ONE main event."*
3. `urlReader.ts:296-310` — a listing page. Returns `{"events":[...]}`, capped at 15, *"Do NOT return the same event twice. Merge obvious duplicates (same title + date)."*

Every prompt injects `Reference date (today): {todayIso}` — the mechanism that resolves year-less dates.

### Coercion guards (`coercePosterReading`)

`date` must match `^\d{4}-\d{2}-\d{2}$` else `''`; `time`/`end_time` must match `^\d{2}:\d{2}$` else `''`; `confidence` clamped [0,1]; `category` must be in `LENS_CATEGORIES` else `''`; `is_civic` forced true when category is civic; length caps (title 160, description 1500, venue 120, address 200, city 80, price 60); `tags` <=5x30, `artists` <=10; **recurrence sanity:** `recurrence_until` before the start or a span > 366 days is discarded (`MAX_SERIES_SPAN_MS`); weekly with an empty weekday list derives the weekday from the resolved date ("derivation, not invention").

### When extraction fails

| Failure | Result |
|---|---|
| Fetch fails / non-HTML / thin page | `failed` candidate: *"The page could not be read — it may be login-walled, JavaScript-only, or not reachable. Try pasting the event text into the Queue instead."* |
| Model output unparseable | same `failed` path |
| Read OK but `is_event:false` or `confidence < 0.35` | **discovery runs:** candidate is **deleted**, counted `not_event` (`isKeepableEvent`). **manual single-URL import:** kept, flagged `not_single_event` -> forced `low` |
| Resolution throws | `resolveSafely()` -> `NONE_RESOLUTION`; candidate survives unresolved |
| Translation throws | `translation: null`; event keeps single-language text |

---

## SECTION 7 — SOURCE REGISTRY

**Two registries exist. One is live, one is a dead stub.**

### Live — the `crawl_sources` DB table

- Store: `lib/crawl/sourceStore.ts` (server-only, **service-role**, every function fails SOFT so a missing table can never crash the cron)
- UI: `/admin/sources` — bulk paste one URL per line, enable/disable, delete, **"Run all now"**
- API: `GET|POST|PATCH|DELETE /api/admin/sources` (caps: 1000 URLs, 2048 chars each)

| Metadata | Present |
|---|---|
| URL / normalized URL | YES (`normalizeImportUrl`) |
| Label | YES (defaults to bare host) |
| Kind | YES — but **set only by the SQL seed; the admin UI never writes it** |
| Active (`enabled`) | YES |
| Last crawled / yield / status | YES — a **1-deep overwrite**, no history |
| City / country | **NO** |
| Trust / priority | **NO** |
| Crawl interval | **NO** — every enabled source is crawled on the same nightly schedule |
| Next run at | **NO** |
| Auth / cookies | **NO** |

`recordRun()` writes `'ok'` when `found > 0` else `'empty'` — **`'error'` is never actually written** by `runRegistryDiscovery()`.

### Dead stub — `lib/crawl/sources.ts`

A checked-in `CRAWL_SOURCES` array of three disabled `https://replace-me.example/...` templates. `enabledSources()` returns `[]`. Still wired in: `runDiscovery()` (`lib/radar/discovery.ts:105`) falls back to it when called with no URLs — always empty. Harmless but misleading dead code.

### Automatic re-crawling

Yes — `vercel.json`:
```json
{"crons":[
  {"path":"/api/cron/discover","schedule":"0 4 * * *"},
  {"path":"/api/cron/verify","schedule":"0 5 * * *"}
]}
```

---

## SECTION 8 — SCHEDULING / BACKGROUND JOBS

| Mechanism | Present |
|---|---|
| Vercel Cron | YES — 2 jobs |
| Supabase cron / pg_cron | **NO** |
| GitHub Actions | **NO** (`.github/` absent) |
| Job queue (BullMQ, QStash, Inngest, Vercel Workflow) | **NO** |
| Long-running worker | **NO** |
| Netlify scheduled functions | **NO** (`netlify.toml` is a 3-line redirect stub) |

**`GET /api/cron/discover`** — `runtime='nodejs'`, `maxDuration=300`, `force-dynamic`. Logs one line:
`[cron/discover] sources 3/3 . found 27 . imported 4 . dup 21 . notEvent 2 . unreadable 0 . err 0`

**`GET /api/cron/verify`** — same config. `verifyEvents()`, limit 40/run, least-recently-verified first (`nullsFirst: true`).

### Auth

```ts
// lib/cron/auth.ts
export function isAuthorizedCron(request: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false                      // fail CLOSED
  return request.headers.get('authorization') === `Bearer ${secret}`
}
```
**`CRON_SECRET` is NOT present in `.env.local`.** If also unset in Vercel, **both crons return 401 and nothing runs.** Open operational question. (Comparison is `===`, not constant-time.)

### Concurrency / idempotency

- **No lock, no lease, no advisory lock, no `next_run_at`.** Cron and "Run all now" can overlap.
- **Idempotency is structural:** `importFromUrl()` reads by `normalized_url` and returns any non-`failed` row **without re-reading**; plus `UNIQUE INDEX` + `.upsert({onConflict:'normalized_url'})`. Concurrent runs waste fetches but do not duplicate data.
- Cross-source dedup within a run: a `Set` of handled event URLs.
- Approval idempotency: `approveCandidate()` returns an existing `submission_id`.
- **Known non-atomic window** (`service.ts:429-435`): submission INSERT succeeds, candidate UPDATE fails -> success is returned deliberately to stop a retry duplicating. No cross-table transaction is available via `supabase-js`.
- **Time budgets are the only backpressure** — `report.remainingSources` is returned and **nothing feeds it back in**.

---

## SECTION 9 — DUPLICATE DETECTION

Three independent, non-overlapping mechanisms.

### 9.1 URL dedup (the strong one) — `lib/radar/normalizeUrl.ts`

`normalizeImportUrl()`: validated public http(s), lowercased hostname, fragment dropped, tracking params removed (`utm_*`, `mc_*`, `fbclid`, `gclid`, `dclid`, `gclsrc`, `igshid`, `mkt_tok`, `ref`, `ref_src`, `ref_url`, `source`, `spm`, `_ga`), remaining params sorted, trailing path slash trimmed. Enforced by `UNIQUE INDEX event_import_candidates_normalized_url_key`.

Pasted text has no URL -> `pasteKey()` synthesizes `paste:{slug(title)}|{date}|{slug(venue)}`.

**Only dedups against the same source URL.** Two sites listing the same concert produce two candidates.

### 9.2 Content dedup (advisory only) — `detectDuplicate()`, `lib/lens/resolve.ts:524-548`

- **Requires an exact `reading.date`.** No date -> no check at all.
- **Location key:** `location_slug` (exact `eq`) when the city resolved; else `country` (`ilike`, LIKE metacharacters escaped). No key -> no check.
- **Live:** `events` WHERE `status='published'` AND `date = reading.date` AND location, limit 50, anon client.
- **In-review:** `event_submissions` WHERE `status='pending'` AND same date AND location, limit 50, **service-role, boolean-only** (submission fields never cross into the response).
- **Title:** `titlesMatch()` — tokenize + fold, then **true if one token set is a subset of the other, OR Jaccard >= 0.6**.

| Signal | Used |
|---|---|
| Title | YES — fuzzy (subset OR Jaccard >= 0.6) |
| Date | YES — **exact equality, mandatory** |
| City / location_slug | YES — exact |
| Country | YES — fallback `ilike` |
| Venue | **NO** |
| Organizer | **NO** |
| Source URL | only in 9.1 |
| Slug | **NO** |
| Coordinates / proximity | **NO** |
| Time | **NO** |

**On a hit — nothing blocking.** `duplicate_live` (*"A published AlbaGo event may already cover this."*) and `duplicate_in_review` are **CRITICAL** warning codes, so the candidate is forced to `confidence='low'`, persisted as `duplicate_status` + `duplicate_event_slug`, and shown in the review UI. The admin can still approve. **No automatic merge, no automatic reject, no blocking.**

### 9.3 Where there is NO duplicate detection at all

- **Community wizard:** `submit_event_submission` has zero dedup logic.
- **Queue -> events approval:** `AdminClient.approveSubmission()` performs no duplicate check.
- **`events` itself:** no unique constraint on `(title, date, location_slug)`. The only uniqueness is `slug`, which always carries a random 8-char suffix — so it never collides and therefore never catches a duplicate.
- **Cross-source identity:** no `external_id`, no canonical-URL column on `events`, no fingerprint/hash.

**Verdict: there is no true, authoritative duplicate detection** — only a URL idempotency key and an advisory same-date/same-city/similar-title warning.

### Addendum — documented behaviour differs from implemented behaviour

`docs/master-plan/07-crawl.md:52-54` specifies that the crawler should **drop** content duplicates:
```
classify outcome -------------> duplicate.live      -> skip (already on AlbaGo)
      |                         duplicate.in_review -> skip (already pending)
      |                         !is_event / low conf -> skip (not an event)
```
**Only the third rule was implemented.** `lib/radar/discovery.ts:158-163` drops non-events only; no branch inspects `resolution.duplicate.status`. Two consequences:
1. A source re-listing an already-published event produces a new low-confidence candidate every time it appears at a new URL.
2. `report.skippedDuplicate` counts **only URL-level idempotency hits** — so `dup 21` in the cron log means "21 URLs already imported", not "21 events we already have".

---

## SECTION 10 — PLACES / VENUES

### The place model

Table: `places` (see 2.6). No `venues` table. Route `/places/[slug]`.

### How an event references a place — both, and usually neither

`events` carries **two parallel location representations**:

1. **Linked venue:** `events.place_id -> places.id` (nullable, ON DELETE SET NULL). The detail page joins it as `EventRecord.places = { id, name, address, lat, lng, website_url }`.
2. **Denormalized free text + own coordinates:** `events.address`, `address_hint`, **`events.lat`, `events.lng`**, plus `location_slug` / `country` / `region`.

**Coordinates live on BOTH.** Resolution order on the detail page (`app/events/[slug]/page.tsx:541-542`):
```ts
const directionsLat = venue?.lat ?? event.lat ?? null
const directionsLng = venue?.lng ?? event.lng ?? null
```
The map (`components/map/MapView.tsx:229-237`) runs **two independent layers**: a `places` layer and a **direct-pin event layer** — any published event with its own `lat`/`lng`, regardless of `place_id`.

**Can an event exist without a place? Yes, and it is the normal case.** Every intake path sets `place_id: null`:
- `lib/crawl/toSubmission.ts:99` — `place_id: null` with the comment *"venue linking is an approval-time act, the same decision Lens made"*
- `lib/wizardSubmit.ts:80` (community), `:267` (organizer), `:452` (admin) — all `place_id: null`
- `AdminClient.approveSubmission()` copies `s.place_id ?? null`, which is always null

**The "approval-time act" of venue linking is NOT IMPLEMENTED anywhere in the UI.** No venue picker in the queue, none in the Radar review UI, none in the wizard. The wizard's `venue_name` is free text stored only on `event_submissions.venue_name` — **`events` has no `venue_name` column at all.**

Practical consequence: effectively **all new events have `place_id = null`** and depend entirely on `events.lat`/`lng` from the wizard map picker or Lens geocoding.

### How places are created

**Only manually via Supabase Studio.** `places` has a public SELECT policy and **no write policies**. There is no admin places UI, no `/admin/places` route, and no `.from('places').insert(...)` anywhere in the repo.

### Geocoding

| | |
|---|---|
| Provider | **OpenStreetMap Nominatim** — free, no key |
| Server proxy | `app/api/geocode/route.ts` — forward (`?q=`) + reverse (`?reverse=1&lat=&lng=`), sets `User-Agent: 'AlbaGo/1.0 (contact: ...)'` because browsers cannot set UA |
| Lens-side | `lib/lens/resolve.ts:297-401` — its own direct calls with `User-Agent: 'AlbaGo-Lens/1.0'`, 1 req/s global spacing, 2 s timeout |
| Wizard | `components/event-wizard/AddressSearchField.tsx` + `components/location/LocationAutocomplete.tsx` hit `/api/geocode` |
| IP geolocation | `app/api/geo/route.ts` — Vercel edge headers |
| Mapbox | `NEXT_PUBLIC_MAPBOX_TOKEN` is set and `react-map-gl` is a dependency, but the map renders with **MapLibre GL** (`components/map/maplibreAdapter.ts`). Mapbox is **not used for geocoding**. Its actual use is UNCLEAR FROM REPOSITORY |

**Geocode sanity ring:** `GEOCODE_SANITY_RING_KM = 30`. A geocoded address more than 30 km from the resolved city centre (Haversine) is **discarded** — *"unconstrained geocoding of poster addresses produces confident garbage"*. Without a city centre, geocoding is skipped entirely.

### Place matching / fuzzy venue matching — YES, fully implemented

`lib/lens/resolve.ts:119-209`, pure and unit-testable:

- `normalizeVenueTokens(name)` — fold + tokenize, then strip **leading/trailing** noise words only (`club, klub, klubi, bar, bari, pub, lounge, cafe, kafe, kafene, restorant, restaurant, teatri, teater, kinema, cinema, pallati, stadiumi, stadium, arena, disco, disko, the`). If stripping leaves a core under 3 chars ("Club 21" -> "21"), the unstripped tokens are used.
- `venueMatchTier(a, b)` — deterministic tiers, no opaque threshold:
  - **matched** — normalized names equal (rank 3+overlap), OR one token set is a subset of the other AND is distinctive (>=2 tokens, or a single token >=5 chars) (rank 2+overlap)
  - **suggested** — token-set Jaccard >= 0.5
  - **none** otherwise
- `matchVenueCandidates()` — **tie demotion**: if two or more candidates qualify as `matched`, the best is returned as **`suggested`**, because *"two plausible venues means the machine does not actually know."*

Candidate pool: `places` WHERE `status='active'`, scoped to the resolved city's `location_slug`, or country-wide via `ilike` when the city is unknown. **Cap: 500 rows** (`CANDIDATE_CAP`), anon client.

**City matching** handles the Albanian definite/indefinite vowel flip (Tirana/Tirane, Vlora/Vlore, Durresi/Durres) via `matchCityLocal()` + `stemCityName()` stripping trailing `[aei]`/`i`.

**Resolution stages** (`resolvePoster`, `resolve.ts:572-637`):
```
A1  local city match (exact folded / Albanian stem)
B   venue candidates scoped to that city, or country-wide
A2  inherit the city from a strong venue match
A3  remote city fallback via Nominatim
C   geocode the address — ONLY if no venue auto-linked AND a city center exists
D   duplicate detection
    (C and D run in parallel via Promise.allSettled; both self-degrade)
```

### The two warnings

Both come from **`lib/radar/assess.ts` -> `assessReading()`**, rendered in `/admin/event-radar/[id]`.

**"Venue name could not be linked to a known place."** — `assess.ts:147-154`:
```ts
const venue = resolution?.venue
if (!isEmpty(reading.venue_name)) {
  if (!venue || venue.status === 'none') {
    add('venue_unmatched', 'Venue name could not be linked to a known place.')
  } else if (venue.status === 'suggested') {
    add('venue_suggested', 'Venue is a suggested match, not a confirmed one — verify it.')
  }
}
```
Root cause: the AI read a venue name, but `matchVenueCandidates()` returned `status:'none'` — no `places` row in that city/country scored `matched` or `suggested`. Because places can only be created in Supabase Studio and the catalog is small, **this fires on essentially every crawled event.**

**"Coordinates could not be verified — the map pin may be missing."** — `assess.ts:73-81` + `:156-158`:
```ts
function hasVerifiedCoords(resolution) {
  if (resolution.venue.status === 'matched' && resolution.venue.place) {
    const p = resolution.venue.place
    if (p.lat != null && p.lng != null) return true
  }
  return resolution.geocode.status === 'address'
}
...
if (!hasVerifiedCoords(resolution ?? null)) {
  add('coords_unverified', 'Coordinates could not be verified — the map pin may be missing.')
}
```
Root cause: coordinates count as verified **only** from (a) a `matched` place that itself has non-null lat/lng, or (b) a Nominatim address geocode that passed the 30 km ring. Since venue matching almost always fails, and geocoding needs both a non-empty `reading.address` and a resolved city with a `center`, this also fires on most imports.

**The downstream effect is real:** `resolvedCoords()` (`toSubmission.ts:53-64`) returns `{lat:null, lng:null}` unless one condition holds. So the submission — and the published event — has **no coordinates**, which means it never appears on `/map` (the query filters `.not('lat','is',null)`), `upsert_city_from_event` is skipped at approval (requires lat+lng), and the detail page has no map block or directions CTA.

Both codes are in `SOFTENING_CODES`, so they cap confidence at `medium` but never block approval.

---

## SECTION 11 — EVENT IMAGES

### Storage

**Supabase Storage**, three public buckets:

| Bucket | Written by | Contents |
|---|---|---|
| `event-covers` | `hooks/useImageUpload.ts` (browser, authed user) | user-uploaded event photos, path `{user.id}/{uuid}.{ext}` |
| `ai-posters` | `app/api/ai-poster/route.ts` (server) | one generated jpg per event slug (`lib/eventArt.ts` `aiPosterUrl()`) |
| `avatars` | settings avatar form | profile / organizer avatars |

Migrations: `phase-13-storage.sql`, `phase-28-ai-posters-bucket.sql`, `phase-34-avatars.sql`.

### Database fields

```
events.banner_url        text     — the cover; kept in lockstep with gallery_urls[1] by trigger
events.gallery_urls      text[]   NOT NULL DEFAULT '{}'  — unlimited (5-cap removed in 1c6247c)
events.cover_in_gallery  boolean  NOT NULL DEFAULT true  — Phase 35
events.content_sections  jsonb    NOT NULL DEFAULT '[]'  — [{title, body, urls[]}]
places.image_url / cover_image_url / images text[]
```
Mirrored on `event_submissions`. **No `event_images` table** — images are string arrays.

**Multiple images: YES.** Unlimited gallery + unlimited named photo sections, each with its own URL set.

### The banner/gallery trigger (`phase-18-event-gallery.sql`)

```sql
create trigger events_sync_banner_from_gallery
  before insert or update of gallery_urls on public.events
  for each row execute function public._sync_event_banner_from_gallery();
-- forces: new.banner_url := new.gallery_urls[1] when the array is non-empty
```
This makes `banner_url` **non-independently-settable** whenever `gallery_urls` is written in the same statement.

### Upload UI

`components/event-wizard/steps/MediaStep.tsx` (drag-to-reorder via `@dnd-kit`) and `MediaSectionsEditor.tsx`, both via `useImageUpload('event-covers')`:
- allowed: `image/jpeg`, `image/png`, `image/webp`, `image/avif`
- max **8 MB**
- requires a signed-in user; path namespaced by `user.id`
- returns `supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl`

### Transformations

**None server-side.** No Supabase image transforms, no `sharp`, no resize pipeline. The only optimization is `next/image`, and `next.config.ts` whitelists exactly one remote host:
```ts
images: { remotePatterns: [{ protocol:'https', hostname:'*.supabase.co',
                             pathname:'/storage/v1/object/public/**' }] }
```

### Fallbacks

`EventCard` falls back to a per-category CSS gradient + Lucide icon (`CATEGORY_GRADIENTS` / `CATEGORY_ICONS`). The homepage poster wall falls back to `aiPosterUrl(slug)`.

### Does the crawler fetch images?

**It identifies them; it does NOT download them.**

| Source | Extracted |
|---|---|
| `og:image` (+ `:url`, `:secure_url`) | YES |
| `twitter:image` / `twitter:image:src` | YES |
| `link rel="image_src"` | YES |
| schema.org `image` field | **NO** — reaches the model only as raw JSON-LD text, and `PosterReading` has no image field, so it is discarded |
| Article / content `<img>` | YES — `firstContentImage()` heuristics |

### What happens with discovered images

```
fetchUrlContent()  ->  imageUrl (absolute remote URL)
   |
event_import_candidates.image_url          (reviewable link, shown in the admin UI)
   |  approve
crawlReadingToSubmission()  ->  banner_url = imageUrl, gallery_urls = [imageUrl]
   |
event_submissions.banner_url / .gallery_urls
   |  queue approve
events.banner_url / events.gallery_urls    <- still the third-party URL
```
**Never downloaded, never re-hosted, never validated beyond the protocol check.** Because these hosts are not in `remotePatterns`, they cannot go through `next/image`, and they break silently when the source rotates or hotlink-protects the file.

---

## SECTION 12 — ADMIN EVENT CREATION FORM

Route **`/admin/events/new`** -> `AdminCreateEventClient.tsx` -> **`<EventCreationWizard mode="admin" />`**.
The **same wizard component** serves `/submit-event` (community), `/organizer/create` (organizer), `/admin/events/[id]/edit`, and `/organizer/events/[id]` — only `mode` and the `onSubmit` handler differ (Phase 36 unified edit into it).

Submit handler: `submitAdminEvent()` (`lib/wizardSubmit.ts:422`) -> **direct `events` INSERT with `status:'published'`** — no moderation. A banner above the wizard links to `/scan` (Lens poster scanner), which prefills the same localStorage draft.

Draft persistence: `localStorage` key `albago:event-draft:v1`, autosaved on change, merged over `defaultEventDraft` on load.

### Steps and every field

`STEPS` array, `EventCreationWizard.tsx:59-181`. `tickets` is skipped for civic events and for `mode='community'`.

**Step 1 — Type + Category** (`EventTypeStep.tsx` + `CategoryStep.tsx`)

| Field | Req. | Validation |
|---|---|---|
| `event_type` — `'event'` or `'protest'` | **required** | "Pick an event type." |
| `category` — nightlife/music/sports/culture/food/civic | **required** unless protest | "Pick a category." (protest auto-sets `civic`) |
| `is_online` (boolean) | optional | — |

**Step 2 — Basics** (`BasicsStep.tsx`)

| Field | Req. | Validation |
|---|---|---|
| `title` | **required** | non-empty, >=3 chars |
| `description` | **required** | non-empty, **>=20 chars** |
| `tags` (string[]) | optional | lowercased, deduped on add |
| `language` (en/sq/de/es/it/fr) | optional | default `'en'` |

**Step 3 — When** (`WhenStep.tsx`)

| Field | Req. | Validation |
|---|---|---|
| `date` (YYYY-MM-DD) | **required** | must parse; **must not be in the past** |
| `end_date` | optional | if set, must be **strictly after** `date` |
| **`time` (HH:MM)** | **OPTIONAL** | **none** — has a clear (x) button |
| `end_time` (HH:MM) | optional | opt-in ("Add end time"); `end_time <= time` means overnight (surfaced to the user) |
| `timezone` (IANA) | optional | auto-detected via `Intl.DateTimeFormat().resolvedOptions().timeZone`, default `Europe/Tirane` |
| `recurrence` none/daily/weekly | optional | — |
| `recurrence_until` | optional | — |
| `recurrence_days_of_week` int[] | optional | — |
| `recurrence_exceptions` date[] | optional | — |

Schedule-type selector: **single** (`recurrence:'none'`, no end_date), **multi** (`recurrence:'none'` + `end_date`), **repeat** (`recurrence` set). Mutually exclusive in the UI.

**Step 4 — Where** (`WhereStep.tsx` + `AddressSearchField.tsx`)

| Field | Req. | Validation |
|---|---|---|
| `online_url` | **required if `is_online`** | must parse as a `URL` |
| `lat` / `lng` | **required if not online** | "Pick a location on the map." |
| `location_slug` | **required if not online** | same message |
| `country`, `region`, `city` | optional | from the geocoder |
| `address` | optional | Nominatim formatted address |
| `address_hint` | optional | free landmark text |
| `venue_name` | optional | **free text — never becomes `place_id`** |

**Step 5 — Media** (`MediaStep.tsx`)

| Field | Req. | Validation |
|---|---|---|
| `gallery_urls` string[] | **optional** (`validate: () => null`) | JPG/PNG/WebP/AVIF, <=8 MB each, drag-to-reorder, first = cover, unlimited |
| `cover_in_gallery` boolean | optional | default true |
| `content_sections` `[{title, body, urls[]}]` | optional | title <=120, body <=2000, empty sections dropped |

**Step 6 — Tickets** (`TicketsStep.tsx`) — organizer/admin only, skipped for civic

| Field | Req. | Validation |
|---|---|---|
| `ticket_tiers` (null = no tickets) | optional | if an array: >=1 tier; each needs a name; `capacity` integer 1-100 000; `maxPerOrder` integer 1-10; `MAX_TICKET_TIERS = 5` |

**Step 7 — Organizer** (`OrganizerStep.tsx`)

| Field | Req. | Validation |
|---|---|---|
| `organizer_name` | **required** | non-empty |
| `organizer_contact` (email) | **required** | `^[^\s@]+@[^\s@]+\.[^\s@]+$` |
| `organizer_phone` | optional | — |
| `organizer_website` | optional | must start `http(s)://` if present |
| `organizer_socials` {instagram, facebook, tiktok, twitter} | optional | — |

**Step 8 — Review** (`ReviewStep.tsx`) — `validate: () => null`, renders a full preview.

**Ungrouped fields with NO wizard step** (on `EventDraft`, set only by Lens/civic paths): `price`, `featured_movement_slug`, `telegram_link`, `whatsapp_link`, `safety_notes`, `expected_attendees`, `title_i18n`, `description_i18n`.

**Fields on `events` with NO wizard input at all:** `ticket_url`, `ticket_provider`, `price_from_cents`, `price_currency`, `ticket_sales_status`, `door_tickets`, `age_restriction`, `official_source_url`, `last_verified_at`, `listing_status`, `doors_time`, `practical_info`, `highlight`, `place_id`.

### UX flow

Linear stepper with a computed `firstInvalidIndex` — you may jump to any step whose predecessors all validate. Errors render inline. On submit: `submitting` state; failure -> `SubmitErrorModal`; success -> `AdminCreateEventClient` shows an "Event is live" panel (View live page / Create another / Back to events).

---

## SECTION 13 — SUBMISSION REVIEW UI

**Two distinct review surfaces.**

### 13.1 `/admin/queue` — the moderation queue (`app/admin/AdminClient.tsx`, 1762 lines)

A **unified table** merging `event_submissions` and `events` into one `UnifiedRow[]` (`mapSubmission()` / `mapEvent()`), sorted by `created_at` desc, both fetched `.limit(500)`.

Filters: **Source tabs** (All / Submissions / Events / Organizer events), **Status tabs** (All / Pending / Published / Draft / Rejected / Archived), a **civic-only** toggle, and free-text search over title+location+country+movement+category. Linear-style multi-select, expandable detail rows, keyboard cursor, bulk approve/reject with a progress counter.

| Capability | For a **submission** | For an **event** |
|---|---|---|
| Title edit | NO | YES via `/admin/events/[id]/edit` (the wizard) |
| Date / time / venue / address / city / country edit | NO | YES same |
| Price / organizer / organizer website / description edit | NO | YES same |
| Category / tags edit | NO | YES same |
| Civic checkbox | NO (read-only display) | YES in the wizard |
| Warnings / missing-field list | **NOT IMPLEMENTED here** | NOT IMPLEMENTED |
| Save edits | **NO in-queue editing at all** | n/a (the wizard saves) |
| Approve | YES `approveSubmission()` | YES `patchEventStatus(..., 'published')` |
| Reject (+ note) | YES `rejectSubmission()` | YES `admin_reject_event` RPC (organizer) / `admin_update_event` (other) |
| Retry extraction | **NOT IMPLEMENTED** | NOT IMPLEMENTED |
| Delete | YES hard DELETE + `window.confirm` | YES hard DELETE + `window.confirm` |
| Preview | YES `EventPagePreview` modal | YES |
| Unpublish / Archive / Restore | — | YES |
| Repost | — | YES `AdminRepostModal` (clones into a fresh draft with a blank schedule) |
| Poster provenance | YES — real account email via `rpc('admin_user_emails')` + "Shown publicly as ..." | YES |

**Confirmed: submissions cannot be edited before approval.** The action block (`AdminClient.tsx:1685`) gates every edit control behind `row.source === 'event'`; for a non-pending submission it renders only *"Already published as an event."* / *"Awaiting resubmission."*

**Save semantics:** every action is an **immediate DB write** followed by `fetchAll()`. No dirty state, no Save button.

### 13.2 `/admin/event-radar/[id]` — the candidate review UI (`CandidateReviewClient.tsx`)

Where crawler/import output is actually reviewed and edited.

**Editable fields** (`TEXT_FIELDS`, line 45; server whitelist mirrored in `app/api/admin/event-radar/[id]/route.ts` `STRING_FIELDS`):
`title`, `date` (placeholder `YYYY-MM-DD`), **`time`** (`HH:MM`), `end_time`, `venue_name`, `address`, `city`, `country`, `price`, `organizer_name`, `organizer_website`, `description` (textarea).
Plus **Category** (select, validated against `LENS_CATEGORIES`), **Tags** (comma-separated, <=5 x <=30 chars), **Civic event checkbox**.

**Not editable:** `is_event`, `confidence`, recurrence internals, `image_url`, `language`, `artists`. The server ignores anything outside the whitelist.

**Displayed evidence:** source URL + `source_name`, `parser_version`, the extracted image, import timestamp, confidence badge (high/medium/low), the **warnings list**, the **missing-fields list** with count, and the **duplicate panel** (`duplicate_status` + link to `duplicate_event_slug`).

**"Required before approval" block:** computed live from the **form state** via the shared `missingApprovalFields()`, so client and server can never disagree. Approve is disabled with the label *"Add Title, Event date, Start time first"*; clicking a requirement focuses `#radar-field-{field}`.

**Actions:** `save` (persists the patch and re-runs assessment against the **existing** resolution — text edits do **not** re-resolve), `approve` (**auto-saves first**, `CandidateReviewClient.tsx:166-167`), `reject` (optional note), `retry` (full re-fetch + re-extract + re-resolve), `DELETE`.

**Save semantics:** explicit — edits stay local until Save or Approve.

### 13.3 The list surfaces

- **Event Radar list** (`EventRadarClient.tsx`): filter tabs (`all` / `review` / `failed`, default `review`), real-events-first sort, three intake boxes — paste one URL (`POST /api/admin/event-radar`), Discover from a source page (`POST .../discover`, renders the `DiscoveryReport` counts), paste text (`POST .../import-text`) — and **Clear failed**.
- **Sources** (`SourcesClient.tsx`): textarea bulk-add (one URL per line), enable/disable, delete, **Run all now**, per-source last-run yield.

---

## SECTION 14 — PUBLIC EVENT DISPLAY

Every public surface reads **`events` rows directly**. No view, no materialized view, no occurrence table.

| Surface | File | Query |
|---|---|---|
| Homepage | `app/page.tsx` (SSR seed) + `app/HomeClient.tsx` (7 queries) | `status='published'` + `.or(activeEventsOrFilter())`, per-location `.limit(12)`, ordered `highlight desc, date asc`; plus a global set for counts, a civic set, civic totals, a 40-row poster pool, and a title `ilike` search-suggestion query |
| Events directory | `app/events/page.tsx` (SSR) + `EventsClient.tsx` | `select('*')`, published, `.or(activeEventsOrFilter())`, `.order('date').order('time')`, then `.filter(isEventActive)` in JS |
| Event detail | `app/events/[slug]/page.tsx` | by `slug`, joins `places` and `organizers`; **bypasses `isEventActive`** so past events stay reachable |
| Map | `components/map/MapView.tsx` | two layers — direct-pin events (`.not('lat','is',null).not('lng','is',null)`) and `places` + their events |
| City page | `app/city/[slug]/page.tsx` | by `location_slug` |
| Cities index | `app/cities/page.tsx` | counts per city |
| Protests | `app/protests/page.tsx` | `is_civic = true` |
| Movements | `app/movements/[slug]/page.tsx` | `featured_movement_slug` |
| Place page | `app/places/[slug]/page.tsx` | upcoming events by `place_id` |
| Organizer profile | `app/organizers/[slug]/page.tsx` | by `organizer_id` |
| Similar-events rail | `lib/similarEvents.ts` | scored candidate query |
| Sitemap | `app/sitemap.ts` | all published slugs |
| Studio / share / broadcast / AI poster / AI caption | various | by slug/id |

**62 `.from('events')` call sites across 38 files.**

### Filters — where each one runs

**Wire-level (PostgREST), `lib/eventActive.ts:106`:**
```ts
export function activeEventsOrFilter(today = todayIso()): string {
  const yesterday = addDays(today, -1)
  return `date.gte.${yesterday},end_date.gte.${yesterday},recurrence.in.(daily,weekly)`
}
```
Yesterday, not today, because an overnight 22:00-04:00 event is still live the next morning and PostgREST cannot compare `end_time` to `time`. Per `schema-reference.md:286`: *if `end_date` does not exist, every list query on the site fails.*

**Client/JS-level:**

| Filter | Operates on | Implementation |
|---|---|---|
| **Tonight** | `event.date` | `isToday(event.date)` for one-offs; `hasOccurrenceInRange(event, today, today)` for recurring (`EventsClient.tsx:432-436`) |
| **This weekend** | `event.date` | `isThisWeekend(event.date)` — precomputes the next Fri/Sat/Sun ISO strings in the coming 7 days, array `includes`; recurring uses `hasOccurrenceInRange(weekendFrom, weekendTo)` |
| **Custom date range** | `event.date` | `event.date >= from && event.date <= to`, or `hasOccurrenceInRange` |
| **Category** | `event.category` | client-side `toLowerCase()` equality |
| **City** | `event.location_slug` | server-side `.eq('location_slug', ...)` |
| **Tags** | `event.tags[]` | client-side `some(t => activeTags.has(t))` |
| **Map bounds** | `event.lat` / `lng` | MapLibre viewport; the query is not bounds-filtered — all pins fetched, the map clips |
| **Past-event culling** | `date`, `end_date`, `time`, `end_time`, `recurrence*` | `isEventActive()` |

**Key point for tours: all date filters operate directly on `events.date` (and `end_date` / the recurrence rule) of an event row.** No separate date structure, no occurrence rows, no SQL expansion. Recurring events are expanded **in memory at render time** by `lib/recurrence.ts`.

**Sorting** (`EventsClient.tsx:459+`): for recurring events the effective sort key is `nextOccurrence(e, today) ?? e.date`, converted to an instant by `eventInstantMs()` (timezone-aware via `lib/timezone.ts`).

---

## SECTION 15 — EVENT CARD

**File:** `components/events/EventCard.tsx` (`'use client'`).
Variants: `components/protest/ProtestEventCard.tsx` (civic), `components/map/MapEventCard.tsx` (map sheet), `components/events/SimilarEvents.tsx` (rail).

### How it gets data

Fully **props-driven** — the card does no fetching:
```ts
type EventCardProps = {
  event: PublicEvent        // the DB row
  venueName: string | null  // resolved by the PARENT from a places lookup
  cityLabel: string         // resolved by the PARENT via getLocationBySlug()
  isAuthenticated: boolean
  initialSaved: boolean
}
```
`PublicEvent` (line 24) is a **partial** of the `events` row — 25 fields, several optional so a query that omits them still renders. Real coupling: **every list surface must select the right columns or the card silently degrades** (e.g. omitting `end_date` renders a multi-day festival as a single-day card).

### What it renders

| Element | Source |
|---|---|
| Image | `event.banner_url`; else a `CATEGORY_GRADIENTS[category]` gradient + `CATEGORY_ICONS[category]` |
| Title | `pickLocalized(event.title, event.title_i18n, language)` |
| Date | Calendar tile with a big day number. Recurring -> `nextOccurrence(event)`; one-off -> `event.date`. Multi-day -> a two-day tile |
| Friendly label | "Tonight"/"Tomorrow" as a **chip next to the tile — never replacing the calendar date** |
| Time | `formatEventTimeLabel(event.time)` — strips Postgres seconds; empty when null |
| Venue | the `venueName` prop |
| City | the `cityLabel` prop |
| Category | `categoryLabel(category, t)` + `getCategoryTone()` pill, overlaid on the image |
| Badges | `Repeat` icon + `recurrenceLabel()`; `durationDaysLabel()` chip for multi-day; `highlight`; `is_online`; price — `sold_out` -> "Sold out", else `price_from_cents` (0 -> "Free", else `From EUR X`) **beats** the legacy `price` string |
| Save | `<SaveEventButton size="sm">` — `stopPropagation` + `preventDefault` |
| Share | `<ShareCardButton>` |
| Locale | `useLanguage()` + `languageLocales[language]` for all `toLocaleDateString` calls |

**Click behaviour:** the whole card is a `next/link` to `/events/{slug}` (fixed-height body so cards in a row match). Save and Share are nested interactive elements that cancel navigation.

---

## SECTION 16 — EVENT DETAIL PAGE

**Route:** `app/events/[slug]/page.tsx` — a **server component**, 63 KB, the largest file in the app.

**Slug/ID handling:** looked up by `slug` only. `CURATED_REDIRECTS` maps a few legacy slugs; `notFound()` on a miss. Slugs are permanent by policy and carry a random 8-char suffix. Deliberately **does not** apply `isEventActive` — past events stay reachable and render an "ended" treatment via `getEventLifecycleStatus()`.

**Query:** four `.from('events')` calls — the main row (joining `places(id,name,address,lat,lng,website_url)` and `organizers(id,slug,verification_tier,created_at,bio)`), organizer trust stats, the organizer's upcoming events, and the similar-events seed. Plus `ticket_tiers`, `saved_events`, `profiles(role, studio_access)`.

**Fields displayed:** effectively the whole row — title (localized), description (localized, `LocalizedEventText`), category pill, `DateTile` (single or first->last), `formatTimeRange(time, end_time)`, `doors_time`, `end_date` + "Four-day event", `UpcomingOccurrencesList` for recurring series, price / `price_from_cents` / `ticket_sales_status` / `door_tickets` / `age_restriction`, `tags`, `practical_info` via `PRACTICAL_LABELS` (meeting_point, route, registration, audience, dress_code, accessibility, transport, parking, food_drink, indoor_outdoor, restrictions, cancellation_policy — order = display order), `listing_status` banner, `last_verified_at`, the civic block (`telegram_link`, `whatsapp_link`, `safety_notes`, `expected_attendees`, `featured_movement_slug`), the organizer block, gallery + `content_sections`, and a weather card (`EventWeatherCard`, Open-Meteo, no key).

**Map:** no embedded interactive map. A location block opens Google Maps (`https://www.google.com/maps/search/?api=1&query=...`), preferring the human address and falling back to `lat,lng`; plus `buildMapHref()` / `buildDirectionsHref()` from `lib/eventLinks.ts` and a `MapPickerButton`. Coordinate precedence: `venue?.lat ?? event.lat`.

**Organizer:** avatar/initials, `verification_tier`, joined date, bio, trust stats, socials via `socialHref(platform, value)`, and their other upcoming events.

**Booking link:** `safeExternalUrl(event.ticket_url)` drives the "Get tickets" CTA ("via {ticket_provider}"); `sold_out` suppresses it. For civic events, `official_source_url` becomes the **primary** action ("View official information"). Native free tickets render a `<TierPicker>`.

**Translations:** `pickLocalized()` / `LocalizedEventText` read `title_i18n` / `description_i18n` (en/sq/de/es), falling back to the base column.

**Metadata / SEO:** `generateMetadata()` returns title `{Name} — AlbaGo`, a truncated description, and an OpenGraph block. JSON-LD via `lib/seo/jsonLd.ts` `eventSchema(EventForSchema)` + `jsonLdScript()` (escapes `</script>`), emitting a schema.org `Event` with real multi-day `endDate`, timezone-correct `startDate` (`zonedWallClockToUtcMs`), and `eventStatus` mapped from `getEventLifecycleStatus()` (a completed event maps back to `EventScheduled` with a past start date, since schema.org has no "completed" member).

---

## SECTION 17 — CATEGORIES AND TAGS

### Categories

**A hardcoded TypeScript constant + a free-text `text` DB column. No enum, no table, no join table, no CHECK constraint on `events.category`.**

`components/events/categoryMeta.ts:12`:
```ts
export const CATEGORIES = ['all','nightlife','music','sports','culture','food','civic'] as const
```
Second, near-duplicate list — `lib/ai/posterReader.ts:14`:
```ts
export const LENS_CATEGORIES = ['nightlife','music','sports','culture','food','civic'] as const
```
(identical minus the `'all'` UI sentinel; the AI route validates patches against this one).

Presentation also lives in `categoryMeta.ts`: `CATEGORY_ICONS` (Lucide), `CATEGORY_GRADIENTS` (Tailwind), `getCategoryTone()`, and `categoryLabel(category, t)` which translates via i18n keys `category_{slug}` and **falls back to a capitalized raw value for unknown slugs**.

Fallbacks in code: `'culture'` when the AI returns `''` for a non-civic event, `'civic'` for civic (`toSubmission.ts:74`, `wizardSubmit.ts:64/262/427`, `coalesce(..., 'culture')` in the RPC).

**No `events_category_check` constraint appears anywhere in the seeds** — a typo would be accepted by the DB.

### Tags

**A Postgres `text[]` array column.** `events.tags text[] DEFAULT '{}'`, mirrored on `event_submissions` (Phase 13). No tags table, no join table, no controlled vocabulary, no normalization beyond `.trim().toLowerCase()`.

- AI extraction caps at **5 tags x 30 chars**, lowercased (`coercePosterReading`, and again in the Radar patch coercion)
- Wizard `addTag` lowercases, trims, dedups
- Filtering is client-side only — `event.tags.some(t => activeTags.has(t.trim().toLowerCase()))` (`EventsClient.tsx:449`). Never a SQL array filter.

### Vibe tags

**NOT IMPLEMENTED.** No separate vibe/mood dimension. `places.options text[]` (`['outdoor','smoking','vip']`) is a venue-feature list, not an event vibe. `PosterReading.artists` is extracted but has **no column to land in** — discarded at `crawlReadingToSubmission`.

---

## SECTION 18 — ORGANIZERS

**Both representations exist simultaneously, and they are not connected.**

### The `organizers` table (real identity)

1:1 with `auth.users` — `organizers.id = auth.users.id`, so **one organizer row per account, no organizer without an account**. Fields (`types/organizer.ts`):
```
id uuid PK (= auth.users.id), display_name NOT NULL, slug NOT NULL UNIQUE,
bio, contact_email NOT NULL, website_url, verified boolean NOT NULL DEFAULT false,
verification_tier text ('unverified'|'established'|'verified'), verification_tier_at,
phone, id_document_url, id_review_status ('none'|'pending'|'approved'|'rejected'),
id_review_notes, id_reviewed_at, id_reviewed_by, weekly_event_quota integer,
created_at, updated_at
```
Linked via `events.organizer_id` (nullable, ON DELETE SET NULL). Created atomically by the `create_organizer()` RPC (which also writes `organizer_onboarding_responses`); slug = `slugify(name)-{6 random chars}` with 3 client retries on collision. Public read; owner-or-admin update. **No `is_organizer()` function** — status is "does a row exist for `auth.uid()`" (`lib/organizers.ts` `fetchOrganizer()`). `profiles.role` stays `'user'` for organizers.

### Free-text organizer fields on `events` (display)

```
organizer_name     text   <- the name shown publicly
organizer_contact  text
organizer_phone    text
organizer_website  text
organizer_socials  jsonb  ({instagram, facebook, tiktok, twitter})
```
Mirrored on `event_submissions`. These are what the wizard collects and what the crawler fills. **They are never matched against the `organizers` table.**

**Result:** an admin- or community-created event shows "By Some Promoter" from `organizer_name` while `organizer_id` is NULL — no profile page, no verification badge, no event grouping. Commit `3b9e75c` added `events.submitted_by_user_id` + the `admin_user_emails` RPC precisely so admins can see *"Shown publicly as 'X' / real account: y@z"* in the queue.

**Can multiple organizers belong to one event? No.** One nullable `organizer_id`, one `organizer_name` string. No `event_organizers` join table. `schema-reference.md:703` reserves a future `team_id` / `organizer_members` — NOT IMPLEMENTED.

---

## SECTION 19 — REGISTRATION / TICKETING / PRICE

### Fields on `events`

```
price               text     nullable   — free display string ("Free", "500 leke", "EUR 10"). NEVER parsed.
price_from_cents    integer  nullable   — minor units; 0 = free. CHECK >= 0
price_currency      char(3)  NOT NULL   DEFAULT 'EUR'
ticket_url          text     nullable   — external checkout/info link -> "Get tickets" CTA
ticket_provider     text     nullable   — display name ("via Eventbrite")
ticket_sales_status text     nullable   CHECK IN ('on_sale','sold_out')
door_tickets        boolean  NOT NULL   DEFAULT false — "Tickets at the door"
age_restriction     text     nullable   — "18+"
official_source_url text     nullable   — the primary CTA for civic events
```
**Precedence:** `sold_out` -> suppress CTA, show "Sold out"; else `price_from_cents` (0 -> "Free", else `From {formatPriceFrom(cents, currency)}`); else the legacy `price` string.

**Constraint:** `events_civic_no_tickets` — a civic event may not carry `ticket_url` or a positive `price_from_cents` (the "civic free forever" pledge).

### Native free ticketing (Phase 33) — `docs/seeds/phase-33-ticketing.sql`

`ticket_tiers` (event_id, name, description, capacity, max_per_order, sales_start, sales_end, sort_order, status in active/paused/archived) -> `orders` -> `order_items` -> `tickets` (HMAC QR via `TICKET_QR_SECRET`) -> `ticket_scans`. Wizard tiers are synced by `saveDraftTiers()` (`lib/wizardSubmit.ts:203`) — **fail-soft**, because the event row already exists and throwing would make a retry duplicate it. Max 5 tiers.

### Registration / reservation URL

**NOT IMPLEMENTED as dedicated columns.** No `registration_url`, no `reservation_url`. `practical_info` jsonb recognizes a `registration` key, but it is **free prose in the "Good to know" grid** — not a link field.

### Free event

**No boolean.** "Free" is expressed three inconsistent ways: `price` = the source's own wording ("Free entry", "Falas"), or `price_from_cents = 0`, or nothing at all. `EventCard` treats only `price_from_cents === 0` as canonically Free.

### Can different dates of the same logical event have different prices / currencies / ticket links?

**No — the question is unrepresentable.** There is no "logical event with multiple dates". Three tour dates are three independent rows, so each *happens* to carry its own `price`, `price_currency`, `ticket_url` — but nothing binds them, nothing shows them together, and nothing prevents drift. A `recurrence='weekly'` series is the opposite failure: **one row, one price, one ticket link for every occurrence**, with no per-occurrence override.

---

## SECTION 20 — LOCALIZATION

### UI language

`lib/i18n/config.ts` — **four languages: `en`, `de`, `es`, `sq`.** Default `en`. Locales: `en-GB`, `de-DE`, `es-ES`, `sq-AL`. All UI strings in a single `lib/i18n/translations.ts` dictionary, served by `lib/i18n/LanguageProvider.tsx` (`useLanguage()` -> `{ language, t }`, persisted client-side).

**Three different language lists exist and disagree:**
- UI: `en, de, es, sq` (4)
- Event content translation `LANG_KEYS` (`lib/ai/translateEvent.ts:17`): `en, sq, de, es` (4, same set)
- Extraction `LENS_LANGUAGES` (`lib/ai/posterReader.ts:23`): `en, sq, de, es, **it**, **fr**` (6)

An event extracted from an Italian or French page has `language:'it'|'fr'` but there is no UI or translation pack for it.

### Event content storage — JSONB packs on the row

`docs/seeds/phase-31-event-i18n.sql`:
```sql
alter table public.events add column if not exists title_i18n jsonb;
alter table public.events add column if not exists description_i18n jsonb;
-- mirrored on event_submissions
```
Shape: `{"en":"...","sq":"...","de":"...","es":"..."}`. Read by `pickLocalized(base, pack, language)` / `LocalizedEventText`, falling back to the base column when a key is missing.

**Not `_sq`/`_en` columns, and not a translation table.**

**Only `title` and `description` are translatable.** `practical_info`, `content_sections` (title/body), `safety_notes`, `price`, `tags`, `address_hint` are single-language.

### How translations are created

**Automatically, by AI — and only on the Lens path.** `lib/ai/translateEvent.ts` `translateEventText()` makes one Gemini call returning both 4-language packs; `resolveAndTranslate()` (`lib/lens/enrich.ts`) runs it in parallel with resolution and **fails open**.

**The admin cannot create or edit translated event content anywhere.** No per-language field in the wizard or the Radar review UI. Editing *nulls* the packs:
- `updateAdminEvent()` (`lib/wizardSubmit.ts:539-540`) writes `title_i18n: null, description_i18n: null` — *"Manual edits null the LENS-3 translation packs so stale translations can't shadow the new text."*

**The Radar/crawler path produces NO translations at all.** `crawlReadingToSubmission()` (`toSubmission.ts:96-97`) sets both packs to `null` with the comment *"Filled at write-time by CRAWL-3 (translation)"* — **CRAWL-3 is NOT IMPLEMENTED.** Every crawled event is single-language forever.

---

## SECTION 21 — EXISTING AI / LLM INTEGRATION

**Provider: Google Gemini only.** No OpenAI, no Anthropic/Claude, no local models. No embeddings, no vector store, no RAG, no OCR library (vision goes through Gemini natively).

Packages: `ai@^7.0.18` (Vercel AI SDK), `@ai-sdk/google@^4.0.10`.
Model resolver: `lib/ai/textModel.ts` -> `google(process.env.AI_TEXT_MODEL || 'gemini-flash-lite-latest')`.
Env: `GOOGLE_GENERATIVE_AI_API_KEY`, `AI_GATEWAY_API_KEY`, optional `AI_TEXT_MODEL`, optional `AI_POSTER_IMAGE_MODEL`.

### Event-related AI (all of it)

| # | Purpose | File | Entry point | Notes |
|---|---|---|---|---|
| 1 | **Poster photo -> event** | `lib/ai/posterReader.ts` `readPosterImage()` | `POST /api/lens` | Multimodal; also returns bounding-box `regions` for the scan-theatre reveal. `maxOutputTokens:1600` |
| 2 | **URL -> one event** | `lib/ai/urlReader.ts` `readEventFromContent()` | `POST /api/lens/url`, `importFromUrl()`, `verifyEvents()` | The crawler's extractor. `maxOutputTokens:1600` |
| 3 | **URL -> many events** | `lib/ai/urlReader.ts` `readEventListFromContent()` | `readEventListFromUrl()` | `maxOutputTokens:4000`, cap 15 |
| 4 | **Pasted text -> many events** | `lib/ai/urlReader.ts` `readEventListFromText()` | `POST /api/admin/event-radar/import-text` | Cap 25 (`TEXT_MAX_EVENTS`); sidesteps JS-walled sites |
| 5 | **Auto-translate title+description** | `lib/ai/translateEvent.ts` | `resolveAndTranslate()` | 4 languages; Lens paths only |
| 6 | **Share caption writer** | `lib/ai/captionWriter.ts` | `POST /api/ai-caption` | Studio-gated |
| 7 | **Poster art direction** | `lib/ai/posterArtDirection.ts` | `POST /api/ai-poster` | Gemini writes an image *prompt*; the image itself comes from an **external image service** (`AI_POSTER_IMAGE_MODEL`, default `flux`) and is cached in the `ai-posters` bucket |
| 8 | **Prompt reader** | `lib/ai/promptReader.ts` | `POST /api/lens/prompt` | Studio surface |
| — | JSON salvage | `lib/ai/parseModelJson.ts` | shared | Tolerates fences/prose around the JSON |

**Structured output: NOT USED anywhere.** Every call is `generateText()` + prompt-requested JSON + `parseModelJson()` + hand-written coercion. No `generateObject`, no Zod, no tool calling, no JSON-mode/`responseSchema`.

**Access gating:** Lens routes require `hasStudioAccess()` (`profiles.role='admin'` OR `profiles.studio_access=true`) plus a per-IP limiter (`lib/lens/scanLimiter.ts`). Radar/discovery routes require an admin session or `CRON_SECRET`.

**No cost tracking, no token accounting, no per-call telemetry anywhere.**

---

## SECTION 22 — API / SERVER ROUTES

### Event Radar / import

**`POST /api/admin/event-radar`** — `app/api/admin/event-radar/route.ts`
Purpose: import ONE public event URL into a reviewable candidate.
Input `{ url: string }` (<=2048 chars). Output `{ ok, candidateId, status, duplicate }`; 400 invalid_url; 403 forbidden; 500 db.
Auth: `isRequestAdmin()`. `runtime='nodejs'`, `maxDuration=60`, `force-dynamic`.
Calls: `importFromUrl()` -> `readEventFromUrl` -> `resolvePoster` -> `assessReading` -> upsert.

**`POST /api/admin/event-radar/[id]`** — actions on one candidate.
Input `{ action: 'approve'|'reject'|'retry'|'save', note?, patch? }`.
- `approve` -> `approveCandidate()`; **422 with `{blockers}`** when required fields are missing
- `reject` -> `rejectCandidate(note)`
- `retry` -> `retryCandidate()` (full re-read)
- `save` -> `saveCandidateReading(coercePatch(patch))` (whitelisted fields only)
Auth: admin. `maxDuration=60`.

**`DELETE /api/admin/event-radar/[id]`** — `deleteCandidate()`. Admin.

**`POST /api/admin/event-radar/discover`** — `{ sourceUrl }` -> `runDiscovery({sourceUrls:[url], deadlineMs:50_000})` -> `{ ok, report: DiscoveryReport }`. Admin. `maxDuration=60`.

**`POST /api/admin/event-radar/import-text`** — `{ text }` (<=40 000 chars, >=10) -> `importFromText()` -> `{ ok, result: TextImportResult }`. Admin. `maxDuration=60`.

**`POST /api/admin/event-radar/clear-failed`** — no body -> `clearFailedCandidates()` -> `{ ok, deleted }`. Admin.

### Source registry

**`GET /api/admin/sources`** -> `{ ok, sources: CrawlSourceRow[] }`. Admin.
**`POST /api/admin/sources`** -> `{ urls: string[] }` (<=1000, <=2048 each) -> `{ ok, added, duplicates, invalid[] }`. Admin.
**`PATCH /api/admin/sources`** -> `{ id, enabled }` -> `{ ok }`. Admin.
**`DELETE /api/admin/sources`** -> `{ id }` -> `{ ok }`. Admin.
**`POST /api/admin/sources/run`** -> `runRegistryDiscovery({deadlineMs:270_000})` -> `{ ok, report }`. Admin. `maxDuration=300`.

### Cron

**`GET /api/cron/discover`** — auth `Bearer $CRON_SECRET`. `runRegistryDiscovery` -> `{ ok, report }`. `maxDuration=300`.
**`GET /api/cron/verify`** — auth `Bearer $CRON_SECRET`. `verifyEvents` -> `{ ok, report: VerifyReport }`. `maxDuration=300`.

### Lens

**`POST /api/lens`** — multipart `image` file (<=8 MB, jpeg/png/webp) -> reading + regions + resolution + translation. Auth: `hasStudioAccess()` + per-IP limiter. `maxDuration=60`.
**`POST /api/lens/url`** — `{ url }` -> same shape. Same auth.
**`POST /api/lens/prompt`** — studio prompt reader. Same auth.

### Other event-adjacent

**`POST /api/admin/notify-event-published`** — `{ eventId, contactEmail? }` -> Resend email.
**`POST /api/notifications/event-changed`** — saved-event change notification.
**`GET /api/geocode`** — `?q=` forward / `?reverse=1&lat=&lng=` reverse; Nominatim proxy. **Public, unauthenticated.**
**`GET /api/geo`** — Vercel edge-header IP geolocation. Public.
**`POST /api/track`** — service-role writer for `interactions`; whitelisted types, capped lengths, in-memory per-IP rate limit. Public.
**`POST /api/ai-poster`** / **`POST /api/ai-caption`** — studio-gated generation.
**`POST /api/tickets/claim`**, **`GET /api/tickets/[id]/pdf`**, **`POST /api/push/test`**, **`/api/broadcast/*`**.

### Server actions

Only one: `app/volunteer/actions.ts`. Everything else uses route handlers or direct `supabase-js` calls from client components.

### Endpoints that do NOT exist

- **`POST /api/admin/crawl`** — documented in `docs/master-plan/07-crawl.md:94` and `docs/next-session.md`; **removed in commit `f5e9b50`**
- **Event creation API** — NOT IMPLEMENTED. Creation is a direct `supabase.from('events').insert()` from client code, or the `organizer_create_event_v2` RPC
- **Approval API** — NOT IMPLEMENTED. Queue approval is client-side `supabase-js`
- **Place resolution API** — NOT IMPLEMENTED. `resolvePoster` is a server-only library, not an endpoint
- **Image upload API** — NOT IMPLEMENTED. Uploads go browser -> Supabase Storage directly
- **Public events API** — NOT IMPLEMENTED (no `/api/events`)

---

## SECTION 23 — ENVIRONMENT VARIABLES

Names and purposes only.

### Present in `.env.local`

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL — DB, auth, storage (also builds the `ai-posters` public URL) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key — browser + the anon client in `lib/lens/resolve.ts` |
| `NEXT_PUBLIC_MAPBOX_TOKEN` | Mapbox token. The map renders with MapLibre; current use UNCLEAR FROM REPOSITORY |
| `GOOGLE_GENERATIVE_AI_API_KEY` | Gemini key — all extraction, translation, captions, art direction |
| `AI_GATEWAY_API_KEY` | Vercel AI Gateway key |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | Web-push public key |
| `VAPID_PRIVATE_KEY` | Web-push private key |
| `VAPID_SUBJECT` | Web-push subject (mailto:) |
| `TICKET_QR_SECRET` | HMAC master secret for signed ticket QR codes |

### Referenced in code but ABSENT from `.env.local`

| Variable | Purpose | Consequence if unset |
|---|---|---|
| **`CRON_SECRET`** | Bearer token for `/api/cron/discover` + `/api/cron/verify` | **Both crons fail closed with 401 — no automatic discovery or verification.** Must be confirmed in the Vercel project env |
| `SUPABASE_SERVICE_ROLE_KEY` | Service-role client (`lib/supabase/admin.ts`) — Radar, sourceStore, verify, `/api/track` | Every server-side write path degrades or fails. Almost certainly set in Vercel |
| `AI_TEXT_MODEL` | Optional model pin | Falls back to `gemini-flash-lite-latest` |
| `AI_POSTER_IMAGE_MODEL` | Optional image-model override | Falls back to `flux` |
| `NEXT_PUBLIC_SITE_URL` | Canonical origin for JSON-LD / sitemap | Falls back to `https://albago.org` |
| `RESEND_API_KEY` | Transactional email | Email silently disabled |
| `CRAWL_SECRET` | Documented in `07-crawl.md` as an alternate crawl auth | **Dead** — no code reads it since `f5e9b50` |

Meta/Instagram broadcast credentials are read in `lib/social/instagram.ts` / `app/api/broadcast/meta/*` — outside event scope.

---

## SECTION 24 — EXTERNAL DEPENDENCIES

### npm (`package.json`)

| Package | Version | Used for |
|---|---|---|
| `next` | ^16.2.10 | App Router, route handlers, `next/image`, cron target |
| `react` / `react-dom` | 19.2.4 | UI |
| `@supabase/supabase-js` | ^2.105.3 | DB / auth / storage client |
| `@supabase/ssr` | ^0.10.2 | Cookie-based SSR session |
| **`ai`** | **^7.0.18** | Vercel AI SDK — `generateText` for every extraction call |
| **`@ai-sdk/google`** | **^4.0.10** | Gemini provider |
| `maplibre-gl` | ^5.22.0 | The actual map renderer |
| `react-map-gl` | ^8.1.0 | React map bindings |
| `lucide-react` | ^1.7.0 | Icons (incl. category icons) |
| `framer-motion` | ^11.18.2 | Animation (held at 11 deliberately) |
| `@dnd-kit/*` | core/sortable/modifiers/utilities | Drag-to-reorder photo grid |
| `html-to-image` | ^1.11.13 | Share-card capture |
| `qrcode` + `jsqr` | | Ticket QR generation + door-scanner decoding |
| `pdf-lib` + `@pdf-lib/fontkit` | | Ticket PDFs |
| `jszip` | ^3.10.1 | Share-batch export |
| `resend` | ^6.12.4 | Transactional email |
| `web-push` | ^3.6.7 | Web push notifications |
| `@vercel/analytics`, `@vercel/speed-insights` | | Frontend telemetry |
| `tailwindcss` v4 + `@tailwindcss/postcss` | | Styling |
| `typescript` 5, `eslint` 9, `eslint-config-next` | | Tooling |

### Packages notably ABSENT

| Category | Absent |
|---|---|
| **HTML parsing** | no `cheerio`, `jsdom`, `parse5`, `node-html-parser` — **all HTML handling is hand-written regex** |
| **Browser automation** | no `playwright`, `puppeteer`, `@sparticuz/chromium` — **JS-rendered sites are structurally unreachable** |
| **Scraping frameworks** | none |
| **Date handling** | no `date-fns`, `dayjs`, `luxon`, `temporal-polyfill` — hand-rolled ISO-string math |
| **Validation** | **no `zod`, `yup`, `valibot`** — every boundary is hand-written coercion |
| **Job queues** | no `bullmq`, `inngest`, `@upstash/qstash`, `@vercel/workflow` |
| **Image processing** | no `sharp` — no server-side resize/optimize |
| **Testing** | **no `vitest`, `jest`, `playwright/test`, `@testing-library/*`** |
| **Error tracking** | no `@sentry/*` (a Sentry DSN is a pending user-side item) |
| **Feature flags / observability** | none |

### External services

| Service | Used for | Key? |
|---|---|---|
| **Supabase** | Postgres, Auth, RLS, RPC, Storage | yes |
| **Google Gemini** | all extraction/translation/captions | yes |
| **Vercel** | hosting, cron, edge geo headers, analytics | platform |
| **OpenStreetMap Nominatim** | forward + reverse geocoding, remote city resolution | **no key** |
| **Open-Meteo** | event weather forecast (`lib/weather.ts`) | **no key** |
| **Resend** | transactional email | yes |
| Image generation service (`flux` default) | AI poster backdrops | keyless URL API |
| Meta Graph API | Instagram/Facebook broadcast | yes |

---

## SECTION 25 — CURRENT SECURITY MODEL

### The four layers (`docs/schema-reference.md:100`)

```
Frontend validation -> UX only. Never trusted.
Server guard        -> Redirect/403 before render. UX gate, not a security gate.
RPC functions       -> Transactional boundary; enforces state-machine rules.
Row Level Security  -> Database-enforced. The actual enforcer.
```

### Admin authorization

- **Pages:** `app/admin/layout.tsx` — server component; `supabase.auth.getUser()` -> redirect `/sign-in?next=/admin` if anonymous; then `profiles.role !== 'admin'` -> redirect `/`. Covers every `/admin/*` route.
- **API routes:** `lib/admin/apiAuth.ts` `isRequestAdmin()` — **re-checks independently on every route handler**, because *"route handlers are independent entry points... never trust the referring page."* Fails closed on any error.
- **Crons:** `isAuthorizedCron()` — `Bearer $CRON_SECRET`, fails closed when unset.
- **Lens/Studio:** `hasStudioAccess()` — `role='admin'` OR `profiles.studio_access=true`.
- **DB:** `is_admin()` — `SECURITY DEFINER` reading `profiles.role='admin'`, used as the predicate in RLS policies across all tables.

### Who can do what

| Action | Who | Enforced by |
|---|---|---|
| Create event (published) | **admin** (direct INSERT), **organizer** (RPC -> draft) | `events_admin_write` RLS; `events_insert_organizer` RLS |
| Approve submission | **admin** | `submissions_admin_update` + `events_admin_write` |
| Reject submission | **admin** | `submissions_admin_update` |
| Delete submission | **admin** | `submissions_admin_delete` |
| Delete event | **admin** | `events_admin_write` |
| Update event | **admin** (`admins_update_events`, Phase 36) or **owning organizer** (`organizer_update_event` RPC) | RLS + RPC |
| Run crawler | **admin session** or **cron secret** | `isRequestAdmin()` / `isAuthorizedCron()` |
| Manage sources | **admin** | `isRequestAdmin()` + `crawl_sources_admin_all` |
| Review/approve candidates | **admin** | `isRequestAdmin()` + `event_import_candidates_admin_all` |
| Submit an event | **any authenticated user** | `submissions_insert` RLS + RPC rate limit (3/h, 10/day) |
| Create places | **nobody via the app** | no write policies on `places` |

### Server/client boundaries

Two categories of server code:
1. **`'server-only'` + service-role client** (`lib/radar/service.ts`, `discovery.ts`, `verify.ts`, `lib/crawl/sourceStore.ts`) — **bypasses RLS entirely**. Safe only because every caller is behind an admin/cron guard.
2. **Cookie-authenticated server client** (`lib/supabase/server.ts`) — RLS applies as the calling user.

### Risks relevant to an Event Intelligence Engine

1. **The whole approve/publish path is client-side code.** `AdminClient.approveSubmission()` runs in the browser with the admin's JWT, doing a raw `events.insert()`. **No server-side validation, no transaction, no audit record.** An engine that wants to auto-publish, batch-publish, or publish from a job has **no server-side write path to reuse** — it would have to reimplement 35 field mappings that live in a React component.
2. **`events_admin_write` is `FOR ALL`** — a compromised admin session can write and delete arbitrary event rows unbounded.
3. **The submission INSERT + status UPDATE are not atomic.** Under automation firing faster than a human, the partial-failure window becomes a real correctness problem.
4. **`CRON_SECRET` appears unset locally.** If unset in production the crons are dead; if set, the comparison is not constant-time.
5. **`/api/geocode` is fully public and unauthenticated** with no rate limit of its own — an open Nominatim proxy under AlbaGo's User-Agent. AlbaGo's Nominatim reputation is exposed to abuse.
6. **Crawler images are unvalidated third-party URLs** rendered in `<img>`. Not XSS (the URL is attribute-escaped), but it is an uncontrolled outbound request from every visitor's browser and a referrer/tracking leak.
7. **SSRF TOCTOU** — DNS is validated, then `fetch` re-resolves independently.
8. **`robots.txt` `Disallow` is not honoured** — only `Sitemap:` lines are read. For a more aggressive engine this is a compliance and reputation risk.
9. **`event_import_candidates.reading`/`resolution` are unconstrained jsonb** written by service-role code; no DB-layer schema validation.

---

## SECTION 26 — CURRENT OBSERVABILITY

### Logging

**`console.log` / `console.error` only** (Vercel Function logs, ephemeral). No Sentry, no structured logging, no aggregation, no metrics.

| Area | Logging |
|---|---|
| Crawler / discovery | one summary line per cron run: `[cron/discover] sources 3/3 . found 27 . imported 4 . dup 21 . notEvent 2 . unreadable 0 . err 0` |
| Verification | `[cron/verify] checked 40 . verified 33 . dateChanged 1 . flaggedChanged 2 . flaggedMissing 1 . unreadable 3` |
| Extraction | **none** — no log of what was sent, returned, or why coercion dropped a field |
| Radar DB ops | `[radar] upsert failed:`, `[radar] submission insert failed:`, `[radar] candidate approve-link failed (submission created):`, `[radar] clearFailed failed:` |
| Source store | `[sourceStore] list failed / bulk insert failed / toggle failed / delete failed / recordRun failed` |
| Submissions | `logSubmitError(context, error)` — logs code+message server-side, returns a generic sentence to the user |
| Approvals | **none server-side.** `AdminClient` sets a UI `message` string and `console.error`s RPC failures in the browser |
| Resolution / geocoding | **none** — every failure silently swallowed |
| Lens enrichment | `[{prefix}] resolution failed (non-fatal)` / `translation failed (non-fatal)` |

### Persistent execution records

| Concept | Exists? |
|---|---|
| **Research run** | **NOT IMPLEMENTED** |
| **Crawler run** | **NOT IMPLEMENTED** — `DiscoveryReport` is built in memory, returned in the HTTP response, and **discarded**. Nothing is written to a table |
| **Source run** | partial — `crawl_sources.last_run_at` / `last_found_count` / `last_status` is a **1-deep overwrite**. No history, no trend, no per-run rows |
| **Execution history** | **NOT IMPLEMENTED** |
| **Cost** | **NOT IMPLEMENTED** |
| **Token usage** | **NOT IMPLEMENTED** — the AI SDK returns usage; nothing reads it |
| **Failure reason** | partial — per-candidate `event_import_candidates.error` (a human sentence), per-source `last_status`. Not aggregated |
| **Provenance** | partial — `parser_version`, `source_url`, `imported_by`, `decided_by`, `image_url` on the candidate. On the published event only `official_source_url` + `last_verified_at` survive |
| **Field-level confidence** | **NOT IMPLEMENTED** — one candidate-level `high\|medium\|low` |
| **Verification history** | only the latest `last_verified_at`. The `VerifyReport.flags` list (events that changed or went dark) is **returned in the cron HTTP response and thrown away.** Nobody sees it |

### The analytics table

`interactions` (`phase-26-interactions.sql`) logs **user-facing** events (`event_view`, `share_click`, `outbound_click`, `search_query`, `submit_started`, `submit_completed`, ...) with an anonymous `session_id`. It is **not** used for pipeline observability — nothing in the crawler, extractor, or approval path writes to it.

**Bottom line: there is no notion of a run.** After a nightly cron finishes, the only durable trace is (a) new candidate rows and (b) three overwritten columns on each source.

---

## SECTION 27 — CURRENT FAILURE MODES

### CONFIRMED BY CODE / COMMITS

1. **Missing time blocks approval.** `event_submissions.time NOT NULL` vs. every writer sending `null`. Documented verbatim in `lib/radar/approvalValidation.ts:12` — *"trips `time NOT NULL` (the observed production bug)"* — and worked around by `missingApprovalFields()`, `translateSubmissionError()`, the `time_required` warning, and a disabled Approve button. **The schema was never fixed.**
2. **`submitted_by_user_id` NOT NULL broke Radar approval.** Commit `61d40f6` — *"Radar: fix approval failing on submitted_by_user_id + name any missing column."* Fixed by stamping the approving admin.
3. **JS-only / login-walled sites yield nothing.** `docs/next-session.md:48` — *"KNOWN CEILING: JS-rendered pages still yield little from raw fetch (needs a headless renderer later)."* `crawl-sources.sql:61` — *"Most Albanian venue sites are JS/Wix/Facebook and yield nothing to a fetch crawler, so this list is deliberately small."*
4. **Unknown venue — pervasive.** `venue_unmatched`; `places` cannot be created through the app.
5. **Unverified coordinates — pervasive.** `coords_unverified`; downstream `lat/lng = null` means no map pin, no city autoseed, no directions.
6. **Wrong year on year-less dates.** Mitigated by the prompt rule *"assume the next occurrence"*, the `past_date` warning, and the 366-day `MAX_SERIES_SPAN_MS` guard.
7. **Geocoding produces "confident garbage".** `resolve.ts:381` — mitigated by the 30 km sanity ring and by skipping geocode without a city centre.
8. **Nominatim localized country names caused false negatives.** `resolve.ts:346-352` — country-agreement checking was **removed** because *"localized country names ('Shqiperia' not 'Albania')... produced false negatives for valid cities."*
9. **Multi-day festivals mis-modelled as `recurrence='daily'`.** Named in `schema-reference.md:283` as *"the 'Sundance modeled as Daily' bug."*
10. **Missing `end_date` column breaks the entire site.** `schema-reference.md:286` — *"every list query on the site fails."*
11. **Junk nav links imported as events.** Mitigated by `isKeepableEvent()` which **deletes** them during discovery — commit `19156c2` "non-event guard".
12. **Bad HTML / no OG tags.** `firstContentImage()` exists because *"many event/ticket pages (e.g. gowild.al) publish no OG tags at all"* (commit `3dc48f8`).
13. **`getLocationBySlug` used to silently answer "Tirana"** for any unknown slug — *"audit M2"*, fixed in `lib/locations.ts:46-68`.
14. **Model IDs retired without warning.** `gemini-2.5-flash` began 404ing in July 2026; full Flash 503s on free tier. Hence the rolling alias.
15. **Media-save hiccups could duplicate events.** All post-create writes (`saveEventMedia`, `saveSubmissionMedia`, `saveDraftTiers`) are **fail-soft** because *"throwing would make a retry duplicate the event."*
16. **Approve/link partial failure.** `service.ts:429-435` — submission created but candidate not linked; success is returned deliberately to prevent a duplicate.
17. **Supabase seeds drift from the live DB.** `docs/next-session.md:93` + `multiday-end-date.sql:7` (bodies regenerated from live `pg_get_functiondef`).
18. **`$$` dollar-quoting breaks in the Supabase SQL editor.** `crawl-sources.sql:47`, commits `7d56728` / `291daf9`.

### ARCHITECTURAL RISK OBSERVED (not confirmed by an incident)

- **No price extracted** — `price` only produces a `missingFields` note, never blocks. A live event with an empty price field.
- **Duplicate across sources** — two sites listing the same concert produce two candidates and, if both approved, two published events. No merge exists.
- **Stale hotlinked images** — crawler banners 404 when the source rotates the file; nothing detects it.
- **`recurrence` semantics collision** — a `daily` series with `end_date` set is representable and would render inconsistently (`isEventActive` branches on `recurrenceKind` first).
- **`events.time` typed non-null** in `EventRecord` while the column is nullable — a latent formatting risk.
- **Nominatim 1 req/s spacing is per serverless instance** (a module-level timestamp), so N concurrent lambdas each honour their own 1 req/s. Under scaled discovery this will exceed policy and risk a block.
- **The verification loop can never catch a cancellation** — by design it only writes the neutral `updated` flag. A cancelled event stays "live" until a human reads a cron log nobody surfaces.
- **`crawl_sources.last_status` never records `'error'`** — a source that throws every time reports `'empty'`.
- **`remainingSources` is dropped** — a registry larger than the 270 s budget silently never crawls its tail.
- **No `robots.txt` `Disallow` compliance.**
- **Regex HTML parsing** will mis-handle nested/quoted markup edge cases; no parser fallback.

---

## SECTION 28 — REUSABLE COMPONENTS

### Strongly reusable — keep as-is, build on top

| Component | File | Why |
|---|---|---|
| **SSRF guard** | `lib/ssrfGuard.ts` | Correct, thorough, dependency-free, unit-testable. Any new fetcher must go through it |
| **URL normalization** | `lib/radar/normalizeUrl.ts` | Pure, tested, the canonical dedup key |
| **Link discovery** | `lib/crawl/discover.ts` | Pure `extractEventLinks()` + multilingual token set + JSON-LD-first ordering. Reusable behind any fetcher, including a headless one |
| **Sitemap discovery** | `lib/crawl/site.ts` | robots -> sitemap -> index -> homepage ladder, bounded |
| **Venue matching** | `normalizeVenueTokens` / `venueMatchTier` / `matchVenueCandidates` | Deterministic tiers, Albanian noise-word handling, tie-demotion |
| **City matching** | `matchCityLocal` / `stemCityName` | Albanian definite/indefinite vowel handling |
| **Title matching** | `titlesMatch` | Subset-or-Jaccard>=0.6; reused by dedup and verification |
| **Geo sanity ring** | `haversineKm` + `GEOCODE_SANITY_RING_KM` | Stops confident-garbage geocodes |
| **Assessment engine** | `lib/radar/assess.ts` | Pure, explainable, honest-by-design. The right philosophy for an intelligence engine |
| **Approval validation** | `lib/radar/approvalValidation.ts` | Shared client+server source of truth; PG-error translation |
| **Outcome classification** | `lib/radar/discoveryClassify.ts` | Pure, tested, deterministic counts |
| **Recurrence helpers** | `lib/recurrence.ts` | Pure ISO-string math; already the expansion primitive an occurrence model needs |
| **Active/ended rules** | `lib/eventActive.ts`, `lib/eventLifecycle.ts` | The wire filter + JS filter split is correct; lifecycle maps cleanly to schema.org |
| **JSON-LD builders** | `lib/seo/jsonLd.ts` | Timezone-correct, multi-day aware, `</script>`-escaping |
| **Storage upload hook** | `hooks/useImageUpload.ts` | Type/size validation, user-namespaced paths |
| **Admin/cron guards** | `lib/admin/apiAuth.ts`, `lib/cron/auth.ts` | Fail-closed, re-checked per route |
| **Image picking heuristics** | `imageFromTag` / `firstContentImage` | Lazy-load attrs, chrome filtering, size gating — hard-won rules |

### Reusable with refactor

| Component | Why refactor |
|---|---|
| **`PosterReading` contract** | Right idea, wrong shape: no `end_date`, no `ticket_url`, no per-field confidence, no evidence spans, **no multi-occurrence array**. Extend rather than replace — five call sites depend on it |
| **`lib/ai/urlReader.ts`** | Fetching, distilling, and prompting are fused. Split into `fetch -> distill -> extract` so a headless renderer or a deterministic JSON-LD parser can supply `UrlContent` |
| **`lib/radar/service.ts`** | Solid orchestration, hard-wired to one URL -> one candidate. Needs to emit N candidates and record a run |
| **`lib/radar/discovery.ts`** | Sequential, deadline-bounded, no persistence. Needs a run record, a work queue, resumability for `remainingSources` |
| **`event_import_candidates`** | The right *place* for evidence, but flat: one `reading`, one `resolution`, one confidence |
| **`crawl_sources`** | Good bones; missing interval, priority, trust, city/country, `next_run_at`, per-run history |
| **`crawlReadingToSubmission`** | The single mapping shared by crawler + Radar — but hardcodes `place_id: null` and the TBA/Unknown fallback ladder |
| **`AdminClient.approveSubmission`** | The real business logic of publication, trapped in a 130-line React function. **Must move server-side** before anything can publish programmatically |
| **`EventCreationWizard`** | Already mode-driven and reused by 5 surfaces. But one date, one time, one place — multi-occurrence needs a new step, not a new wizard |
| **`resolvePoster`** | Correct staging, but places cannot be created, so Stage B mostly returns `none`. Pair with a place-creation path |

### Likely obsolete eventually

| Component | Why |
|---|---|
| **`lib/crawl/sources.ts`** (`CRAWL_SOURCES` templates) | Superseded by `crawl_sources`. `enabledSources()` always returns `[]` but is still the fallback in `runDiscovery()` |
| **`app/submit-event-v2/page.tsx`** | A one-line redirect to `/submit-event` |
| **`docs/master-plan/07-crawl.md` + the crawl section of `docs/next-session.md`** | Describe removed routes/files |
| **`event_submissions` as the mandatory middle stage** | It is what forces the `time NOT NULL` problem and adds a second human approval to every import. Schema rule #8 froze its shape, which is exactly why `event_import_candidates` had to be invented alongside it |
| **`places.image_url` vs `cover_image_url`** | Documented duplication |
| **`events.price` free-text string** | Superseded by `price_from_cents` + `price_currency` where both exist |
| **`events.banner_url`** | Now trigger-derived from `gallery_urls[1]`; independent meaning is gone |

### Unknown

| Item | Question |
|---|---|
| `NEXT_PUBLIC_MAPBOX_TOKEN` | The map renders with MapLibre. Is Mapbox still used for tiles? |
| `CRON_SECRET` in Vercel | Set or not? Determines whether any automation currently runs |
| Which `docs/seeds/*.sql` have been applied | No migration ledger; seeds are known to drift |
| Live nullability of `event_submissions.contact_email` / `submitted_by_user_id` | Code implies both changed since `schema-reference.md` |
| `places` row count / coverage | Determines whether venue matching is worth anything today |
| `events.city` | `eventRowToDraft` reads `row.city`, but no `events` query selects it and no migration adds it. Probably a residual |

---

## SECTION 29 — TOUR / MULTI-OCCURRENCE GAP ANALYSIS

**Impact analysis only.**

### The shape mismatch

```
CURRENT                                  IMPLIED BY THE REQUIREMENT
events                                   event (identity: title, description,
  id, slug, title, description                  category, tags, organizer,
  category, tags                                media, translations)
  date          <- ONE                       └─ occurrences[]  (many)
  end_date      <- ONE contiguous range           date / end_date
  time          <- ONE                            time / end_time / timezone
  end_time      <- ONE                            place_id / lat / lng / address
  timezone      <- ONE                            location_slug / country / region
  place_id      <- ONE                            price / price_from_cents / currency
  lat / lng     <- ONE                            ticket_url / sales_status
  location_slug <- ONE                            official_source_url / last_verified_at
  country       <- ONE                            listing_status / doors_time
  region        <- ONE                            status (per-stop cancellation)
  price / price_from_cents / currency  <- ONE
  ticket_url / provider / sales_status <- ONE
  official_source_url / last_verified_at <- ONE
  listing_status / doors_time          <- ONE
  recurrence{,_until,_days_of_week,_exceptions}   <- a RULE, not instances
```

The current model conflates **event identity** and **event occurrence** in one row. Every "<- ONE" field above is an occurrence-level fact living on the identity row.

### Every affected component

**1. Database** — `events` must split: identity columns stay, occurrence columns move. `end_date` semantics collide with an occurrence list (a contiguous range is *one* occurrence spanning days, not many). `recurrence*` becomes a *generator* of occurrences rather than a parallel schedule type (today `isEventActive` branches on `recurrenceKind` **first**, so a row can never be both). `saved_events(user_id, event_id)` — does a user save the tour or a stop? `ticket_tiers.event_id` — tiers become per-occurrence, changing `orders`/`tickets`/`ticket_scans`. `volunteer_signups`, `interactions.entity_id`, `organizer_event_reports` all key on `event_id`. The `events_sync_banner_from_gallery` trigger, the `search_vector` trigger, and `events_civic_no_tickets` all assume one row.

**2. Queries — 62 `.from('events')` call sites in 38 files.** Every one that filters or orders by `date`/`time` breaks or changes meaning. Specifically `activeEventsOrFilter()` is a raw PostgREST `.or()` string embedded in ~10 list surfaces; it would have to target the occurrence relation, which PostgREST can only do via an embedded resource or a view.

**3. Event cards** — `EventCard.tsx` (+ `ProtestEventCard`, `MapEventCard`, `SimilarEvents`). One card = one row = one date tile today. Which occurrence does a card represent — the next one? All of them ("3 dates")? The `PublicEvent` prop type changes shape for **every** parent that constructs it.

**4. Event page** — `app/events/[slug]/page.tsx` (63 KB). `DateTile`, `formatTimeRange`, `UpcomingOccurrencesList`, the location block, `directionsLat/Lng`, `googleMapsHref`, the ticket CTA, the weather card (one date + one lat/lng), `PRACTICAL_LABELS`, and `getEventLifecycleStatus` all assume one date and one place. Route question: does `/events/{slug}` show the tour, with stops at `/events/{slug}/{city}`? That changes slug policy — and `schema-reference.md:141` states slugs are **permanent**.

**5. Map** — `MapView.tsx` fetches events with `.not('lat','is',null)`. One tour needs N pins from one identity, each carrying its own date. `MapEventCard` / `MapResultsSheet` assume pin<->event 1:1.

**6. Filters** — Tonight / This weekend / date range / category / city all evaluate `event.date` and `event.location_slug` on the row. With occurrences, a tour matches "this weekend" *in Zurich* but not in Berlin. The result set becomes **occurrences, not events**, changing what a result count means and how duplicates collapse.

**7. Admin** — `AdminClient.tsx` `UnifiedRow` has scalar `date`/`time`. `EventsAdminClient`, `AdminRepostModal` (Repost blanks the schedule — with occurrences, which schedule?), `AdminCommandPalette`, `/admin/events/[id]/edit`.

**8. Submissions** — `event_submissions` is a **frozen shape** (schema rule #8: *"Do not add columns to `event_submissions`"*), with one date/time/place. Either the rule is broken, or imports must bypass it, or a sibling table is created. **This is the single biggest structural blocker in the whole pipeline.**

**9. Crawler / extractor** — `PosterReading` has no occurrence array. `SYSTEM_PROMPT` says *"extract only the ONE main event"*; `SYSTEM_PROMPT_LIST` says *"Do NOT return the same event twice. Merge obvious duplicates (same title + date)"* — which merges nothing across a tour. `crawlReadingToSubmission` returns one flat row. `detectDuplicate` keys on **date + location**, so tour stops never collapse. `assessReading` scores one date. Nothing recognizes "this page describes a tour."

**10. API** — `POST /api/admin/event-radar/[id]` `STRING_FIELDS` whitelist is flat (`date`, `time`, `venue_name`, `city`, `country`, `address`). `coercePatch` needs array handling. `saveCandidateReading` merges a flat partial.

**11. SEO** — `eventSchema` emits one `startDate`/`endDate`/`location`. Schema.org models tours as an `EventSeries` with `subEvent[]` — a different builder. `app/sitemap.ts` emits one URL per event row. Rich-result eligibility changes.

**12. Calendar / lifecycle** — `lib/recurrence.ts` is the closest existing analogue and is already pure, but generates from a *rule*, not stored instances. `isEventActive` returns one boolean per row; with occurrences it becomes "is any occurrence active", and `activeEventsOrFilter()` needs rewriting. `lib/tickets/ics.ts` produces one VEVENT.

**13. Verification loop** — `verifyEvents()` selects `id, slug, title, date, listing_status, official_source_url, last_verified_at`; `decideVerify` compares one title + one date. A tour page listing three dates would trip `date_changed` on two of three stops every night.

**14. Notifications / saved events** — `lib/email/templates/savedEventChanged.ts`, `/api/notifications/event-changed`, and push all reference one date.

**15. Share / poster / broadcast** — `lib/share/*` templates, `/api/ai-poster` (one jpg per slug), `/api/ai-caption`, `app/admin/share-batch` all render one date + one city.

---

## SECTION 30 — MISSING-TIME GAP ANALYSIS

### Why it fails today

**A single DB constraint that no code path can satisfy:**
```
event_submissions.time  ->  NOT NULL
```
(created outside the repo; no migration in `docs/seeds/` adds, drops, or alters it)

**Every writer sends NULL for an unknown time:**

| Writer | Line | Code |
|---|---|---|
| Community wizard | `lib/wizardSubmit.ts:81` | `time: trim(draft.time)` -> `null` when blank |
| Crawler / Radar | `lib/crawl/toSubmission.ts:105` | `time: orNull(reading.time)` -> `null` when the page stated none |
| RPC insert | `phase-31` / `multiday` seeds | `nullif(p_payload->>'time','')::time` -> NULL |

**And no earlier layer requires it:**
- `EventCreationWizard.tsx` step `when` validates only `date` and `end_date`
- `WhenStep.tsx` gives `time` a **clear (x) button** — an explicit "no time" affordance
- `coercePosterReading` returns `''` for any non-`HH:MM` value (correct and honest — but `''` -> `orNull` -> `null`)
- The Gemini prompt is instructed to return `''` when the page states no time (rule 1: *never invent*)

**Result:** `PostgresError 23502 — null value in column "time" of relation "event_submissions" violates not-null constraint`.

### All code paths that assume a time exists

**Database** — `event_submissions.time NOT NULL` is **the only hard blocker**. `events.time` is **nullable**, so publication itself is fine. `submit_event_submission` validates `title` and `date`, **not `time`**; the constraint fires raw.

**Types (all correctly nullable except five)**
- `types/event.ts` `Event.time: string` — **non-null**
- `types/event.ts` `OrganizerEvent.time: string | null` — correct
- `types/eventDraft.ts` `EventDraft.time: string` (form-state empty string, converted at submit) — correct
- `components/events/EventCard.tsx` `PublicEvent.time: string` — **non-null**
- `app/events/[slug]/page.tsx` `EventRecord.time: string` — **non-null**
- `app/admin/AdminClient.tsx` `SubmissionRow.time: string` (matches the constraint), `EventRow.time: string | null` — correct
- `lib/similarEvents.ts` `SimilarEvent.time: string` — **non-null**
- `lib/seo/jsonLd.ts` `EventForSchema.time: string` — **non-null**

Those five are *typing lies* about a nullable column — latent, not currently crashing.

**Validation**
- `lib/radar/approvalValidation.ts` — `REQUIRED_APPROVAL_FIELDS` includes `{field:'time', label:'Start time'}`; `missingApprovalFields()` blocks approval; `canApprove()` returns false; `translateSubmissionError()` maps `23502` on `"time"` to a friendly sentence. **A workaround, not a fix.**
- `lib/radar/assess.ts:113-118` — emits `time_required`: *"Start time was not found in the imported source. It must be entered manually before this candidate can be approved."* In `SOFTENING_CODES` -> caps confidence at `medium`.
- `EventCreationWizard` — **no time validation at all.**

**Admin UI**
- `CandidateReviewClient.tsx` — `time` is in `TEXT_FIELDS` (placeholder `HH:MM`), marked required, in `REQUIRED_KEYS`, drives the disabled-Approve state and focus-the-missing-field behaviour.
- `AdminClient.tsx` queue — no time validation; `approveSubmission` copies `s.time` through blindly.

**Frontend / formatting (all null-safe)**
- `lib/dateFilters.ts:53` `formatEventTimeLabel(time)` -> `if (!time) return ''`
- `app/events/[slug]/page.tsx:307` `formatTimeRange(time, endTime)` handles nulls
- `lib/eventActive.ts` `isOvernight(time, endTime)` -> `!!time && !!endTime && ...`
- `lib/recurrence.ts` `nextOccurrence` takes `time?: string | null`
- `EventCard` renders `formatEventTimeLabel(event.time)` — empty string when null

**Queries**
- `app/events/page.tsx:53` — `.order('time', { ascending: true })` on a nullable column. Postgres sorts NULLs **last** for ASC by default; acceptable but undefined-by-intent.
- `lib/timezone.ts` `eventInstantMs()` / `zonedWallClockToUtcMs()` — used for sorting and JSON-LD `startDate`. Behaviour with a null time is the one place worth verifying before any change.

### Summary

The system already **models** a timeless event correctly at the `events` layer, the frontend layer, and the extraction layer. The **only** thing forbidding it is one NOT NULL constraint on a staging table every import must pass through — and the response so far has been three layers of workaround (`assess` warning -> `approvalValidation` gate -> `translateSubmissionError` fallback) rather than changing the column. Five TypeScript row types would need `time` widened to `string | null` to make the model honest.

---

## SECTION 31 — EXACT CURRENT FILE MAP

```
albago/
├── vercel.json                              2 Vercel Cron jobs: /api/cron/discover 04:00, /api/cron/verify 05:00
├── next.config.ts                           next/image remotePatterns = *.supabase.co ONLY; one legacy redirect
├── package.json                             deps — NO html parser, NO browser automation, NO test runner
│
├── app/
│   ├── page.tsx                             homepage SSR seed (published + activeEventsOrFilter)
│   ├── HomeClient.tsx                       homepage client — 7 events queries
│   ├── sitemap.ts                           all published event slugs
│   │
│   ├── events/
│   │   ├── page.tsx                         /events SSR: select('*') + activeEventsOrFilter + isEventActive
│   │   ├── EventsClient.tsx                 filters (tonight/weekend/range/category/tags), search, sorting
│   │   ├── [slug]/page.tsx                  * event detail (63 KB) — EventRecord, 4 events queries, JSON-LD, SEO
│   │   └── albanian-revolution/             merged campaign page
│   │
│   ├── map/page.tsx                         -> components/map/MapView
│   ├── places/[slug]/page.tsx               venue page + its upcoming events
│   ├── city/[slug]/page.tsx, cities/page.tsx
│   ├── protests/, movements/[slug]/         civic surfaces (is_civic / featured_movement_slug)
│   ├── organizers/, organizers/[slug]/      organizer profiles
│   ├── submit-event/                        community intake; role-routes admins/organizers away
│   ├── submit-event-v2/page.tsx             one-line redirect (obsolete)
│   ├── organizer/create/, organizer/events/[id]/{tickets,door}/
│   ├── scan/ScanClient.tsx                  Lens poster scanner UI
│   │
│   ├── admin/
│   │   ├── layout.tsx                       * THE admin guard for every /admin/* route
│   │   ├── page.tsx                         overview + sparklines
│   │   ├── queue/page.tsx  ->  AdminClient.tsx   * moderation queue (1762 lines); approveSubmission()
│   │   │                                          does the client-side events INSERT
│   │   ├── events/{page,new,[id]/edit}      admin event list / wizard-create / wizard-edit
│   │   ├── events/AdminRepostModal.tsx      clone an event into a fresh draft
│   │   ├── event-radar/
│   │   │   ├── page.tsx + EventRadarClient.tsx   * candidate queue: paste URL / discover / paste text / clear failed
│   │   │   ├── [id]/page.tsx + CandidateReviewClient.tsx  * per-candidate review + edit + approve/reject/retry
│   │   │   └── badges.tsx                   confidence + status pills
│   │   ├── sources/page.tsx + SourcesClient.tsx  * crawl_sources registry UI + "Run all now"
│   │   ├── organizers/, users/, volunteers/, broadcast/, share-batch/
│   │
│   └── api/
│       ├── admin/event-radar/route.ts               POST { url } -> candidate
│       ├── admin/event-radar/[id]/route.ts          POST approve|reject|retry|save; DELETE
│       ├── admin/event-radar/discover/route.ts      POST { sourceUrl } -> DiscoveryReport
│       ├── admin/event-radar/import-text/route.ts   POST { text } -> TextImportResult
│       ├── admin/event-radar/clear-failed/route.ts  POST -> { deleted }
│       ├── admin/sources/route.ts                   GET/POST/PATCH/DELETE the registry
│       ├── admin/sources/run/route.ts               POST "Run all now" (maxDuration 300)
│       ├── admin/notify-event-published/route.ts    Resend email on publish
│       ├── cron/discover/route.ts                   * nightly discovery (CRON_SECRET)
│       ├── cron/verify/route.ts                     * daily verification (CRON_SECRET)
│       ├── lens/route.ts                            POST poster photo -> reading (studio-gated)
│       ├── lens/url/route.ts                        POST url -> reading (studio-gated)
│       ├── geocode/route.ts                         Nominatim proxy (PUBLIC, unauthenticated)
│       ├── geo/route.ts                             Vercel edge IP geo
│       ├── ai-poster/, ai-caption/                  studio generation
│       └── track/route.ts                           interactions writer (service role)
│
├── lib/
│   ├── crawl/
│   │   ├── discover.ts        * extractEventLinks / filterEventUrl / discoverEventLinks — same-host, <=15
│   │   ├── site.ts            * discoverFromSite — robots.txt -> sitemap(-index) -> homepage fallback
│   │   ├── sourceStore.ts     * crawl_sources CRUD (service role, fails soft) + recordRun
│   │   ├── sources.ts         ! dead template registry; enabledSources() always []
│   │   └── toSubmission.ts    * crawlReadingToSubmission — THE reading->event_submissions mapping
│   │
│   ├── radar/
│   │   ├── service.ts         * importFromUrl / importFromText / approve / reject / retry / save / delete
│   │   ├── discovery.ts       * expandSource / runDiscovery / runRegistryDiscovery
│   │   ├── discoveryClassify.ts  pure outcome mapping + isKeepableEvent (conf >= 0.35)
│   │   ├── assess.ts          * assessReading — warnings, missing_fields, high/medium/low
│   │   ├── candidate.ts       EventImportCandidate type + buildCandidateWrite + RADAR_PARSER_VERSION
│   │   ├── approvalValidation.ts * the time/title/date approval gate + PG error translation
│   │   ├── normalizeUrl.ts    * the dedup key
│   │   ├── verify.ts          * verifyEvents — re-read published sources, stamp last_verified_at
│   │   └── verifyDecide.ts    * pure verdict logic (never auto-cancels)
│   │
│   ├── ai/
│   │   ├── posterReader.ts    * PosterReading type, LENS_CATEGORIES, poster prompt, coercePosterReading
│   │   ├── urlReader.ts       * fetchUrlContent (OG/JSON-LD/text/image) + 3 prompts (single/list/text)
│   │   ├── textModel.ts       google(AI_TEXT_MODEL || 'gemini-flash-lite-latest')
│   │   ├── translateEvent.ts  4-language title/description packs
│   │   ├── parseModelJson.ts  tolerant JSON salvage
│   │   ├── studioAccess.ts    role='admin' OR profiles.studio_access
│   │   └── captionWriter.ts, posterArtDirection.ts, promptReader.ts
│   │
│   ├── lens/
│   │   ├── resolve.ts         * resolvePoster — city/venue/geocode/duplicate; venueMatchTier, titlesMatch
│   │   ├── enrich.ts          resolveAndTranslate (parallel, fail-open)
│   │   └── scanLimiter.ts     per-IP limiter for Lens routes
│   │
│   ├── ssrfGuard.ts           * isPublicHttpUrl + safeFetch (DNS + per-hop redirect validation)
│   ├── wizardSubmit.ts        * submitCommunityEvent / submitOrganizerDraft / updateOrganizerDraft /
│   │                            submitAdminEvent / updateAdminEvent / saveDraftTiers / saveEventMedia
│   ├── eventDraftFromRow.ts   events row -> EventDraft (edit + repost)
│   ├── eventActive.ts         * isEventActive + activeEventsOrFilter (~10 surfaces depend on it)
│   ├── eventLifecycle.ts      EventScheduled/Completed/Cancelled/Postponed + schema.org mapping
│   ├── recurrence.ts          * pure ISO date math: nextOccurrence, hasOccurrenceInRange, isOvernight
│   ├── dateFilters.ts         isToday / isThisWeekend / formatEventDateLabel / formatEventTimeLabel
│   ├── similarEvents.ts       scored "you might also like" rail
│   ├── locations.ts           4 hardcoded cities + fetchLocations() from `cities`
│   ├── timezone.ts            zonedWallClockToUtcMs, getEventTimezone, eventInstantMs
│   ├── ticketDisplay.ts       formatPriceFrom, safeExternalUrl
│   ├── eventArt.ts            aiPosterUrl
│   ├── eventLinks.ts          buildMapHref / buildDirectionsHref
│   ├── organizers.ts          fetchOrganizer / createOrganizer (create_organizer RPC + slug retry)
│   ├── mapSearch.ts           foldText (shared accent/case fold for venue + city matching)
│   ├── seo/jsonLd.ts          eventSchema / EventForSchema / jsonLdScript
│   ├── admin/apiAuth.ts       isRequestAdmin / currentUserId
│   ├── cron/auth.ts           isAuthorizedCron (fails closed without CRON_SECRET)
│   └── supabase/{admin,browser,server,client,middleware}.ts
│
├── components/
│   ├── event-wizard/
│   │   ├── EventCreationWizard.tsx      * THE shared wizard — STEPS[] + per-step validate()
│   │   ├── AddressSearchField.tsx       Nominatim address autocomplete -> lat/lng/location_slug
│   │   ├── SubmitErrorModal.tsx
│   │   └── steps/{EventTypeStep, CategoryStep, BasicsStep, WhenStep, WhereStep,
│   │              MediaStep, MediaSectionsEditor, TicketsStep, OrganizerStep, ReviewStep}.tsx
│   ├── events/
│   │   ├── EventCard.tsx               * PublicEvent type + card rendering
│   │   ├── categoryMeta.ts             * CATEGORIES / CATEGORY_ICONS / CATEGORY_GRADIENTS / categoryLabel
│   │   ├── EventsFilterBar.tsx, MiniCalendar.tsx, SimilarEvents.tsx
│   │   ├── LocalizedEventText.tsx      pickLocalized(base, i18n pack, language)
│   │   ├── EventPagePreview.tsx        the admin queue's preview modal
│   │   ├── EventSections.tsx           Phase-35 named photo bands
│   │   └── EventWeatherCard/Panel.tsx, TierPicker.tsx, PhotoLightbox.tsx
│   ├── map/{MapView, maplibreAdapter, MapEventCard, MapResultsSheet, MapSearch, map.types}.tsx
│   ├── admin/{AdminRail, AdminTopBar, AdminCommandPalette}.tsx
│   ├── protest/{ProtestEventCard, ProtestMap, SafetyPanel, ProtestWeatherMeta}.tsx
│   ├── share/  templates + ShareEventButton/ShareCardButton/ShareModal
│   └── EventGallery.tsx, SaveEventButton.tsx, ReportEventButton.tsx, MapPickerButton.tsx
│
├── hooks/
│   ├── useImageUpload.ts       * Supabase Storage upload (8 MB, jpeg/png/webp/avif, user-namespaced)
│   └── useEventForecast.ts, useHydrated.ts
│
├── types/
│   ├── event.ts                Event, CivicEventType, EventStatus, EventOrigin, OrganizerEvent
│   ├── eventDraft.ts           * EventDraft + MediaSection + DraftTicketTier + useEventDraft
│   ├── organizer.ts            Organizer, VerificationTier, IdReviewStatus
│   ├── place.ts                Place
│   └── backend.ts              BackendUser etc.
│
├── scripts/
│   ├── radar-test.mjs          * the ONLY automated test (338 lines)
│   ├── radar-register.mjs + _radar-alias-loader.mjs   '@/...' alias hook for Node
│   └── tix-concurrency-test.mjs, tix-qrtoken-test.mjs
│
└── docs/
    ├── schema-reference.md              v1.1, dated 2026-05-14 — ! STALE in several places
    ├── platform-architecture.md         the RLS/RPC/guard layering rules
    ├── listing-quality-standard.md      editorial definition of a complete listing
    ├── radar-phase-1-plan.md            the RADAR-1 spec the code implements
    ├── master-plan/07-crawl.md          ! describes /api/admin/crawl — REMOVED in f5e9b50
    ├── next-session.md                  ! crawl section describes removed files
    ├── product-bible/ (15 docs)         strategy source of truth
    └── seeds/*.sql                      44 additive migrations; NO base-table DDL, NO applied-ledger
```

---

## SECTION 32 — CURRENT EVENT PIPELINE WALKTHROUGH

Concrete trace of `https://example.com/event` entering AlbaGo today.

**Step 0 — Trigger.** Either the URL is a row in `crawl_sources` with `enabled=true` and Vercel Cron fires `GET /api/cron/discover` at 04:00 UTC with `Authorization: Bearer $CRON_SECRET`; or an admin pastes it into `/admin/event-radar` (`POST /api/admin/event-radar { url }`, which skips to Step 4).

**Step 1 — Expand the source.** `expandSource(url)`:
- `discoverEventLinks(url)` -> `safeFetch` (8 s, browser UA, manual redirects) -> HTML truncated to 800 KB -> `extractEventLinks()` scans JSON-LD `Event`/`ItemList` `"url"` values first, then `<a href>`+text, keeping only same-host, non-social, non-nav URLs carrying an event token / date / anchor signal. Capped at 15.
- If `[]` -> `discoverFromSite()` reads `/robots.txt` for `Sitemap:` lines, else tries the three conventional sitemap paths; follows <=6 child sitemaps preferring event-ish names; filters every `<loc>`.
- If both `[]` -> `discovery.ts:138` treats the input URL **as a single event page itself**.

Suppose nothing is found -> `eventUrls = ['https://example.com/event']`. `report.sourcesProcessed++`, `report.eventUrlsFound++`.

**Step 2 — SSRF-guarded fetch.** `importFromUrl()` -> `normalizeImportUrl()` lowercases the host, drops the fragment, strips tracking params, sorts the rest, trims the trailing slash. Not a public http(s) URL -> `{ok:false, code:'invalid_url'}`, `outcome:'error'`, nothing stored.

**Step 3 — Idempotency check.** `SELECT * FROM event_import_candidates WHERE normalized_url = ...`. Row exists and `status !== 'failed'` -> **return it unchanged**, `outcome:'duplicate'`, `report.skippedDuplicate++`. Nothing re-fetched. (This is why a nightly re-run of the same registry is cheap.)

**Step 4 — Read the page.** `readEventFromUrl(normalized, todayIso)` -> `fetchUrlContent()`:
- `safeFetch` validates DNS (every resolved A/AAAA must be public), fetches with `redirect:'manual'`, re-validates each of <=4 hops
- content-type must contain `html`/`xml`, else `null`
- body sliced to 600 KB; extracts `og:title`, `og:description`, `<title>`, up to 3 event-ish JSON-LD blocks (4000 chars each), the tag-stripped visible text, and the best image
- guard: `!ogTitle && !ogDesc && !jsonLd && body.length < 40` -> `null`

**Step 4a — Unreadable branch.** `null` (JS-only app, login wall, 403, timeout) -> `upsert({status:'failed', error:'The page could not be read — it may be login-walled, JavaScript-only, or not reachable. Try pasting the event text into the Queue instead.', parser_version:'radar-1'})`. Classified `outcome:'unreadable'`. Visible under the **Failed** tab; retryable; bulk-clearable. **END (failure).**

**Step 5 — Extract.** `readEventFromContent()` builds one prompt: `Reference date (today): 2026-08-12.` + `Source URL / OG title / OG description / Page title / Structured data (JSON-LD) / Page text`, sliced to 12 000 chars. Sent via `generateText({ model: google('gemini-flash-lite-latest'), system: SYSTEM_PROMPT, maxOutputTokens: 1600 })`.

`parseModelJson(text)` salvages the JSON, then `coercePosterReading()` clamps everything (date/time regex gates, category whitelist, length caps, tag caps, recurrence span sanity). `null` -> the same `failed` path as 4a.

**Step 6 — Resolve entities.** `resolveSafely()` -> `resolvePoster(reading)`:
- **A1** `matchCityLocal(reading.city, fetchLocations())` — exact folded, then Albanian stem
- **B** if `reading.venue_name`: `SELECT ... FROM places WHERE status='active' AND location_slug=<city>` (or `ilike country`), limit 500, anon client -> `matchVenueCandidates()` -> matched / suggested / none (ties demote to suggested)
- **A2** no city but a matched venue -> inherit its `location_slug`
- **A3** still no city -> Nominatim `/search?q={city, country}&limit=3&addressdetails=1`, 1 req/s spacing, 2 s timeout -> `status:'remote'`
- **C + D in parallel** (`Promise.allSettled`): geocode the address **only if** no venue auto-linked, an address exists, and a city centre exists — discarded if >30 km from that centre; and `detectDuplicate()` needing an exact date + a location key, comparing with `titlesMatch`

Any throw -> `NONE_RESOLUTION`; the candidate survives unresolved.

**Step 7 — Assess.** `assessReading(reading, resolution, todayIso, {broadSource: pathname === '/'})` produces `missingFields` and `warnings`. Realistically for a fresh Albanian source: `time_required`, `venue_unmatched`, `coords_unverified`, often `city_remote_only` or `city_unmatched`, sometimes `no_description`. `scoreConfidence()`: any CRITICAL code (`no_date`, `past_date`, `not_single_event`, `duplicate_live`, `duplicate_in_review`, `low_model_confidence`) -> **low**; else any SOFTENING code or a missing core field -> **medium**; else **high**. Most crawled events land **medium**.

**Step 8 — Persist.** `buildCandidateWrite()` + `upsert(onConflict:'normalized_url')` writes `status:'needs_review'`, `parser_version`, `image_url`, `confidence`, `warnings`, `missing_fields`, the full `reading` and `resolution` jsonb, plus denormalized `title` / `event_date` / `venue_name` / `city_label` / `country` / `duplicate_status` / `duplicate_event_slug`.

**Step 8a — Non-event guard (discovery runs only).** Fresh import and `!isKeepableEvent(reading)` (`is_event === false` or `confidence < 0.35`) -> `deleteCandidate(id)`, `outcome:'not_event'`. **END (dropped).** A manual single-URL paste keeps the candidate and flags `not_single_event`.

**Step 9 — Politeness / budget.** `await wait(800)` before the next event URL and before the next source. Past the deadline (270 s cron, 50 s admin route), remaining sources go into `report.remainingSources` — **and nothing feeds them back in.** `recordRun(normalizedUrl, foundCount, foundCount>0?'ok':'empty')` stamps `crawl_sources`. The cron logs one summary line and returns the report as JSON. **The report itself is never persisted.**

**Step 10 — Human review #1.** An admin opens `/admin/event-radar` (default filter `review`), clicks the candidate -> `/admin/event-radar/[id]`. They see the source link, the extracted image, the confidence badge, warnings, missing fields, the duplicate panel, and an editable form. If `time` is blank the **Approve button is disabled** ("Add Start time first"); clicking the requirement focuses `#radar-field-time`. They type `21:00`.

**Step 11 — Approve the candidate.** `POST /api/admin/event-radar/[id] {action:'approve'}` — the client auto-saves the patch first (`saveCandidateReading`, which re-runs `assessReading` against the **stored** resolution, not a fresh one), then `approveCandidate(id, adminUserId)`:
- `candidate.submission_id` already set -> return it (idempotent)
- `missingApprovalFields(reading)` -> title/date/time still blank -> **HTTP 422** with `{blockers}`; candidate stays `needs_review`
- `crawlReadingToSubmission(reading, resolution, image_url, adminUserId)` maps ~45 fields: `place_id:null`, `location_slug` from the resolved city else `'unknown'`, `country` else `'Unknown'`, `venue_name` = matched place name -> raw reading -> city label -> `'TBA'`, `lat/lng` from a matched place or an address geocode else `null/null`, `banner_url` = the remote image URL, `gallery_urls = [image]`, i18n packs `null`, `status:'pending'`
- `INSERT INTO event_submissions` via the **service-role** client. On PG error -> `translateSubmissionError()` returns a safe sentence
- `UPDATE event_import_candidates SET status='approved', submission_id=..., decided_by=...`. If this second write fails, success is still returned deliberately, to stop a retry duplicating the submission

**Step 12 — Human review #2.** The row appears in `/admin/queue` (Pending) as a community submission owned by the approving admin. The admin can **only** Approve / Reject / Preview / Delete — **no editing at this stage**.

**Step 13 — Publish.** `approveSubmission()` runs **in the browser** with the admin's JWT:
1. slug = `slugify(title)-{submissionId.slice(0,8)}`
2. `SELECT source_url FROM event_import_candidates WHERE submission_id = ...` -> kept as `official_source_url` only if it matches `^https?://`
3. if `lat && lng && location_slug` -> `rpc('upsert_city_from_event', ...)` — **skipped here**, because Step 6 produced `lat/lng = null`. So `example.com`'s city is never registered
4. `INSERT INTO events {...35 fields..., status:'published', highlight:false}` — `origin` is **not set**, so it defaults to `'admin_seeded'` even though this event was imported
5. `UPDATE event_submissions SET status='approved'` (separate query, not a transaction)
6. fire-and-forget `POST /api/admin/notify-event-published`

**Step 14 — Live.** Public at `/events/{slug}`. Appears on `/events`, the homepage, `/city/{slug}`, the similar-events rail. **Does not appear on `/map`** — the map query requires non-null `lat`/`lng`.

**Step 15 — Ongoing verification.** Because `official_source_url` was stamped, `GET /api/cron/verify` picks it up (published, upcoming, not cancelled, least-recently-verified first, <=40/run). `readEventFromUrl` re-reads; `decideVerify()` compares title (`titlesMatch`) and date:
- same event, same date -> stamp `last_verified_at`
- same event, date moved -> stamp + `listing_status='updated'` (a neutral public banner)
- different event on the page -> **flag only**, no write
- page no longer an event -> **flag only**, no write
- unreadable -> **flag only**, no write

The flags land in `report.flags` in the HTTP response — **which nothing reads and nothing stores.**

---

## SECTION 33 — CURRENT MANUAL EVENT CREATION WALKTHROUGH

### A. Creating one event from scratch as an admin

1. Sign in as a user whose `profiles.role = 'admin'`.
2. Go to `/admin/events/new` (`app/admin/layout.tsx` re-checks the role; non-admins are redirected to `/`).
3. **Type + Category.** Click "Event" or "Protest". If Event, click one of nightlife / music / sports / culture / food. (Protest auto-sets `civic` and removes the Tickets step.)
4. **Basics.** Title (>=3 chars) and description (**>=20 chars**, enforced). Optionally tags one at a time and the content language.
5. **When.** Pick a schedule type (single / multi-day / repeat). Pick a date — **must not be in the past**. Optionally an end date (must be strictly after). Optionally a start time — **not required, and there is an x to clear it**. Optionally "Add end time". Confirm or change the auto-detected IANA timezone.
6. **Where.** Type into the address field -> Nominatim suggestions via `/api/geocode` -> pick one, which sets `lat`, `lng`, `location_slug`, `country`, `region`, `city`, `address`. Optionally an `address_hint` landmark and a free-text `venue_name`. (Or toggle Online and paste a valid URL.) **You cannot pick an existing venue from `places` — there is no venue picker anywhere.**
7. **Media.** Optional. Upload photos (JPG/PNG/WebP/AVIF, <=8 MB each, unlimited) -> browser-direct to the `event-covers` bucket under `{your-user-id}/{uuid}.ext`. Drag to reorder; **photo #1 becomes the cover**. Optionally untick "show cover in gallery". Optionally add named photo sections with their own heading, blurb, and photos.
8. **Tickets.** Optional. "No tickets", or up to 5 free tiers (name, capacity 1-100 000, max per person 1-10).
9. **Organizer.** Organizer name (**required**) and contact email (**required, format-validated**). Optionally phone, website (must start `http(s)://`), and Instagram/Facebook/TikTok/Twitter handles.
10. **Review.** Read the preview. Submit.
11. `submitAdminEvent()` runs: best-effort `upsert_city_from_event` if you have coordinates, then a **direct `events` INSERT with `status:'published'`**. Live immediately — no moderation. A success panel offers View live page / Create another / Back to events.
12. Ticket tiers are synced afterwards, fail-soft.

**What you cannot set anywhere in this flow, despite the columns existing:** `place_id`, `price`, `ticket_url`, `ticket_provider`, `price_from_cents`, `price_currency`, `ticket_sales_status`, `door_tickets`, `age_restriction`, `official_source_url`, `listing_status`, `doors_time`, `practical_info`, `highlight`, and any translation. Those require Supabase Studio or the `admin_update_event` RPC.

**Shortcut that exists:** the banner above the wizard links to `/scan` — photograph a poster, Lens (Gemini) reads it, and you return to the same wizard with the localStorage draft prefilled (including a 4-language translation pack). Gated by `hasStudioAccess()`.

### B. Reviewing a crawler-created submission

Because of the two-queue architecture, a crawler find is reviewed **twice**.

**Review #1 — `/admin/event-radar`:**
1. Open `/admin/event-radar`. Default tab **Needs review**; real-looking events sort first.
2. Scan the list: title, date, venue, city, source host, **high / medium / low** badge.
3. Click a candidate -> `/admin/event-radar/[id]`.
4. Read the evidence panel: source link, extracted image, import time, `parser_version`.
5. Read the **warnings** — in practice usually "Start time was not found in the imported source...", "Venue name could not be linked to a known place.", "Coordinates could not be verified — the map pin may be missing." Plus a duplicate panel if one matched.
6. Read the **missing fields** count and list.
7. **Open the source page in another tab and check the facts yourself.** Nothing in the UI does this for you.
8. Fix the form: title, date, **start time (mandatory — Approve stays disabled without it)**, end time, venue, address, city, country, price, organizer, organizer website, description, category, tags, civic checkbox.
9. Optionally **Retry** to re-fetch and re-extract from scratch (only while `needs_review`/`failed`) — note this discards your edits.
10. **Save** (persists and re-scores against the existing resolution; does **not** re-resolve city/venue/coords — only Retry does) or **Approve** (auto-saves, then mints the submission). Or **Reject** with a note, or **Delete**.
11. Approving does **not** publish. It creates a `pending` row in `event_submissions`.

**Review #2 — `/admin/queue`:**
12. Open `/admin/queue`. The row appears under **Pending**, attributed to you as the submitter.
13. Expand it to read description, venue, contact, civic details, and the poster-provenance line.
14. Optionally **Preview** the rendered event page.
15. **You cannot edit anything here.** If something is wrong, go back to the candidate (if still open), or approve and fix afterwards.
16. **Approve** -> the client-side `events` INSERT publishes immediately, copying `official_source_url` so the nightly verification loop will monitor it.
17. To correct anything, go to `/admin/events/{id}/edit` — which opens the **same creation wizard**, pre-filled, and saving republishes instantly.

**Manual cost per imported event: two queue visits, one source-page cross-check, one mandatory time entry, and — because `place_id` is always null and coordinates usually are too — a follow-up edit if you want it on the map.**

---

## SECTION 34 — CURRENT ARCHITECTURAL LIMITATIONS

**Data model**
1. **No multiple occurrences.** One row = one date (or one contiguous range, or one daily/weekly rule).
2. **No tour / series / grouping concept.** No `tour_id`, `series_id`, `parent_event_id`.
3. **No multiple venues, cities, times, ticket links, or prices per event.**
4. **`event_submissions.time` is NOT NULL** while every writer sends NULL for an unknown time.
5. **`event_submissions` is a frozen shape** by explicit schema rule #8, yet mandatory for every import.
6. **No FK from `events` back to `event_submissions` or `event_import_candidates`.**
7. **`events.origin` is not set by the approval path** — imported and community events are recorded as `'admin_seeded'`.
8. **`location_slug` is a soft reference with no FK**; `'unknown'` is a real, frequently-written value.
9. **No CHECK constraint on `events.category`.**
10. **`recurrence` and `end_date` are mutually exclusive by convention only**, not by constraint.
11. **`banner_url` is trigger-derived** from `gallery_urls[1]` and cannot be set independently in the same statement.
12. **Only `title` and `description` are translatable.**

**Discovery / crawling**
13. **No JavaScript rendering.** Documented as a known ceiling; most Albanian venue sites are Wix/JS/Facebook.
14. **No web-wide discovery.** Same-host, depth 1, from an explicitly registered source URL. No search-engine integration, no social discovery, no aggregator APIs, no iCal/RSS ingestion.
15. **No `robots.txt` `Disallow` compliance.**
16. **No per-source crawl interval, priority, or trust.**
17. **`remainingSources` is discarded.**
18. **No retry policy.**
19. **All HTML parsing is hand-written regex.**

**Extraction**
20. **No deterministic JSON-LD parsing.**
21. **No structured-output enforcement.**
22. **No field-level confidence.**
23. **No evidence provenance.**
24. **`PosterReading` cannot express** `end_date`, `ticket_url`, `place_id`, or multiple occurrences. `artists` is extracted and then **discarded**.
25. **No cross-source verification.**
26. **Single model, single call, no fallback.**

**Places / geo**
27. **Places cannot be created through the application at all.**
28. **`place_id` is hardcoded `null` on every intake path.**
29. **Most imported events therefore have no coordinates** — never reach `/map`, never trigger `upsert_city_from_event`, no directions CTA.
30. **Nominatim rate limiting is per-serverless-instance.**

**Images**
31. **Crawler images are never downloaded or re-hosted.**
32. **schema.org `image` is not extracted.**
33. **No server-side image processing.**

**Duplicates**
34. **No true duplicate detection.**
35. **The community wizard has zero dedup.**
36. **The queue -> events approval has zero dedup**, and `events` has no uniqueness beyond a randomly-suffixed slug.
37. **Duplicate detection requires an exact date.**
38. **No merge capability of any kind.**

**Automation / operations**
39. **No update monitoring beyond a nightly re-read of one URL per event**, and the loop can only write the neutral `updated` flag.
40. **Verification anomalies are never surfaced.**
41. **No notion of a run.**
42. **No cost or token tracking.**
43. **No error tracking.**
44. **No job queue, no concurrency control, no lock/lease.**
45. **`crawl_sources.last_status` never records `'error'`.**
46. **`CRON_SECRET` is absent from `.env.local`**; if also unset in Vercel, all automation is inert.

**Publishing**
47. **The entire publish path is client-side React** (~130 lines, 35 field mappings). No server-side publish function.
48. **Publishing is two non-transactional queries.**
49. **Every import needs two separate human approvals in two separate UIs.**
50. **Submissions are not editable** between Radar approval and publication.

**Testing**
51. **No test framework.** One hand-rolled Node script covering four pure modules.

---

## SECTION 35 — DATA MIGRATION RISK

### The load-bearing fields, ranked

**`events.date` — the single most depended-upon column.** Directly referenced by:
- `lib/eventActive.ts` — `isEventActive()` and `activeEventsOrFilter()` (the raw PostgREST `.or()` string), embedded in **~10 list surfaces**
- `app/events/page.tsx` (`.order('date')`), `EventsClient.tsx` (Tonight / This weekend / date-range filters, both sort directions)
- `app/HomeClient.tsx` (4 of 7 queries), `app/page.tsx`, `app/city/[slug]`, `app/cities`, `app/protests`, `app/movements/[slug]`, `app/places/[slug]`, `app/organizers/[slug]`, `app/about`
- `components/map/MapView.tsx`, `components/events/EventCard.tsx` (`DateTile`), `components/events/SimilarEvents.tsx`
- `lib/similarEvents.ts` (`daysUntil` scoring), `lib/recurrence.ts` (every helper), `lib/eventLifecycle.ts`, `lib/dateFilters.ts`, `lib/timezone.ts`
- `lib/radar/verify.ts` (`.gte('date', today)`, `decideVerify`), `lib/lens/resolve.ts` (`detectDuplicate` `.eq('date', ...)`)
- `lib/seo/jsonLd.ts` (`startDate`), `app/sitemap.ts`
- `app/admin/AdminClient.tsx`, `app/admin/page.tsx`, `app/admin/events/EventsAdminClient.tsx`, `components/admin/AdminCommandPalette.tsx`
- `lib/eventDraftFromRow.ts`, `lib/wizardSubmit.ts` (5 write sites), and **4 RPCs**

**Breaking `events.date` breaks the entire site.** Precedent exists: `schema-reference.md:286` warns that if `end_date` does not exist, *"every list query on the site fails"* — because `activeEventsOrFilter()` names it in a wire string PostgREST rejects wholesale.

**`events.time`** — `.order('time')` on `/events`, `formatEventTimeLabel`, `formatTimeRange`, `isOvernight` (visibility cutoff day), `eventInstantMs` (sort + JSON-LD `startDate`), `nextOccurrence`, the ICS builder, all four RPCs, and five TS row types that **incorrectly declare it non-null**.

**`events.end_date`** — the wire filter, `isEventActive`'s cutoff-day logic, `isMultiDay`/`multiDayDurationDays`/`dateRangeLong`, the card's two-day tile, `DateTile`, `endedOnIso`, JSON-LD `endDate`, all four RPCs.

**`recurrence` + `recurrence_until` + `recurrence_days_of_week` + `recurrence_exceptions`** — the wire filter names `recurrence`; `lib/recurrence.ts` is the sole expansion engine, called by `isEventActive`, both sort paths, both card variants, `UpcomingOccurrencesList`, `eventLifecycle`, `similarEvents`.

**`place_id` + `lat` + `lng`** — the map's two layers, the detail page's `directionsLat/Lng` and Google Maps href, `upsert_city_from_event`'s precondition, the weather card, `resolvedCoords()`, the `places` join.

**`location_slug`** — city filtering on `/events`, `/city/[slug]`, `/cities`, the homepage, the map, `similarEvents` scoring, `detectDuplicate`'s location key, `getLocationBySlug`, `upsert_city_from_event`.

**`slug`** — the permanent public URL key: `/events/[slug]`, the sitemap, JSON-LD, share links, the AI poster cache path (`{slug}.jpg`), `duplicate_event_slug`, `CURATED_REDIRECTS`, and every external backlink. **Never regenerated** (`schema-reference.md:141`).

**`status`** — `.eq('status','published')` in essentially every public query, in `events_select_published` RLS, in `verify.ts`, in `detectDuplicate`, and in the queue state machine.

**`id`** — FK target for `saved_events`, `ticket_tiers` -> `orders`/`order_items`/`tickets`/`ticket_scans`, `volunteer_signups`, `organizer_event_reports`, `interactions.entity_id`.

### What would break if the structure changed

| Change | Blast radius |
|---|---|
| **Move `date`/`time` to an occurrence table** | 62 call sites in 38 files; `activeEventsOrFilter()`'s wire string cannot express a joined relation without a view or embedded resource; every `.order('date')`/`.order('time')`; all 4 RPCs; 5 TS row types; `EventCard`'s `PublicEvent` contract and every parent that builds it |
| **Move `place_id`/`lat`/`lng` per-occurrence** | the map's direct-pin layer, the detail page's location block + directions + weather, `upsert_city_from_event`, `resolvedCoords`, the `places` join |
| **Move `price`/`ticket_url` per-occurrence** | `EventCard`'s price precedence, the detail page CTA, `formatPriceFrom`, `events_civic_no_tickets`, `ticket_tiers.event_id` semantics |
| **Change `slug` policy** | every backlink, share card, sitemap entry, JSON-LD `@id`, the `ai-posters` bucket key, `CURATED_REDIRECTS`, `duplicate_event_slug` |
| **Relax `event_submissions.time` to nullable** | **low risk** — `events.time` is already nullable and the read stack is null-safe. Would let `missingApprovalFields`, the `time_required` warning, and the `translateSubmissionError` special-case be retired. 5 TS types should widen to `string \| null`. **The cheapest high-value change available** |
| **Add columns to `event_submissions`** | violates schema rule #8 (the reason `event_import_candidates` exists) |
| **Bypass `event_submissions` for imports** | requires a server-side publish function, since publication logic lives only in `AdminClient.approveSubmission()` |
| **Change `category` to an enum/table** | `categoryMeta.ts` constants, `LENS_CATEGORIES`, the Radar patch validator, i18n keys `category_{slug}`, all client-side equality filtering |
| **Change `tags text[]` to a join table** | client-side `some()` filtering, `similarEvents` scoring, `coercePosterReading`'s cap, the wizard's tag helpers, all 4 RPCs' array casts |
| **Re-host crawler images** | changes `toSubmission.ts` (currently a deliberate reference-as-is choice), needs storage quota planning, needs a backfill for existing hotlinks |

### Migration-mechanics risk

- **No migration ledger.** 44 seed files with no record of which were applied. Seeds are documented to have drifted before; `multiday-end-date.sql:7` records regenerating RPC bodies from **live** `pg_get_functiondef`. **Any `CREATE OR REPLACE` must be preceded by dumping the live definition.**
- **No base-table DDL in the repo** — `events`, `event_submissions`, `places`, `cities`, `organizers`, `saved_events` cannot be recreated from source control.
- **Schema rule #2** mandates additive-only migrations; dropping or renaming requires multi-phase deprecation.
- **Four RPCs must move in lockstep** for any schedule-shape change: `admin_update_event`, `organizer_create_event_v2`, `organizer_update_event`, `submit_event_submission`. `multiday-end-date.sql` is the precedent for how invasive that is.
- **`$$` dollar-quoting breaks when pasted into the Supabase SQL editor** — two commits exist solely to fix this. Use `DROP POLICY IF EXISTS` + `CREATE`, or unique dollar-quote tags.
- **`docs/schema-reference.md` is itself unreliable** — confirmed wrong on `events.time` type, `event_submissions.date` type, `contact_email` nullability, and `submitted_by_user_id` nullability. Re-derive from `information_schema` before trusting it as a migration spec.

---

## SECTION 36 — TEST COVERAGE

### What exists

**There is no test framework.** No `vitest`, `jest`, `playwright/test`, or `@testing-library/*`. No `npm test` script (only `dev`, `build`, `start`, `lint`).

Three hand-rolled Node scripts:

| File | Lines | Covers | Run with |
|---|---|---|---|
| **`scripts/radar-test.mjs`** | 338 | `assessReading` + `scoreConfidence`; `normalizeImportUrl` + `sourceNameFromUrl`; `missingApprovalFields` + `canApprove` + `translateSubmissionError`; `crawlReadingToSubmission` | `node --import ./scripts/radar-register.mjs scripts/radar-test.mjs` |
| `scripts/tix-concurrency-test.mjs` | 71 | ticketing concurrency (not event-pipeline) | node |
| `scripts/tix-qrtoken-test.mjs` | 56 | QR token signing (not event-pipeline) | node |

Support: `radar-register.mjs` + `_radar-alias-loader.mjs` install a `@/...` alias resolve hook so Node >=23 can strip TS types and load the real project libs unchanged. Assertions are a local `check(name, cond)` printing PASS/FAIL. Fixtures are inline `reading()` factories with a pinned `TODAY = '2026-07-27'`.

### The quality gates that do exist

`npx tsc --noEmit`, `npx eslint` (0 errors, 0 warnings, `react-hooks/set-state-in-effect` at **error** strength), and `npm run build`. Type/lint gates, not behavioural tests.

Several pure functions are **explicitly exported for testability** even where no test exercises them — a deliberate design choice worth preserving:
- `lib/crawl/discover.ts` — `extractEventLinks`, `filterEventUrl` (*"exported so it can be unit-tested against fixture HTML"*)
- `lib/lens/resolve.ts` — `normalizeVenueTokens`, `venueMatchTier`, `matchVenueCandidates`, `titlesMatch`, `matchCityLocal`, `stemCityName`, `haversineKm` (*"pure logic, exported for the scripted tests"*)
- `lib/radar/discoveryClassify.ts` — kept pure and free of `server-only` *"so the self-test suite can load it directly"*
- `lib/radar/verifyDecide.ts` — *"pure decision logic. No I/O, no server-only, so it's unit-testable"*
- `lib/recurrence.ts` — entirely pure ISO-string math

### Areas with NO tests

| Area | Coverage |
|---|---|
| Events | none |
| Crawler | none — `extractEventLinks`, `filterEventUrl`, the sitemap ladder, all untested despite being written for testability |
| Submissions | only `crawlReadingToSubmission`'s output shape |
| Places / venue matching | none — `venueMatchTier`, `matchVenueCandidates` (incl. tie-demotion), `normalizeVenueTokens`, `matchCityLocal`, `stemCityName` |
| Approval | only `missingApprovalFields`/`canApprove`/`translateSubmissionError` |
| Filters | none — `isEventActive`, `activeEventsOrFilter`, `isToday`, `isThisWeekend`, `hasOccurrenceInRange` |
| Recurrence | none — `nextOccurrence`, `occurrencesBetween`, `isOvernight`, `isMultiDay`, `addDays` |
| Duplicate detection | none — `titlesMatch` |
| Verification loop | none — `decideVerify`'s five verdicts |
| **SSRF guard** | none — `ipv4IsPrivate`, `ipv6IsPrivate`, `isPublicHttpUrl`, redirect re-validation. **Highest-risk untested surface** |
| Extraction / coercion | none — `coercePosterReading`, `coerceLensRegions`, `parseModelJson` |
| URL content distillation | none — `metaContent`, `extractJsonLd`, `imageFromTag`, `firstContentImage` |
| JSON-LD / SEO | none — `eventSchema`, `zonedWallClockToUtcMs` |
| RLS policies | none |
| RPCs | none |
| E2E | none |

**Roughly 4 of ~25 pure, testable event-pipeline modules have any coverage, all in one 338-line script.**

---

## SECTION 37 — FINAL EXECUTIVE SUMMARY

### What exists today

A working, human-supervised event platform with a **real but modest automated discovery capability** bolted onto a schema designed for hand-curated single-date events.

Concretely: a Next.js 16 / Supabase app with 62 event read sites across 38 files; five separate intake paths into one `events` table; a nightly Vercel Cron that expands a DB-managed source registry into event-page URLs, reads each with a plain HTTP fetch, extracts fields with a single Gemini call, resolves city/venue/coordinates/duplicates deterministically, scores the result with an honest warning-based assessment, and parks it in an admin review inbox; a daily verification cron that re-reads published sources and stamps freshness; and a single, well-factored 7-step wizard reused by community, organizer, and admin creation *and* editing.

The engineering quality of the *pure* layers is high — SSRF guarding, venue matching with Albanian morphology, tie-demotion, geocode sanity rings, transparent assessment, fail-open enrichment, idempotent upserts. The weaknesses are structural, not craftsmanship.

### Current event lifecycle

`crawl_sources` -> cron/admin trigger -> link or sitemap discovery (same-host, depth 1, <=15 links, <=12 read) -> SSRF-guarded fetch -> OG/JSON-LD/text distillation -> **one Gemini call** -> coercion -> `resolvePoster` -> `assessReading` -> `event_import_candidates` (`needs_review`) -> **human review #1** -> `crawlReadingToSubmission` -> `event_submissions` (`pending`) -> **human review #2** -> client-side `events` INSERT (`published`) -> nightly `verify` re-read.

Community submissions skip Radar (wizard -> RPC -> queue). Admin creation skips both queues (wizard -> direct published INSERT). Organizer creation uses its own RPC state machine.

### Current crawler capability

**Real, bounded, deliberately polite — and structurally capped.** It reads a site's own published index or the anchors and JSON-LD `Event` URLs on a listing page; same-host only, depth 1, <=15 candidates, <=12 read per source, 800 ms between reads, SSRF-guarded on every hop, 8 s timeouts, hard byte caps.

**It cannot execute JavaScript.** No headless browser exists in the dependency tree, and this is documented as a known ceiling. The seeded registry is three sources precisely because they were vetted as server-rendered. Paste-text import exists specifically as the human workaround.

It also does not honour `robots.txt` `Disallow`, has no retry policy, no per-source interval or trust, discards unreached sources, and persists no run record.

### Current submission capability

Two queues, two approvals, one editable stage. `event_import_candidates` carries full evidence and is fully editable with a hard approval gate on title/date/**time**. `event_submissions` is a **frozen shape** carrying ~45 columns, is **not editable at all**, and enforces `time NOT NULL` — the one constraint no writer can satisfy for a timeless event, worked around in three code layers.

Publication is 130 lines of client-side React doing a raw `events.insert()` in two non-transactional queries, with no server-side equivalent to call programmatically.

### Current place/venue capability

**The matching logic is good; the data and the write path are not.** Deterministic matched/suggested tiers with Albanian noise-word stripping and tie-demotion; Albanian city stemming; geocoding with a 30 km sanity ring, skipped entirely without a city centre.

But `places` has **no write policy and no creation code path anywhere in the app**, and every intake path hardcodes `place_id: null`. So `venue_unmatched` and `coords_unverified` fire on essentially every import, imported events land with `lat/lng = null`, and therefore never appear on the map, never register their city, and have no directions.

### Current image capability

Uploads work well (browser -> Supabase Storage, 8 MB, four formats, user-namespaced paths, drag-to-reorder, unlimited gallery, named photo sections). Fallbacks are per-category gradients or a cached AI poster.

Crawler images are **identified but never fetched**: OG/Twitter/`image_src`/heuristic content-`<img>`, validated only for protocol, then stored and rendered as a third-party hotlink. They cannot pass through `next/image` and break silently when the source rotates the file. schema.org `image` is not extracted at all.

### Current AI capability

**Google Gemini only** (`gemini-flash-lite-latest` via the Vercel AI SDK), used for five event-related things: poster-photo extraction, single-URL extraction, listing-page multi-event extraction, pasted-text multi-event extraction, and 4-language title/description translation.

Every call is `generateText()` with a prompt asking for JSON, salvaged by `parseModelJson` and hardened by hand-written coercion. **No structured output, no schema enforcement, no tool calling, no embeddings, no RAG, no second-opinion pass, no cost or token tracking.** The extraction contract is explicitly anti-hallucination — the right instinct, and the direct cause of the missing-time problem.

**The crawler path produces no translations at all** — `crawlReadingToSubmission` sets both i18n packs to `null`, pointing at an unimplemented CRAWL-3.

### Current automation capability

Two Vercel Cron jobs (`discover` 04:00, `verify` 05:00), both gated on `CRON_SECRET` with fail-closed auth — **and `CRON_SECRET` is not present in `.env.local`**, so whether any automation currently runs is an open operational question.

Automation is idempotent by construction, polite, and crash-isolated. But there is **no job queue, no lock, no retry policy, no work resumption** (`remainingSources` is dropped), and **no notion of a run** — both reports are in-memory only, and `crawl_sources` keeps a single overwritten snapshot per source. Verification anomalies are computed and thrown away.

Nothing publishes automatically. Every event requires human approval — twice, for imports.

### Major architectural constraints

1. `event_submissions.time NOT NULL` — the hard blocker on timeless events, worked around rather than fixed.
2. `event_submissions` is a frozen shape by explicit rule, yet mandatory for every import.
3. Publication logic lives only in client-side React; there is no server-side publish function.
4. `places` cannot be created by the application; `place_id` is always null.
5. One row = one date + one place + one price + one ticket link. Identity and occurrence are conflated.
6. `activeEventsOrFilter()` is a raw PostgREST `.or()` string naming `date`, `end_date`, and `recurrence`, embedded in ~10 surfaces — any schedule refactor must solve this first.
7. No JS rendering, no `robots.txt` compliance, no web-wide discovery.
8. No true duplicate detection and no merge capability.
9. No run records, no cost tracking, no error tracking, no field-level confidence, no evidence provenance.
10. No test framework; the SSRF guard, the recurrence engine, and all matching logic are untested.
11. No migration ledger and no base-table DDL in source control; `docs/schema-reference.md` is demonstrably stale.

### Tour/multiple-location support today

**None.** Berlin 3 Sep / Zurich 7 Sep / London 12 Sep requires **three independent `events` rows** with three slugs, three SEO pages, three verification cycles, and no relationship of any kind. No `tour_id`, `series_id`, or `parent_event_id`; `recurrence` cannot express it; `detectDuplicate` will never associate them; the extraction prompt explicitly says "extract only the ONE main event"; `PosterReading` has no occurrence array.

Only the **contiguous multi-day** case (Korça Beer Fest 12–16 August, one venue) is modelled properly — via `date` + `end_date`, with correct card, detail-page, and JSON-LD rendering, and an explicit warning against faking it with `recurrence='daily'`.

Introducing occurrences touches: the schema and 4 RPCs, 62 query sites in 38 files, the wire filter, both card variants, the 63 KB detail page, the map's two layers, every date filter and both sort paths, the frozen submissions table, the extraction contract and all three prompts, the duplicate detector, the verification loop, the patch whitelist and its coercer, JSON-LD and the sitemap, the ICS builder, saved-event notifications, ticket tiers, and every share/poster/broadcast template.

### Most reusable pieces

`lib/ssrfGuard.ts`, `lib/radar/normalizeUrl.ts`, `lib/crawl/discover.ts`, `lib/crawl/site.ts`, the matching trio in `lib/lens/resolve.ts` (`venueMatchTier`, `matchCityLocal`, `titlesMatch`) plus `haversineKm` and the 30 km sanity ring, `lib/radar/assess.ts` (the transparent-assessment philosophy above all), `lib/radar/approvalValidation.ts`, `lib/radar/discoveryClassify.ts`, `lib/radar/verifyDecide.ts`, `lib/recurrence.ts`, `lib/eventActive.ts` + `lib/eventLifecycle.ts`, `lib/seo/jsonLd.ts`, `hooks/useImageUpload.ts`, `lib/admin/apiAuth.ts` + `lib/cron/auth.ts`, the image-picking heuristics in `urlReader.ts`, and `EventCreationWizard` as a mode-driven, already-five-times-reused UI.

### Pieces likely requiring significant change

The `PosterReading` contract (extend, don't replace — five call sites); `lib/ai/urlReader.ts` (split fetch / distill / extract so a renderer or a real JSON-LD parser can be swapped in); `lib/radar/service.ts` and `lib/radar/discovery.ts` (must emit N candidates and record a run); `event_import_candidates` (needs per-field provenance and a multi-occurrence draft); `crawl_sources` (needs interval, priority, trust, geography, `next_run_at`, run history); `crawlReadingToSubmission` (hardcoded `place_id: null` and the TBA/Unknown fallback ladder); **`AdminClient.approveSubmission` — the single most important refactor, moving publication server-side**; `resolvePoster` (needs a place-creation path to be worth anything); and the `event_submissions` stage itself, which forces both the `time NOT NULL` problem and the second human approval.

### Highest-risk migration areas

1. **`events.date` / `time`** — touched by essentially every surface; `activeEventsOrFilter()`'s wire string is the specific chokepoint, with documented precedent that a missing column named there fails *every list query on the site*.
2. **The four RPCs** — must move in lockstep, and must be dumped from live before any `CREATE OR REPLACE`.
3. **`event_submissions`** — frozen by rule, mandatory in practice, and the location of the constraint that started this investigation.
4. **`events.slug`** — permanent by policy; any tour-aware routing scheme collides with backlinks, the sitemap, JSON-LD, share cards, and the `ai-posters` bucket key.
5. **`place_id` / `lat` / `lng`** — the map, directions, weather, and city autoseeding all key off them.
6. **`tags text[]` and `category text`** — no constraints, filtered client-side, duplicated in two TS constants and four RPC array casts.
7. **The seeds/live drift itself** — 44 migrations, no ledger, no base DDL, and a schema-reference already proven wrong on four points.

### Critical unknowns

1. **Is `CRON_SECRET` set in the Vercel project?** If not, neither cron has ever run. This determines whether the "automation" described above is live or inert.
2. **Which of the 44 `docs/seeds/*.sql` files have actually been applied?** No ledger exists. Specifically unknown: `crawl-sources.sql` and `radar-1-event-import-candidates.sql` — `sourceStore` fails soft, so an unapplied migration presents as an empty list, not an error.
3. **The live nullability and types of `event_submissions.contact_email`, `submitted_by_user_id`, `date`, and `time`** — the code implies all four differ from `docs/schema-reference.md`. Re-derive from `information_schema`.
4. **How many rows are in `places`, and how many have coordinates?** Determines whether venue matching has any practical value today.
5. **What `NEXT_PUBLIC_MAPBOX_TOKEN` is actually used for** — the map renders with MapLibre.
6. **Whether `SUPABASE_SERVICE_ROLE_KEY` is set in production** — every server-side write path depends on it.
7. **The real-world yield of the three seeded sources** — `crawl_sources.last_found_count` / `last_status` answers this in one query, and tells you immediately whether the fetch-only ceiling is theoretical or the dominant constraint.
8. **Whether any `events` rows currently have `origin = 'imported'`** — the approval path never sets it, so imported provenance may be entirely absent from production data.
