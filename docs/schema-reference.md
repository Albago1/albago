# AlbaGo — Schema Reference

**Version:** 1.1  
**Date:** 2026-05-14  
**Status:** Current production schema as of Phase 7A. Phase 7B additions are marked clearly throughout.  
**Maintained by:** Update this document before running any migration. It is the schema truth, not a post-migration dump.

---

## How to Read This Document

Column entries use the following format:

```
column_name   postgres_type   [NOT NULL]   DEFAULT value   — note
```

**Nullable** means the column accepts NULL and the application treats NULL as meaningful absence (not an empty string).  
**NOT NULL** means the DB enforces presence — the application should never send NULL.  
**No nullability marker** at all means the column exists but the constraint was not applied at creation and may be inconsistent across rows.

Section headings follow this structure for each table: Purpose → Columns → Constraints → Indexes → RLS Policies → Ownership & Visibility → Lifecycle Notes → Future Reserved.

---

## Entity Overview

```
auth.users (Supabase managed)
    │
    ├─ profiles               1:1   role-based access control
    │
    ├─ organizers             1:1   organizer identity layer
    │       └─ organizer_onboarding_responses   1:1
    │
    └─ saved_events           many:many bridge (user ↔ events)

places (venues)
    └─ events  ─── many FK to one place (place_id)

events
    ├─ saved_events           (referenced)
    └─ organizers             (Phase 7B: organizer_id FK)

event_submissions             independent pipeline; never merges into events
cities                        location metadata; no FK to events or places
```

---

## Architectural Rationale

This section consolidates the reasoning behind key design decisions. These are not obvious from column types alone — they represent deliberate choices made under specific constraints and must be preserved as the schema evolves.

### Why `organizer_id` is nullable on `events`

`events.organizer_id` is nullable by design. NULL is not an error condition — it is the canonical signal for two legitimate origins:

1. **Admin-seeded** (`origin = 'admin_seeded'`): Events created directly by the AlbaGo team via Supabase Studio or admin tooling. No organizer owns them.
2. **Community-promoted** (`origin = 'community_submission'`): Events promoted from `event_submissions` by admin approval. The community submitter is not an organizer; the approved event lands in `events` with no organizer linked.

A non-null `organizer_id` means one thing only: this event was created by an organizer through the organizer dashboard. This distinction is load-bearing for RLS (the `events_select_owner` policy), for the organizer event list query (`WHERE organizer_id = auth.uid()`), and for event page attribution ("By {organizer}").

**Alternative rejected:** A separate boolean `is_organizer_event` alongside nullable `organizer_id` would be redundant. NULL itself is the signal. Two sources of truth is worse than one.

---

### Why `event_submissions` is a permanent parallel pipeline

`event_submissions` is never merged into the `events` table structurally. It remains a separate table permanently, regardless of how mature the organizer platform becomes.

**The two flows are different products:**
- Community: anonymous or casual users, free-text venue name, no account required, admin-curated into events
- Organizer: authenticated, structured fields, first-party authorship, state-machine controlled, RPC-driven

Merging them would bloat `events` with submission-only fields (e.g. `contact_email`, free-text `venue_name`) or require nullable columns with conditional logic that signals different meanings depending on `origin`.

**The audit trail argument:** Every community submission — including rejected ones — is preserved indefinitely. Merging on approval would lose the original submission data: the submitter's contact email, the raw venue name string (which may not match any `places` row), and the original free-text description. These are operationally useful (the admin sees the submitter's intent, not just the final published event).

**The practical argument:** Retiring `event_submissions` would require migrating all historical submission rows, updating the admin queue UI, and taking down `/submit-event`. The cost exceeds the benefit as long as both flows coexist.

---

### Why `TEXT + CHECK` instead of PostgreSQL ENUM

All status and origin columns — `events.status`, `event_submissions.status`, `places.status`, `events.origin` — use `text` with a CHECK constraint, not a PostgreSQL `ENUM` type.

**The ENUM problem:** Adding a new value to a Postgres ENUM requires `ALTER TYPE ... ADD VALUE`. This is not transactional in Postgres — the command cannot be rolled back within a `BEGIN; ... COMMIT;` block. Every migration in this codebase runs inside a transaction for a clean rollback path. `ALTER TYPE ADD VALUE` breaks that invariant.

**The CHECK advantage:** `ALTER TABLE events DROP CONSTRAINT events_status_check; ALTER TABLE events ADD CONSTRAINT events_status_check CHECK (...new values...);` is fully transactional. If the migration fails mid-way, the whole block rolls back.

**The operational advantage:** Adding a new status (e.g. `'archived'`) requires only updating the CHECK constraint and updating this document and the TypeScript union type. No function signature changes, no type migration, no dependent code changes beyond the places that branch on the value.

---

### Why RLS is the final security boundary

AlbaGo uses a four-layer security model, from outermost to innermost:

```
Frontend validation   →  UX only. Never trusted. Users can bypass with browser DevTools.
Server guard          →  Redirect or 403 before rendering. UX gate, not a security gate.
RPC functions         →  Transactional boundary. Enforces state machine rules per request.
Row Level Security    →  Database-enforced. The actual enforcer. Cannot be bypassed.
```

**Why server guards are not sufficient:** A server component can check auth and redirect on failure — but it only protects against browser navigation. A direct call to the Supabase REST API with a valid JWT bypasses the Next.js server entirely. RLS on the database blocks that call regardless of how it arrived.

**Why RPCs alone are not sufficient:** RPC functions enforce state machine logic (e.g. "only move from draft to pending_review, not backward"). But they can only block what they are explicitly programmed to block. A new RPC written without the full security context could accidentally allow a forbidden transition. RLS is the backstop.

**Why RLS at the DB is correct:** Postgres evaluates RLS on every query regardless of origin — Next.js server components, Supabase JS client, PostgREST directly, psql. The database does not trust the caller to have verified permissions upstream. This is the correct model for a system with multiple access paths (browser app, server components, future mobile client, future public API).

**Implication for new tables:** Every table must have `RLS ENABLED` and at least one explicit SELECT policy before shipping. The absence of a policy is a bug — Postgres denies all access when RLS is enabled and no policy matches, but this is a silent failure mode that is easy to miss in testing.

---

### Why there is no `is_organizer()` function

There is no `is_organizer()` counterpart to `is_admin()`. Organizer status is not a role — it is a row-keyed capability.

**Why `is_admin()` exists as a function:** Admin is a binary, cross-cutting gate. The same check ("does this session have admin privileges?") is used in dozens of RLS policies across multiple tables. Centralizing it in a `SECURITY DEFINER` function avoids duplication and ensures a single point of change if the admin model evolves.

**Why `is_organizer()` would be the wrong abstraction:** The organizer-relevant RLS check is not "is this user an organizer globally?" It is "does this user own this specific row?" — expressed as `organizer_id = auth.uid()`. This is a join-key comparison, not a role check. A boolean `is_organizer()` would not express ownership; it would only say "an organizers row exists," which is a weaker predicate than what the policy actually needs.

---

### Why `profiles.role` stays `'user'` for organizers

Organizer is a capability, not a role. Users who complete organizer onboarding remain `profiles.role = 'user'`.

**What this means in practice:**
- There is no `'organizer'` value in `profiles.role`.
- The organizer dashboard and all organizer-gated routes check for an `organizers` row, not a role value.
- An admin user can also be an organizer (if they have an `organizers` row). The two are independent.

**Why:** Roles should control cross-cutting, table-agnostic access levels (`is_admin()` → can read everything). Organizer capability is scoped to specific rows in specific tables. Mixing the two into a single `role` column would require `WHERE role = 'organizer' OR role = 'admin'` patterns that become combinatorially complex as more capabilities are added.

---

### Why slugs are permanent

Both `events.slug` and `organizers.slug` are set at creation time and never regenerated or modified.

**The URL stability argument:** An event URL like `/events/summer-beach-party-tirana-2025` accumulates backlinks, social shares, and search index entries. Changing the slug after publication invalidates all of these. A 301 redirect mitigates some SEO loss but adds operational complexity and is not automatic — it must be manually maintained.

**The integrity argument:** The slug is the public identity of the entity. Any bookmark, share, or embed that references the URL breaks silently if the slug changes. The cost of a slug collision at creation (handled by the 6-character random suffix on organizer slugs) is far lower than the cost of changing a published slug.

**Implication for future imports:** Any event import pipeline (`origin = 'imported'`) must generate a stable, collision-safe slug at import time. Slugs must not be derived from mutable fields like the title (which an editor might later correct).

---

### Why `ON DELETE SET NULL` on `events.organizer_id`

When an organizer row is deleted (account deletion cascade), `events.organizer_id` is set to NULL rather than cascade-deleting the event rows.

**The publication argument:** A published event is a public commitment. If AlbaGo published a concert on behalf of an organizer and then the organizer deleted their account, removing the event would break all links to that event, surprise users who saved it, and remove the event from search indexes. The event outlives the organizer.

**The audit argument:** Keeping the event row with `organizer_id = NULL` preserves the audit trail. The `origin = 'organizer_dashboard'` value remains, signaling the provenance even after the organizer account is gone. Admin can still see and manage the event.

**The failure case:** A draft or pending event becomes orphaned (unreachable by any organizer) if the organizer deletes their account before publishing. Admin must handle these manually via Supabase Studio. This is an acceptable tradeoff for the benefit of preserving published events.

---

## 1. `profiles`

### Purpose

One row per authenticated user. Created automatically by Supabase Auth on sign-up (via a database trigger set up in the Supabase dashboard). The `role` column is the source of truth for access control throughout the application — the `is_admin()` function reads from it.

### Columns

```
id        uuid     NOT NULL   —  PK. Matches auth.users.id exactly.
role      text     NOT NULL   DEFAULT 'user'  —  values: 'user', 'admin'.
                              'organizer' is defined in types/backend.ts but
                              is unused at the DB level; organizer status is
                              determined by existence of an organizers row.
```

> **Note:** `profiles` likely has additional columns created by Supabase's default trigger (e.g. `full_name`, `avatar_url`, `updated_at`). Only `id` and `role` are read by the application. The others are listed in `BackendUser` in `types/backend.ts` but not queried.

### Constraints

- `id` PK, FK → `auth.users(id)` ON DELETE CASCADE
- `role` should have a CHECK constraint — not confirmed to exist; verify in Supabase dashboard

### Indexes

- PK index on `id` (implicit)

### RLS Policies

Not fully documented. The application only reads `role` via server components using the service role or cookie-authenticated client. The `is_admin()` function accesses the table with `SECURITY DEFINER`, bypassing RLS.

### Ownership & Visibility

- Each row is owned by the `auth.users` row it mirrors.
- `role = 'admin'` is the only value that grants elevated privileges. Must be set manually in Supabase dashboard or via a one-time SQL statement.
- No self-service role escalation is possible through any application surface.

### Lifecycle Notes

- Row is created on user sign-up via Supabase trigger.
- Row is deleted when the auth.users row is deleted (ON DELETE CASCADE).
- `role` is mutated only by admins via the Supabase Studio SQL editor.

---

## 2. `events`

### Purpose

The canonical published event table. Every public-facing surface (homepage, events list, event detail, map, venue upcoming events) reads exclusively from this table. All existing rows have `status = 'published'`. Draft and pending states are added in Phase 7B.

### Columns (current — Phase 7A and earlier)

```
id             uuid          NOT NULL   DEFAULT gen_random_uuid()   —  PK
title          text          NOT NULL   —  display title
slug           text          NOT NULL   UNIQUE   —  URL key; set at creation, never changed
place_id       uuid          nullable   —  FK → places(id) ON DELETE SET NULL. NULL for events with no linked venue.
category       text          NOT NULL   —  values: 'nightlife', 'music', 'sports', 'culture', 'food'
description    text          NOT NULL
date           date          NOT NULL   —  stored as date (not text)
time           text          nullable   —  display string e.g. "22:00"
price          text          nullable   —  display string e.g. "Free", "500 ALL", "€10". Not a numeric.
highlight      boolean       NOT NULL   DEFAULT false   —  editorial featured flag
status         text          NOT NULL   DEFAULT 'published'   —  currently only 'published' in production
location_slug  text          NOT NULL   —  matches cities.slug; not a FK (denormalized for query speed)
country        text          NOT NULL   —  e.g. "Albania"
region         text          nullable   —  e.g. "Tirana County"
search_vector  tsvector      nullable   —  maintained by trigger; GIN-indexed; used for full-text search
created_at     timestamptz   NOT NULL   DEFAULT now()
updated_at     timestamptz   NOT NULL   DEFAULT now()
```

### Columns added in Phase 7B (NOT YET IN PRODUCTION)

```
organizer_id   uuid          nullable   —  FK → organizers(id) ON DELETE SET NULL.
                                           NULL = admin-seeded or community-promoted event.
                                           Non-null = organizer created this event.
origin         text          NOT NULL   DEFAULT 'admin_seeded'
                                           CHECK: 'admin_seeded' | 'organizer_dashboard' |
                                                  'community_submission' | 'imported'
                                           Set at creation. Never updated.
banner_url     text          nullable   —  event banner image URL. Reserved; not used until 7C.
published_at   timestamptz   nullable   —  set by admin_publish_event() RPC. NULL for admin-seeded
                                           events until 7B backfill runs (backfill: = created_at).
admin_note     text          nullable   —  rejection reason from admin. Visible to owning organizer.
```

### Constraints

```sql
-- Existing
UNIQUE (slug)

-- Phase 7B adds
CHECK status IN ('draft', 'pending_review', 'published', 'rejected', 'cancelled', 'completed')
CHECK origin IN ('admin_seeded', 'organizer_dashboard', 'community_submission', 'imported')
```

### Indexes

```
events_pkey                  —  btree on id (implicit PK)
events_slug_key              —  btree unique on slug
events_search_vector_idx     —  GIN on search_vector (Phase 3)

-- Phase 7B adds
events_organizer_id_status_idx  —  btree on (organizer_id, status) WHERE organizer_id IS NOT NULL
events_status_created_at_idx    —  btree on (status, created_at DESC) WHERE status = 'pending_review'
```

### Triggers

```
events_search_vector_update  —  BEFORE INSERT OR UPDATE, calls update_events_search_vector()
organizers_set_updated_at    —  BEFORE UPDATE, calls set_updated_at()
```

### RLS Policies (current — pre-7B)

```
"Enable read access for all users"  —  FOR SELECT USING (true)
  ⚠ This policy is too broad. It was set before status had multiple values.
  It is safe now because all rows have status = 'published', but it MUST be
  replaced before Phase 7B migration is applied.

"Admins can insert events"     —  FOR INSERT WITH CHECK (is_admin())
"Admins can delete events"     —  FOR DELETE USING (is_admin())
  (Policy names may differ from actual; verify in Supabase dashboard before 7B migration)
```

### RLS Policies (Phase 7B — replaces above)

```
events_select_published   —  FOR SELECT USING (status = 'published')
events_select_owner       —  FOR SELECT USING (organizer_id = auth.uid())
events_select_admin       —  FOR SELECT USING (is_admin())
events_insert_organizer   —  FOR INSERT WITH CHECK (organizer_id = auth.uid()
                              AND status = 'draft' AND origin = 'organizer_dashboard')
events_insert_admin       —  FOR INSERT WITH CHECK (is_admin())
events_delete_admin       —  FOR DELETE USING (is_admin())

IMPORTANT: No UPDATE policy exists on events (any version).
All state changes and field edits are RPC-only.
```

### Ownership & Visibility

| State | Public | Auth user | Owning organizer | Admin |
|---|---|---|---|---|
| `published` | ✅ read | ✅ read | ✅ read | ✅ all |
| `draft` (7B) | ❌ | ❌ | ✅ read + edit | ✅ all |
| `pending_review` (7B) | ❌ | ❌ | ✅ read only | ✅ all |
| `rejected` (7B) | ❌ | ❌ | ✅ read + edit | ✅ all |

### Lifecycle Notes

- All rows in production are `status = 'published'`. There are no drafts, pending, or rejected events yet.
- `slug` is derived from `title` at creation time and is permanent. It is the public URL identifier.
- `highlight = true` surfaces the event in homepage featured sections. Set manually by admin.
- `location_slug` is intentionally denormalized from the `cities` table. If a city slug changes, events must be bulk-updated. This has never happened and is low risk.
- `price` is a display string, not a numeric. It is never parsed or computed by the application. Ticket pricing (Phase 7E) will live in a separate `event_tickets` table.

### Future Reserved

```
-- Phase 7C
banner_url    (already added in 7B but unused until image upload UI exists)

-- Phase 7E
-- No columns added to events for ticketing.
-- Capacity and ticket tiers live in event_tickets table.
-- Revenue and sales live in ticket_purchases table.
-- quantity_sold is explicitly NOT added here — computed from ticket_purchases COUNT.
```

### Deprecated / Legacy Paths

- The admin `events.insert()` call from `AdminClient.tsx` (community submission approval) hardcodes `status: 'published'` and `origin` is not set (will default to `'admin_seeded'`). This is acceptable for now but becomes Phase 7C cleanup work. Community-promoted events should set `origin = 'community_submission'`.

---

## 3. `event_submissions`

### Purpose

The community submission pipeline. Users submit events via `/submit-event`. Admins review, approve, or reject via `/admin`. Approved submissions are copied into the `events` table (with `status = 'published'`), but the submission row itself is never deleted — it is updated to `status = 'approved'` and kept as an audit trail.

This table is a **permanently parallel pipeline** to organizer-created events. It is never merged into `events` structurally. When an organizer submits a draft event (Phase 7B), that goes through the `events` table + state machine, not through `event_submissions`.

### Columns

```
id                      uuid          NOT NULL   DEFAULT gen_random_uuid()   —  PK
title                   text          NOT NULL
venue_name              text          NOT NULL   —  free-text name typed by submitter
place_id                uuid          nullable   —  FK → places(id) ON DELETE SET NULL.
                                                    Set if submitter picked an existing venue.
                                                    NULL if venue was typed (new venue to be created by admin).
category                text          NOT NULL   —  same values as events.category
description             text          NOT NULL
date                    text          NOT NULL   —  ⚠ stored as text (ISO date string), not date type.
                                                    Cast to date at approval time when copying to events.
time                    text          NOT NULL   —  display string e.g. "22:00"
price                   text          nullable   —  display string; same semantics as events.price
contact_email           text          NOT NULL   —  submitter's contact email (may differ from auth email)
submitted_by_user_id    uuid          nullable   —  FK → auth.users(id) ON DELETE SET NULL.
                                                    NULL for submissions inserted before Phase 2 (legacy).
status                  text          NOT NULL   DEFAULT 'pending'
                                                    values: 'pending', 'approved', 'rejected'
admin_note              text          nullable   —  populated on rejection; visible to submitter in /dashboard
country                 text          NOT NULL
region                  text          nullable
location_slug           text          NOT NULL   —  matches cities.slug (denormalized)
created_at              timestamptz   NOT NULL   DEFAULT now()
updated_at              timestamptz   NOT NULL   DEFAULT now()
```

### Constraints

- No CHECK constraint on `status` — enforced by application logic only. Could add: `CHECK (status IN ('pending', 'approved', 'rejected'))`.
- No CHECK constraint on `date` — stored as text, not date. Historical decision; not ideal.

### Indexes

- PK index on `id` (implicit)
- No explicit secondary indexes. Consider `(submitted_by_user_id, created_at DESC)` if dashboard query becomes slow.

### RLS Policies

```
"submissions_select"         —  FOR SELECT USING (submitted_by_user_id = auth.uid() OR is_admin())
"submissions_insert"         —  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL AND submitted_by_user_id = auth.uid())
"submissions_admin_update"   —  FOR UPDATE USING (is_admin())
```

No DELETE policy. Rows are never deleted.

### Ownership & Visibility

- **Submitter** owns their row: can read it, cannot modify after submission.
- **Admin** can read all rows and update `status` + `admin_note`.
- **Public / anon** cannot access this table.
- **Legacy rows** (submitted_by_user_id = NULL) are admin-readable only. No user owns them.

### Lifecycle Notes

- `status` progresses: `pending` → `approved` or `rejected`. No path back to `pending` from `approved` or `rejected`. No organizer-style state machine — admin is the only actor.
- On approval: admin calls `events.insert(...)` from `AdminClient.tsx`, then updates the submission row to `status = 'approved'`. These are two separate queries, not a transaction. Race condition is low risk (admin-only, low frequency).
- The submission row is kept permanently after approval for audit trail. The `events` row and the `event_submissions` row are not linked by FK.
- `date` being stored as text is a known technical debt. It is correct in the UI because it is submitted as an ISO date string and passed through unchanged. Do not parse it in application code — pass it as-is when copying to `events.date`.

---

## 4. `places`

### Purpose

Venues. Every physical location where events happen, every bar, club, restaurant, beach, or cultural space in the system. Referenced by `events.place_id` and `event_submissions.place_id`. Routes: `/map` (markers), `/places/[slug]` (detail page).

### Columns

```
id               uuid        NOT NULL   —  PK
name             text        NOT NULL
slug             text        NOT NULL   UNIQUE   —  URL key; populated via backfill in Phase 6.
                                                    Going forward: required at INSERT time.
category         text        NOT NULL   —  e.g. 'club', 'bar', 'restaurant', 'beach', 'cafe'
description      text        nullable
city             text        nullable   —  display city name (legacy; predates location_slug)
address          text        nullable   —  human-readable address string
lat              float8      nullable   —  WGS84 latitude. NULL for venues without known coordinates.
lng              float8      nullable   —  WGS84 longitude. NULL for venues without known coordinates.
image_url        text        nullable   —  primary image (legacy column name; also exposed as cover_image_url)
cover_image_url  text        nullable   —  preferred image column going forward
images           text[]      nullable   —  additional image URLs
options          text[]      NOT NULL   DEFAULT '{}'   —  feature chips e.g. ['outdoor', 'smoking', 'vip']
verified         boolean     NOT NULL   DEFAULT false   —  admin-verified venue
website_url      text        nullable
phone            text        nullable
status           text        NOT NULL   DEFAULT 'active'   —  values: 'active' (only used value in production)
google_place_id  text        nullable   —  external ID for future Google Places integration
location_slug    text        NOT NULL   —  matches cities.slug; not a FK
country          text        NOT NULL
search_vector    tsvector    nullable   —  maintained by trigger; GIN-indexed
created_at       timestamptz nullable   —  may be NULL on older rows
updated_at       timestamptz nullable   —  may be NULL on older rows
```

### Constraints

```sql
UNIQUE (slug)
CREATE UNIQUE INDEX places_google_place_id_unique ON places (google_place_id) WHERE google_place_id IS NOT NULL
```

### Indexes

```
places_pkey                   —  btree on id
places_slug_key               —  btree unique on slug
places_google_place_id_unique —  partial unique btree on google_place_id WHERE NOT NULL
places_search_vector_idx      —  GIN on search_vector (Phase 3)
```

### Triggers

```
places_search_vector_update   —  BEFORE INSERT OR UPDATE, calls update_places_search_vector()
```

### RLS Policies

```
"Enable read access for all users"   —  FOR SELECT USING (true)   [public read]
```

No INSERT, UPDATE, or DELETE policies — admin manages places directly via Supabase Studio or future admin UI. The anon and authenticated roles are blocked from writes by the absence of matching policies.

### Ownership & Visibility

- Fully public for read. No per-row ownership model.
- All writes are admin-only (via Supabase Studio).
- Future: venue claim flow will introduce an `owner_user_id` column and an organizer-ownership model. Not in scope until Phase 7D+.

### Lifecycle Notes

- `status = 'active'` is the only production value. `status = 'inactive'` is reserved for soft-deleted or delisted venues. No application code reads `status` on places — it is a future toggle.
- `image_url` and `cover_image_url` overlap. New code should prefer `cover_image_url`. On detail pages, the application checks both in the query and renders whichever is non-null.
- `lat` and `lng` being NULL is valid — some venues exist in the system without coordinates. The map only shows places where both are non-null. Directions CTAs are hidden when either is null.
- `google_place_id` is reserved for a future enrichment pipeline. No application code reads it today.

### Future Reserved

```
owner_user_id    uuid   —  Phase 7D: venue ownership / claim flow
opening_hours    jsonb  —  future: structured hours per day
avg_rating       float  —  future: computed from user reviews
crowd_level      int    —  future: real-time crowd density signal
```

---

## 5. `saved_events`

### Purpose

Many-to-many join table between users and events. Represents a user's saved (bookmarked) events. The save count is never exposed publicly — it is a private user feature only.

### Columns

```
id         uuid          NOT NULL   DEFAULT gen_random_uuid()   —  PK (surrogate)
user_id    uuid          NOT NULL   —  FK → profiles(id) ON DELETE CASCADE
event_id   uuid          NOT NULL   —  FK → events(id) ON DELETE CASCADE
saved_at   timestamptz   NOT NULL   DEFAULT now()
```

### Constraints

```sql
PRIMARY KEY (id)
UNIQUE (user_id, event_id)   —  prevents double-saves; enforced at DB level
FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE
FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
```

### Indexes

```
saved_events_pkey           —  btree on id
saved_events_user_id_idx    —  btree on user_id (for dashboard "list my saves" query)
saved_events_user_event_key —  unique btree on (user_id, event_id)
```

### RLS Policies

```
saved_events_select_own   —  FOR SELECT TO authenticated USING (user_id = auth.uid())
saved_events_insert_own   —  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid())
saved_events_delete_own   —  FOR DELETE TO authenticated USING (user_id = auth.uid())
```

No UPDATE policy — saves are mutated via delete + insert, never in-place update.

### Ownership & Visibility

- Strict per-user isolation via RLS. User A's saves are invisible to User B.
- No admin read access to `saved_events` is established. Admins may query directly via Supabase Studio.
- The dashboard query joins `saved_events` to `events` via PostgREST. Events RLS is applied to the join automatically — only published events appear in a user's saved list, even if an event they saved was later taken down.

### Lifecycle Notes

- When an `events` row is deleted, all saved_events rows referencing it cascade-delete automatically. Users lose the save silently — no notification.
- When a `profiles` row is deleted (user account deleted), all their saves cascade-delete.
- `saved_at` is the primary sort key for the dashboard list (most recent first).

### Future Reserved

This table is deliberately minimal. Potential future extensions:

```
-- NOT adding these now — premature:
notes        text     —  user note on the save
reminder_at  timestamptz  —  "remind me" feature
list_id      uuid     —  named collections feature
```

---

## 6. `organizers`

### Purpose

Organizer identity layer. One row per user who has completed organizer onboarding. The presence of a row signals "this user is an organizer." Row ID equals the auth.users ID (1:1 model — no organizer without an auth account, no auth account with more than one organizer row).

### Columns

```
id             uuid        NOT NULL   —  PK. Equals auth.users.id. Not generated — SET explicitly.
display_name   text        NOT NULL   —  public-facing organizer name, shown on events
slug           text        NOT NULL   UNIQUE   —  URL key for future /o/[slug] profile pages.
                                                  Generated at onboarding. Format: slugified-name-XXXXXX
bio            text        nullable   —  optional organizer bio (not collected in onboarding yet)
contact_email  text        NOT NULL   —  organizer contact email (may differ from auth email)
website_url    text        nullable
verified       boolean     NOT NULL   DEFAULT false   —  admin-verified badge. Set manually.
created_at     timestamptz NOT NULL   DEFAULT now()
updated_at     timestamptz NOT NULL   DEFAULT now()
```

### Constraints

```sql
PRIMARY KEY (id)
UNIQUE (slug)
FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE
```

### Indexes

```
organizers_pkey     —  btree on id (PK)
organizers_slug_idx —  btree on slug (added explicitly alongside the UNIQUE constraint)
```

### Triggers

```
organizers_set_updated_at   —  BEFORE UPDATE, calls set_updated_at()
```

### RLS Policies

```
organizers_select_public       —  FOR SELECT USING (true)   [public read — needed for "By {name}" on event pages]
organizers_insert_self         —  FOR INSERT WITH CHECK (auth.uid() = id)
organizers_update_self_or_admin —  FOR UPDATE USING (auth.uid() = id OR is_admin())
                                              WITH CHECK (auth.uid() = id OR is_admin())
organizers_delete_admin        —  FOR DELETE USING (is_admin())
```

No self-delete — an organizer cannot delete their own profile via the application.

### Ownership & Visibility

- Public read: `display_name` and `slug` are intentionally public so they can appear on published event pages.
- Private write: only the owner or admin can update.
- **There is no `is_organizer()` function.** Organizer status is checked by querying `SELECT id FROM organizers WHERE id = auth.uid()` and checking for a result. Application code does this in `lib/organizers.ts → fetchOrganizer()`.

### Lifecycle Notes

- Row is created atomically by the `create_organizer()` RPC during onboarding. The RPC also creates the paired `organizer_onboarding_responses` row.
- `slug` is generated client-side as `slugify(display_name) + '-' + 6-char random suffix`. On UNIQUE violation (slug collision), the client retries with a fresh suffix. Three attempts max.
- `verified = true` is a manual admin action. No application surface currently uses this flag — it is reserved for future "verified organizer" badge display.
- If the auth user deletes their account, the organizer row cascades-deletes. Events by that organizer have `organizer_id` set to NULL (SET NULL FK on `events`).

### Future Reserved

```
team_id       uuid   —  future: organizer teams (organizer_members join table)
logo_url      text   —  organizer logo / avatar
social_links  jsonb  —  Instagram, Facebook, SoundCloud handles
stripe_account_id  text  —  Phase 7E: Stripe Connect account
payout_currency    text  —  Phase 7E: payout currency (default EUR)
```

---

## 7. `organizer_onboarding_responses`

### Purpose

Survey data collected during organizer onboarding. Private intelligence for the AlbaGo team — used to understand the organizer base. Never shown publicly. All fields are optional — an organizer may submit with all survey fields empty.

### Columns

```
organizer_id               uuid      NOT NULL   —  PK. FK → organizers(id) ON DELETE CASCADE.
                                                   1:1 — one survey response per organizer.
event_types                text[]    NOT NULL   DEFAULT '{}'   —  multi-select: e.g. ['Nightlife','Music']
attendee_age_ranges        text[]    NOT NULL   DEFAULT '{}'   —  multi-select: e.g. ['18–24','25–34']
expected_attendance_size   text      nullable   —  single select: e.g. '50–200'
expected_yearly_revenue    text      nullable   —  single select: e.g. '€1k–10k'
events_per_year            text      nullable   —  single select: e.g. '5–20'
created_at                 timestamptz NOT NULL DEFAULT now()
```

### Constraints

```sql
PRIMARY KEY (organizer_id)
FOREIGN KEY (organizer_id) REFERENCES organizers(id) ON DELETE CASCADE
```

No CHECK constraints on the text[] or text values — validated by frontend chip selection. The canonical valid values are defined in `types/organizer.ts` option arrays.

### Indexes

- PK index on `organizer_id` (implicit)

### RLS Policies

```
onboarding_select_self_or_admin  —  FOR SELECT USING (auth.uid() = organizer_id OR is_admin())
onboarding_insert_self           —  FOR INSERT WITH CHECK (auth.uid() = organizer_id)
onboarding_update_self           —  FOR UPDATE USING (auth.uid() = organizer_id)
                                              WITH CHECK (auth.uid() = organizer_id)
onboarding_delete_admin          —  FOR DELETE USING (is_admin())
```

### Ownership & Visibility

- Private: only the organizer and admin can read.
- The organizer can update their own survey responses (profile settings, Phase 7D+).
- Admin can delete but not update (deletion triggers CASCADE to the row, not to the organizer).

---

## 8. `cities`

### Purpose

Location metadata. Powers the location picker in `/events`, `/submit-event`, and the map FilterBar. Also used by `fetchLocations()` in `lib/locations.ts` as the live alternative to the hardcoded fallback array.

### Columns

```
id            uuid        NOT NULL   DEFAULT gen_random_uuid()   —  PK
slug          text        NOT NULL   UNIQUE   —  URL and FK-equivalent slug used across events and places
name          text        NOT NULL   —  display name e.g. "Tirana"
country       text        NOT NULL   —  e.g. "Albania"
country_code  text        NOT NULL   —  ISO 3166-1 alpha-2 e.g. "AL"
lat           float8      NOT NULL   —  map center latitude
lng           float8      NOT NULL   —  map center longitude
timezone      text        nullable   —  IANA timezone string e.g. "Europe/Tirane"
zoom          float8      NOT NULL   DEFAULT 12.5   —  default Mapbox zoom level for map centering
is_featured   boolean     NOT NULL   DEFAULT false   —  true = shown first in location pickers
created_at    timestamptz NOT NULL   DEFAULT now()
```

### Constraints

```sql
PRIMARY KEY (id)
UNIQUE (slug)
```

### Indexes

```
cities_pkey      —  btree on id
cities_slug_key  —  btree unique on slug
```

### RLS Policies

```
"cities_public_read"    —  FOR SELECT USING (true)
"cities_admin_write"    —  FOR ALL USING (is_admin())
```

### Ownership & Visibility

- Fully public read.
- Admin-only write. Cities are added or removed by the AlbaGo team, not by users.

### Lifecycle Notes

- `slug` on `cities` must match `location_slug` on `events` and `places`. There is no FK enforcing this — it is a soft reference. If a city slug ever changes (it never has), events and places must be bulk-updated.
- The application always reads from `cities` with a hardcoded fallback — if the `cities` query fails, `lib/locations.ts` returns the hardcoded array. This is intentional resilience.
- `timezone` is NULL for all current rows. It is reserved for future "events tonight in your timezone" logic.

---

## 9. Shared Infrastructure

### Functions

#### `is_admin()`

```sql
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean LANGUAGE sql SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
  );
$$;
```

**Role:** `SECURITY DEFINER` — executes as the function owner, bypassing RLS on `profiles`. This is intentional and correct: RLS policies use `is_admin()` as a predicate; if RLS were applied to the function itself, it would create a circular dependency.  
**Risk:** If `profiles` is ever modified (renamed, restructured), this function breaks silently. All RLS policies that call `is_admin()` would then fail open or closed depending on the error behavior.  
**Verification:** `SELECT is_admin();` as an anonymous session should return `false`. As a session with a row where `profiles.role = 'admin'`, it should return `true`.

---

#### `set_updated_at()`

```sql
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;
```

**Role:** Generic `BEFORE UPDATE` trigger function. Currently used only by `organizers`. Can be reused by any future table with an `updated_at` column — drop and recreate the trigger, not the function.

---

#### `create_organizer(...)`

```sql
-- SECURITY INVOKER — runs as the calling user; RLS still applies
CREATE OR REPLACE FUNCTION create_organizer(
  p_display_name text, p_slug text, p_contact_email text, p_website_url text,
  p_event_types text[], p_attendee_age_ranges text[],
  p_expected_attendance_size text, p_expected_yearly_revenue text, p_events_per_year text
) RETURNS uuid ...
```

**Role:** Atomic two-row write — `organizers` + `organizer_onboarding_responses`. Client calls this via `.rpc('create_organizer', {...})`. Returns the new organizer's UUID.  
**Error handling:** On UNIQUE violation for `organizers_slug_key` (slug collision), the client retries with a fresh suffix. On violation of `organizers_pkey` (user already has an organizer row), the client surfaces a "you already have an account" error.

---

#### `update_events_search_vector()` / `update_places_search_vector()`

```sql
-- Called by BEFORE INSERT OR UPDATE triggers on events and places
-- Rebuilds the search_vector tsvector from title/name + description + category
-- Uses 'simple' config (language-agnostic; no stemming)
```

**Role:** Keeps `search_vector` current automatically. No application code calls these directly.

---

### Functions Added in Phase 7B (not yet in production)

```
organizer_create_event(input jsonb) RETURNS uuid   SECURITY INVOKER
  —  Creates a new events row with status = 'draft'. Verifies organizer_id = auth.uid().

organizer_submit_event(event_id uuid) RETURNS void   SECURITY INVOKER
  —  Transitions draft → pending_review (or rejected → pending_review).
     Uses SELECT FOR UPDATE to prevent race conditions.

admin_publish_event(event_id uuid) RETURNS void   SECURITY INVOKER
  —  Transitions pending_review → published. Sets published_at = now(). Admin only.

admin_reject_event(event_id uuid, note text) RETURNS void   SECURITY INVOKER
  —  Transitions pending_review → rejected. Sets admin_note. Admin only.
```

Full SQL for all four is in `docs/phase-7b-plan.md §10`.

---

## 10. Access Control Summary

### Actor Definitions

| Actor | How identified |
|---|---|
| Anonymous (anon) | No JWT; Supabase `anon` role |
| Authenticated user | Valid JWT; Supabase `authenticated` role |
| Organizer | Authenticated + row exists in `organizers` WHERE id = auth.uid() |
| Admin | Authenticated + `profiles.role = 'admin'` (verified by `is_admin()`) |
| System | Supabase service role; used by server-side RPCs only |

### Permission Matrix

| Table | Anon | Auth user | Organizer (own) | Admin |
|---|---|---|---|---|
| `profiles` | ❌ | read own | read own | read/write all |
| `events` (published) | ✅ read | ✅ read | ✅ read | ✅ all |
| `events` (draft/pending/rejected) | ❌ | ❌ | ✅ read own | ✅ all |
| `events` INSERT | ❌ | ❌ | via RPC only | ✅ direct |
| `events` UPDATE/state change | ❌ | ❌ | via RPC only | via RPC only |
| `event_submissions` | ❌ | read/insert own | read/insert own | ✅ read + update |
| `places` | ✅ read | ✅ read | ✅ read | ✅ all |
| `saved_events` | ❌ | CRUD own | CRUD own | Studio only |
| `organizers` | ✅ read | ✅ read | read + update own | ✅ all |
| `organizer_onboarding_responses` | ❌ | read/write own | read/write own | ✅ read |
| `cities` | ✅ read | ✅ read | ✅ read | ✅ all |

**Hard rule (from `platform-architecture.md` §7):**  
`RLS = security boundary` | `RPC = transactional boundary` | `Server guard = UX gate` | `Frontend = display only`  
Never rely on frontend checks for security. RLS is the final enforcer.

---

## 11. Schema Evolution Rules

These rules apply to every future migration:

1. **Update this document before writing migration SQL.** The document is the spec; the migration executes the spec.

2. **All migrations are additive.** Adding columns, constraints, and indexes is safe. Dropping or renaming columns or tables requires a multi-phase deprecation (old column stays, new column added, code migrated, old column dropped in a later phase).

3. **No ENUM types.** Use `text` with CHECK constraints. ENUMs are harder to alter in Postgres — adding a new value requires `ALTER TYPE`, which locks the table. CHECK on text only locks during the constraint add (cheap).

4. **No `quantity_sold` or any column that is a cached aggregate.** Use a Postgres function that computes from the source table (e.g. `remaining_tickets()` from `ticket_purchases` COUNT). Cached aggregates create race conditions under concurrent writes.

5. **New lifecycle states (e.g. `cancelled`, `completed` on events) must be added to:**
   - This document (schema-reference.md)
   - The CHECK constraint migration
   - The RLS policy review (does the new state need different visibility?)
   - The Public Visibility Audit in `docs/phase-7b-plan.md`
   - `types/backend.ts` EventStatus union

6. **New tables follow the established pattern:**
   - `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`
   - `created_at timestamptz NOT NULL DEFAULT now()`
   - `updated_at timestamptz NOT NULL DEFAULT now()` (if rows are mutated)
   - RLS enabled immediately (never ship a table without RLS)
   - At least one SELECT policy

7. **`organizer_id` foreign keys always use `ON DELETE SET NULL`.** Orphaned events are acceptable; cascading deletes on events when an organizer is removed are not.

8. **Do not add columns to `event_submissions`.** This table is a frozen pipeline shape. If new fields are needed for community submissions, create a sibling table.

---

## 12. Known Technical Debt

| Item | Severity | Location | Notes |
|---|---|---|---|
| `event_submissions.date` stored as text | Low | `event_submissions` | ISO date string, not date type. Cast at approval time. Fix in a future migration if it causes issues. |
| `events` RLS policy name "Enable read access for all users" is too broad | Medium | `events` RLS | Must be replaced with scoped policies before Phase 7B migration. |
| `AdminClient.tsx` does client-side `events.insert()` with hardcoded `status: 'published'` | Medium | `app/admin/AdminClient.tsx` | Bypasses state machine. Origin field will be wrong after 7B (`admin_seeded` default is correct for now). Move to RPC in Phase 7C. |
| `image_url` and `cover_image_url` both exist on `places` | Low | `places` | Duplication from Phase 1 additions. Reconcile when place editing UI is built. |
| No `updated_at` trigger on `events` | Low | `events` | `set_updated_at()` function exists but the trigger is not wired. Phase 7B RPC functions update `updated_at = now()` manually. |
| `profiles` RLS not documented | Low | `profiles` | Application only reads `role` in server components. Verify policies in Supabase dashboard. |
