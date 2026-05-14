# Phase 7B Plan — Event Lifecycle & Organizer Event Management

**Status:** Planning — awaiting approval  
**Prerequisites:** Phase 7A complete (organizers table, onboarding, dashboard skeleton)  
**Depends on:** `docs/platform-architecture.md` §4–§8

---

## Scope

Phase 7B wires the organizer dashboard to a real event lifecycle. No new public-facing UI; no ticketing; no payments. The deliverable is: an organizer can create a draft event, submit it for review, and track its moderation state. Admins can publish or reject from `/admin`. The public sees nothing until `status = 'published'`.

This plan covers:

1. Pending Phase 7A work (Commit 5)
2. Public Visibility Audit
3. Event schema v2
4. Event state machine
5. Ownership rules
6. Public visibility rules
7. Moderation transitions (RPC contracts)
8. Organizer edit permissions per state
9. Admin override permissions
10. SQL migration
11. Rollback strategy
12. Commit sequence

---

## 1. Pending Phase 7A — Commit 5 (Discoverability Card)

**Approved but not yet built.** Must ship before 7B implementation begins.

**Location:** `app/dashboard/page.tsx`, regular user view, after the saved-events section and before submissions.

**Logic:** Query `organizers` table for `user.id`. If no row, render a card linking to `/become-organizer`. If row exists, render a card linking to `/organizer`.

**Design:**
```
rounded-3xl border border-white/10 bg-white/[0.03] p-6
Building2 icon (blue-400)
"Organise events on AlbaGo" (no organizer row)  OR  "Organizer dashboard" (has row)
ArrowRight — links to /become-organizer OR /organizer
```

No database round-trip if the user already has an organizer row (the row check is a single `.maybeSingle()` and is done in the same `Promise.all` as other fetches).

**File change:** `app/dashboard/page.tsx` only. ~20 lines added to regular user view.

---

## 2. Public Visibility Audit

### Purpose

Every surface that reads from `events` must be classified before Phase 7B adds non-published statuses. A bug here would expose draft or rejected events to the public.

### Complete Query Inventory

All queries and writes touching the `events` table, as of Phase 7A completion:

| # | Surface | File | Line | Type | Status filter | Classification | Risk |
|---|---|---|---|---|---|---|---|
| 1 | Homepage featured events | `app/page.tsx` | ~148 | READ | `.eq('status','published')` | Must show published only | ✅ Safe |
| 2 | Homepage event count (stats) | `app/page.tsx` | ~155 | READ | `.eq('status','published')` | Must show published only | ✅ Safe |
| 3 | Homepage search autocomplete | `app/page.tsx` | ~212 | READ | `.eq('status','published')` | Must show published only | ✅ Safe |
| 4 | Events list — suggestions | `app/events/page.tsx` | ~159 | READ | `.eq('status','published')` | Must show published only | ✅ Safe |
| 5 | Events list — full-text search | `app/events/page.tsx` | ~188 | READ | `.eq('status','published')` | Must show published only | ✅ Safe |
| 6 | Events list — location filter | `app/events/page.tsx` | ~219 | READ | `.eq('status','published')` | Must show published only | ✅ Safe |
| 7 | Event detail page | `app/events/[slug]/page.tsx` | ~46 | READ | `.eq('status','published')` | Must show published only | ✅ Safe |
| 8 | Venue upcoming events | `app/places/[slug]/page.tsx` | ~71 | READ | `.eq('status','published')` | Must show published only | ✅ Safe |
| 9 | Admin dashboard count | `app/dashboard/page.tsx` | ~104 | READ | `.eq('status','published')` | Admin aggregate — correct | ✅ Safe |
| 10 | Saved events (PostgREST join) | `app/dashboard/page.tsx` | ~39 | READ | Via RLS (no explicit filter) | Per-user owned data | ⚠️ See note |
| 11 | Map events | `components/map/MapView.tsx` | ~93 | READ | `.eq('status','published')` | Must show published only | ✅ Safe |
| 12 | Admin approve (write) | `app/admin/AdminClient.tsx` | ~95 | WRITE | Hardcodes `status:'published'` | Admin action — acceptable now | ⚠️ See note |

**No query in the current codebase reads events without a status filter.**

### Item 10 — Saved Events PostgREST Join

```ts
supabase
  .from('saved_events')
  .select('saved_at, events ( id, slug, title, ... )')
  .eq('user_id', userId)
```

PostgREST evaluates RLS on the joined `events` table using the same session JWT. The existing `events` RLS policy grants SELECT only on `status = 'published'`. So:

- If a user saved an event that later moved to `draft` or `rejected`, the join will return `null` for the `events` column — not a security leak, but a UX gap.
- The `filter()` on the result already handles `row.events !== null`, so null joined rows are silently dropped.
- **No fix needed now.** Phase 7C will add a separate organizer-facing query that explicitly filters `organizer_id = auth.uid()` for drafts.

**Classification:** May show organizer-owned events in all states only after Phase 7C adds the organizer RLS SELECT policy. Until then, only published events are reachable via this join.

### Item 12 — Admin Client-Side Insert

```ts
// app/admin/AdminClient.tsx ~95
supabase.from('events').insert({ ..., status: 'published', ... })
```

This is a client-side `INSERT` that hardcodes `status: 'published'`. Risks:

1. It bypasses the state machine — there is no `pending_review` step for admin-seeded events.
2. The RLS INSERT policy for `events` currently allows authenticated users with `is_admin()` to insert. After Phase 7B, the INSERT policy will be removed from the client path entirely and replaced with an RPC function `admin_publish_event()`.

**Current risk level:** Medium. Acceptable until Phase 7C. No immediate fix required.

### Migration Risk Assessment

Adding `draft`, `pending_review`, `rejected` as valid status values is additive. All existing rows have `status = 'published'`. The CHECK constraint addition will pass without touching existing data. Every existing public query already filters `status = 'published'`. **Zero regression risk on existing public surfaces.**

The only queries that need updating in Phase 7B are the new organizer-dashboard queries (which don't exist yet).

### New surfaces added in Phase 7B and their required filters

| Surface | Actor | Required filter |
|---|---|---|
| Organizer event list | Organizer (owner) | `organizer_id = auth.uid()` — all statuses |
| Organizer event detail | Organizer (owner) | `organizer_id = auth.uid()` — all statuses |
| Admin moderation queue | Admin | `status = 'pending_review'` |
| Admin all-events view | Admin | No status filter (admin sees all) |

---

## 3. Event Schema v2

### New / Changed Columns

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `organizer_id` | `uuid` | YES | `NULL` | FK → `organizers(id)` ON DELETE SET NULL. NULL for admin-seeded and community-submitted events. |
| `origin` | `text` | NO | `'admin_seeded'` | CHECK constraint — see below. Set at creation, never updated. |
| `banner_url` | `text` | YES | `NULL` | Future: event banner image. Nullable now, used in Phase 7C+. |
| `published_at` | `timestamptz` | YES | `NULL` | Set by `admin_publish_event()` RPC on transition to published. |
| `status` | `text` | NO | `'published'` | ADD CHECK constraint. Default remains `'published'` for backward compat during migration. |

### CHECK Constraints

```sql
-- Add to events table
ALTER TABLE events
  ADD CONSTRAINT events_status_check
  CHECK (status IN ('draft', 'pending_review', 'published', 'rejected', 'cancelled', 'completed'));

ALTER TABLE events
  ADD CONSTRAINT events_origin_check
  CHECK (origin IN ('admin_seeded', 'organizer_dashboard', 'community_submission', 'imported'));
```

### Indexes

```sql
-- Organizer-facing: list all events for this organizer
CREATE INDEX events_organizer_id_status_idx
  ON events (organizer_id, status)
  WHERE organizer_id IS NOT NULL;

-- Moderation queue: admin pending review list
CREATE INDEX events_status_created_at_idx
  ON events (status, created_at DESC)
  WHERE status = 'pending_review';
```

### Full Schema (events table, post-7B)

```sql
-- Existing columns (unchanged)
id             uuid PRIMARY KEY DEFAULT gen_random_uuid()
title          text NOT NULL
slug           text UNIQUE NOT NULL
place_id       uuid REFERENCES places(id) ON DELETE SET NULL
category       text NOT NULL
description    text NOT NULL
date           date NOT NULL
time           text
price          text
highlight      boolean DEFAULT false
status         text NOT NULL DEFAULT 'published'
location_slug  text NOT NULL
country        text NOT NULL
region         text
created_at     timestamptz DEFAULT now()
updated_at     timestamptz DEFAULT now()

-- New in Phase 7B
organizer_id   uuid REFERENCES organizers(id) ON DELETE SET NULL
origin         text NOT NULL DEFAULT 'admin_seeded'
banner_url     text
published_at   timestamptz
```

---

## 4. Event State Machine

### States

| State | Description |
|---|---|
| `draft` | Created by organizer, not submitted. Visible only to owner and admin. |
| `pending_review` | Submitted by organizer, awaiting admin decision. Read-only for organizer. |
| `published` | Approved by admin. Visible to all. Organizer may request minor edits (Phase 7C). |
| `rejected` | Rejected by admin. Visible to organizer and admin. Admin note attached. |
| `cancelled` | Future state. Organizer or admin marks event cancelled after publishing. |
| `completed` | Future state. Automatic or manual after event date passes. |

### Transitions

```
draft ──[organizer submits]──► pending_review
          ▲
          │ [admin sends back] (Phase 7C)
          │
pending_review ──[admin publishes]──► published
pending_review ──[admin rejects]───► rejected
rejected ──[organizer revises + resubmits]──► pending_review
published ──[admin or organizer cancels]──► cancelled   (Phase 7D)
published ──[date passes]──────────────► completed      (future automation)
```

### Forbidden transitions

| From | To | Who | Why forbidden |
|---|---|---|---|
| `draft` | `published` | Anyone | Bypass review — blocked by RLS |
| `pending_review` | `draft` | Organizer | In-flight lock — organizer cannot withdraw; admin returns it |
| `published` | `draft` | Anyone | Demotion path not in scope |
| `rejected` | `published` | Organizer | Cannot self-publish — must go through review |
| Any | Any | Client-side direct UPDATE | All transitions via RPC only |

### RPC Function Contracts

All state transitions are Postgres RPC functions, `SECURITY INVOKER`. The client **never** issues a raw `UPDATE events SET status = ...`.

```
organizer_submit_event(event_id uuid) → void
  - Caller must own event (organizer_id = auth.uid())
  - Allowed FROM states: draft, rejected
  - Sets status = 'pending_review'
  - Raises exception if not owner or wrong state

admin_publish_event(event_id uuid) → void
  - Caller must be admin (is_admin())
  - Allowed FROM states: pending_review
  - Sets status = 'published', published_at = now()
  - Raises exception if not admin or wrong state

admin_reject_event(event_id uuid, note text) → void
  - Caller must be admin (is_admin())
  - Allowed FROM states: pending_review
  - Sets status = 'rejected'
  - Writes note to new events.admin_note column
  - Raises exception if not admin or wrong state
```

**No UPDATE RLS policy for events.** All state changes route through these functions.

---

## 5. Ownership Rules

### Who owns an event?

| Field | Value | Meaning |
|---|---|---|
| `organizer_id` | uuid (set) | Event created via organizer dashboard. Owner = `organizers` row with that id. |
| `organizer_id` | NULL, `origin = 'admin_seeded'` | Admin-created event. No organizer owner. |
| `organizer_id` | NULL, `origin = 'community_submission'` | Promoted from `event_submissions`. No organizer owner (submitted anonymously or by unverified user). |

### Ownership transfer

Not supported in Phase 7B. Tracked as a future admin capability.

### Cascading behavior

- `organizers` row deleted → `events.organizer_id` SET NULL (event remains, orphaned).
- Orphaned events retain their `status`. A published orphaned event stays published.
- A pending/draft orphaned event becomes unreachable by any organizer — admin must handle manually.

This is the correct behavior: hard deleting an organizer does not unpublish their events.

---

## 6. Public Visibility Rules

### Per-actor, per-state matrix

| State | Anon / Public | Auth user (non-organizer) | Owning organizer | Admin |
|---|---|---|---|---|
| `draft` | ❌ | ❌ | ✅ read + edit | ✅ read + all transitions |
| `pending_review` | ❌ | ❌ | ✅ read only (no edit) | ✅ read + publish/reject |
| `published` | ✅ | ✅ | ✅ read (limited edit in 7C) | ✅ read + cancel |
| `rejected` | ❌ | ❌ | ✅ read + edit + resubmit | ✅ read + transitions |
| `cancelled` | ❌ (future) | ❌ (future) | ✅ read | ✅ read |
| `completed` | ✅ (future) | ✅ (future) | ✅ read | ✅ read |

### RLS Policy Design

```sql
-- SELECT: Public sees only published
CREATE POLICY events_select_published ON events
  FOR SELECT USING (status = 'published');

-- SELECT: Organizer sees their own events in any state
CREATE POLICY events_select_owner ON events
  FOR SELECT USING (organizer_id = auth.uid());

-- SELECT: Admin sees all
CREATE POLICY events_select_admin ON events
  FOR SELECT USING (is_admin());

-- INSERT: Organizer inserts their own events (draft only — enforced by RPC)
CREATE POLICY events_insert_organizer ON events
  FOR INSERT WITH CHECK (
    organizer_id = auth.uid()
    AND status = 'draft'
    AND origin = 'organizer_dashboard'
  );

-- INSERT: Admin inserts (admin_seeded) — existing, keep
CREATE POLICY events_insert_admin ON events
  FOR INSERT WITH CHECK (is_admin());

-- UPDATE: No direct UPDATE policy — all state changes via RPC
-- (Field edits for draft/rejected events handled by RPC in Phase 7C)

-- DELETE: Admin only (soft preferred)
CREATE POLICY events_delete_admin ON events
  FOR DELETE USING (is_admin());
```

**Hard rule:** No UPDATE RLS policy on `events` for any actor. Edits and transitions are RPC-only.

---

## 7. Moderation Transitions — Full RPC Specs

### `organizer_create_event(input jsonb) → uuid`

Creates a new event row with `status = 'draft'`.

```sql
CREATE OR REPLACE FUNCTION organizer_create_event(input jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_organizer_id uuid;
  v_event_id uuid;
BEGIN
  -- Caller must be an organizer
  SELECT id INTO v_organizer_id FROM organizers WHERE id = auth.uid();
  IF v_organizer_id IS NULL THEN
    RAISE EXCEPTION 'not_organizer';
  END IF;

  INSERT INTO events (
    title, slug, category, description, date, time, price,
    location_slug, country, region, place_id,
    organizer_id, origin, status
  )
  VALUES (
    input->>'title',
    input->>'slug',
    input->>'category',
    input->>'description',
    (input->>'date')::date,
    input->>'time',
    input->>'price',
    input->>'location_slug',
    input->>'country',
    input->>'region',
    (input->>'place_id')::uuid,
    v_organizer_id,
    'organizer_dashboard',
    'draft'
  )
  RETURNING id INTO v_event_id;

  RETURN v_event_id;
END;
$$;
```

### `organizer_submit_event(event_id uuid) → void`

Transitions `draft` or `rejected` → `pending_review`.

```sql
CREATE OR REPLACE FUNCTION organizer_submit_event(event_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_status text;
BEGIN
  SELECT status INTO v_status
  FROM events
  WHERE id = event_id AND organizer_id = auth.uid()
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found_or_not_owner';
  END IF;

  IF v_status NOT IN ('draft', 'rejected') THEN
    RAISE EXCEPTION 'invalid_transition: % → pending_review', v_status;
  END IF;

  UPDATE events
  SET status = 'pending_review', updated_at = now()
  WHERE id = event_id;
END;
$$;
```

### `admin_publish_event(event_id uuid) → void`

Transitions `pending_review` → `published`.

```sql
CREATE OR REPLACE FUNCTION admin_publish_event(event_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_status text;
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'not_admin';
  END IF;

  SELECT status INTO v_status FROM events WHERE id = event_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found';
  END IF;

  IF v_status <> 'pending_review' THEN
    RAISE EXCEPTION 'invalid_transition: % → published', v_status;
  END IF;

  UPDATE events
  SET status = 'published', published_at = now(), updated_at = now()
  WHERE id = event_id;
END;
$$;
```

### `admin_reject_event(event_id uuid, note text) → void`

Transitions `pending_review` → `rejected`.

```sql
CREATE OR REPLACE FUNCTION admin_reject_event(event_id uuid, note text)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_status text;
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'not_admin';
  END IF;

  SELECT status INTO v_status FROM events WHERE id = event_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found';
  END IF;

  IF v_status <> 'pending_review' THEN
    RAISE EXCEPTION 'invalid_transition: % → rejected', v_status;
  END IF;

  UPDATE events
  SET status = 'rejected', admin_note = note, updated_at = now()
  WHERE id = event_id;
END;
$$;
```

---

## 8. Organizer Edit Permissions Per State

| Field group | `draft` | `pending_review` | `published` | `rejected` |
|---|---|---|---|---|
| title, description, category | ✅ edit | ❌ locked | ❌ locked (7C: request edit) | ✅ edit |
| date, time, price | ✅ edit | ❌ locked | ❌ locked | ✅ edit |
| location_slug, place_id | ✅ edit | ❌ locked | ❌ locked | ✅ edit |
| banner_url | ✅ edit | ❌ locked | ❌ locked | ✅ edit |
| status | via RPC only | via RPC only | via RPC only | via RPC only |
| organizer_id | ❌ never | ❌ never | ❌ never | ❌ never |
| origin | ❌ never | ❌ never | ❌ never | ❌ never |
| published_at | ❌ never | ❌ never | ❌ never | ❌ never |

**Implementation:** Phase 7B delivers `draft` create only. Edit form ships in Phase 7C. The RPC contracts are defined here to constrain Phase 7C design.

---

## 9. Admin Override Permissions

Admins can:

- View events in any state
- Transition `pending_review` → `published` or `rejected` via RPC
- Edit any field on any event directly (via Supabase dashboard or a future admin UI — not via organizer form)
- Delete any event (hard delete — admin-only)
- Override `status` directly in Supabase dashboard (emergency use only — bypasses audit trail)

Admins cannot (by design):

- Approve a `draft` that was never submitted (must go through pending_review)
- Create events on behalf of an organizer (admin-seeded events have `organizer_id = NULL`)

**Admin note column:** `admin_note text` is set on rejection. Admins can update it freely. Organizers see it read-only in their dashboard.

---

## 10. SQL Migration

Run in Supabase SQL editor. Copy-paste exactly.

```sql
-- ─── Phase 7B Migration ───────────────────────────────────────────────────────

BEGIN;

-- 1. New columns on events
ALTER TABLE events
  ADD COLUMN IF NOT EXISTS organizer_id  uuid REFERENCES organizers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS origin        text NOT NULL DEFAULT 'admin_seeded',
  ADD COLUMN IF NOT EXISTS banner_url    text,
  ADD COLUMN IF NOT EXISTS published_at  timestamptz,
  ADD COLUMN IF NOT EXISTS admin_note    text;

-- 2. CHECK constraints
ALTER TABLE events
  ADD CONSTRAINT events_status_check
  CHECK (status IN ('draft', 'pending_review', 'published', 'rejected', 'cancelled', 'completed'));

ALTER TABLE events
  ADD CONSTRAINT events_origin_check
  CHECK (origin IN ('admin_seeded', 'organizer_dashboard', 'community_submission', 'imported'));

-- 3. Back-fill existing rows (all existing events are admin_seeded and published)
UPDATE events
  SET origin = 'admin_seeded', published_at = created_at
  WHERE origin = 'admin_seeded' AND published_at IS NULL;

-- 4. Indexes
CREATE INDEX IF NOT EXISTS events_organizer_id_status_idx
  ON events (organizer_id, status)
  WHERE organizer_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS events_status_created_at_idx
  ON events (status, created_at DESC)
  WHERE status = 'pending_review';

-- 5. RLS policies (drop old if any, then add scoped policies)

-- Keep existing: public sees published
-- (If existing policy is named differently, check with: \d events in psql or Supabase policy UI)
-- Assumed existing policy name: "Enable read access for all users"
-- Replace it with named policies:

DROP POLICY IF EXISTS "Enable read access for all users" ON events;

CREATE POLICY events_select_published ON events
  FOR SELECT USING (status = 'published');

CREATE POLICY events_select_owner ON events
  FOR SELECT USING (organizer_id = auth.uid());

CREATE POLICY events_select_admin ON events
  FOR SELECT USING (is_admin());

-- INSERT: organizer creates draft
CREATE POLICY events_insert_organizer ON events
  FOR INSERT WITH CHECK (
    organizer_id = auth.uid()
    AND status = 'draft'
    AND origin = 'organizer_dashboard'
  );

-- INSERT: admin creates seeded event (keep existing or add)
DROP POLICY IF EXISTS "Admins can insert events" ON events;
CREATE POLICY events_insert_admin ON events
  FOR INSERT WITH CHECK (is_admin());

-- DELETE: admin only
DROP POLICY IF EXISTS "Admins can delete events" ON events;
CREATE POLICY events_delete_admin ON events
  FOR DELETE USING (is_admin());

-- No UPDATE policy — all mutations via RPC

-- 6. RPC: organizer_create_event
CREATE OR REPLACE FUNCTION organizer_create_event(input jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_organizer_id uuid;
  v_event_id uuid;
BEGIN
  SELECT id INTO v_organizer_id FROM organizers WHERE id = auth.uid();
  IF v_organizer_id IS NULL THEN
    RAISE EXCEPTION 'not_organizer';
  END IF;

  INSERT INTO events (
    title, slug, category, description, date, time, price,
    location_slug, country, region, place_id,
    organizer_id, origin, status
  )
  VALUES (
    input->>'title',
    input->>'slug',
    input->>'category',
    input->>'description',
    (input->>'date')::date,
    input->>'time',
    input->>'price',
    input->>'location_slug',
    input->>'country',
    input->>'region',
    CASE WHEN input->>'place_id' IS NOT NULL THEN (input->>'place_id')::uuid END,
    v_organizer_id,
    'organizer_dashboard',
    'draft'
  )
  RETURNING id INTO v_event_id;

  RETURN v_event_id;
END;
$$;

-- 7. RPC: organizer_submit_event
CREATE OR REPLACE FUNCTION organizer_submit_event(event_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_status text;
BEGIN
  SELECT status INTO v_status
  FROM events
  WHERE id = event_id AND organizer_id = auth.uid()
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found_or_not_owner';
  END IF;

  IF v_status NOT IN ('draft', 'rejected') THEN
    RAISE EXCEPTION 'invalid_transition: cannot move % to pending_review', v_status;
  END IF;

  UPDATE events SET status = 'pending_review', updated_at = now() WHERE id = event_id;
END;
$$;

-- 8. RPC: admin_publish_event
CREATE OR REPLACE FUNCTION admin_publish_event(event_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_status text;
BEGIN
  IF NOT is_admin() THEN RAISE EXCEPTION 'not_admin'; END IF;

  SELECT status INTO v_status FROM events WHERE id = event_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
  IF v_status <> 'pending_review' THEN
    RAISE EXCEPTION 'invalid_transition: cannot publish from %', v_status;
  END IF;

  UPDATE events SET status = 'published', published_at = now(), updated_at = now() WHERE id = event_id;
END;
$$;

-- 9. RPC: admin_reject_event
CREATE OR REPLACE FUNCTION admin_reject_event(event_id uuid, note text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_status text;
BEGIN
  IF NOT is_admin() THEN RAISE EXCEPTION 'not_admin'; END IF;

  SELECT status INTO v_status FROM events WHERE id = event_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
  IF v_status <> 'pending_review' THEN
    RAISE EXCEPTION 'invalid_transition: cannot reject from %', v_status;
  END IF;

  UPDATE events SET status = 'rejected', admin_note = note, updated_at = now() WHERE id = event_id;
END;
$$;

COMMIT;
```

---

## 11. Verification Queries

Run after migration to confirm correctness.

```sql
-- 1. All existing events still have status = 'published' and origin = 'admin_seeded'
SELECT status, origin, COUNT(*) FROM events GROUP BY 1, 2;
-- Expected: published | admin_seeded | <N>

-- 2. CHECK constraint is active
INSERT INTO events (title, slug, category, description, date, location_slug, country, status, origin)
VALUES ('test', 'test-zzz', 'test', 'test', '2099-01-01', 'tirana', 'Albania', 'invalid_status', 'admin_seeded');
-- Expected: ERROR - violates check constraint "events_status_check"
ROLLBACK;

-- 3. organizer_create_event RPC exists
SELECT routine_name FROM information_schema.routines WHERE routine_name = 'organizer_create_event';
-- Expected: 1 row

-- 4. organizer_submit_event RPC exists
SELECT routine_name FROM information_schema.routines WHERE routine_name = 'organizer_submit_event';
-- Expected: 1 row

-- 5. admin_publish_event RPC exists
SELECT routine_name FROM information_schema.routines WHERE routine_name = 'admin_publish_event';
-- Expected: 1 row

-- 6. admin_reject_event RPC exists
SELECT routine_name FROM information_schema.routines WHERE routine_name = 'admin_reject_event';
-- Expected: 1 row

-- 7. Indexes exist
SELECT indexname FROM pg_indexes WHERE tablename = 'events' AND indexname LIKE 'events_%_idx';
-- Expected: events_organizer_id_status_idx, events_status_created_at_idx

-- 8. Three SELECT policies exist on events
SELECT policyname FROM pg_policies WHERE tablename = 'events' AND cmd = 'SELECT';
-- Expected: events_select_published, events_select_owner, events_select_admin
```

---

## 12. Rollback Strategy

All changes are additive (new columns, constraints, policies, functions). No existing data is modified except the `published_at` backfill on existing rows.

### Rollback SQL

```sql
BEGIN;

-- Remove RPC functions
DROP FUNCTION IF EXISTS organizer_create_event(jsonb);
DROP FUNCTION IF EXISTS organizer_submit_event(uuid);
DROP FUNCTION IF EXISTS admin_publish_event(uuid);
DROP FUNCTION IF EXISTS admin_reject_event(uuid, text);

-- Remove new RLS policies
DROP POLICY IF EXISTS events_select_published ON events;
DROP POLICY IF EXISTS events_select_owner ON events;
DROP POLICY IF EXISTS events_select_admin ON events;
DROP POLICY IF EXISTS events_insert_organizer ON events;
DROP POLICY IF EXISTS events_insert_admin ON events;
DROP POLICY IF EXISTS events_delete_admin ON events;

-- Restore original catch-all SELECT policy (adjust name to match original)
CREATE POLICY "Enable read access for all users" ON events FOR SELECT USING (true);

-- Remove indexes
DROP INDEX IF EXISTS events_organizer_id_status_idx;
DROP INDEX IF EXISTS events_status_created_at_idx;

-- Remove CHECK constraints
ALTER TABLE events DROP CONSTRAINT IF EXISTS events_status_check;
ALTER TABLE events DROP CONSTRAINT IF EXISTS events_origin_check;

-- Remove new columns
ALTER TABLE events
  DROP COLUMN IF EXISTS organizer_id,
  DROP COLUMN IF EXISTS origin,
  DROP COLUMN IF EXISTS banner_url,
  DROP COLUMN IF EXISTS published_at,
  DROP COLUMN IF EXISTS admin_note;

COMMIT;
```

**Note:** The original `"Enable read access for all users"` policy name must match what is currently in Supabase. Verify in the Supabase table editor → Authentication → Policies before running rollback.

---

## 13. Commit Sequence

### Commit 5 (Phase 7A, pending) — Discoverability card on /dashboard

**Files:** `app/dashboard/page.tsx`  
**Scope:** ~20 lines. Add organizer row check to regular user view. Render card linking to `/become-organizer` or `/organizer`.  
**No migration required.**

---

### Commit 6 — Event schema v2 (migration only)

**Files:** `docs/phase-7b-plan.md` (already written)  
**Action:** User runs migration SQL in Supabase. Verify with verification queries. No code changes in this commit — the doc is the deliverable.

---

### Commit 7 — `lib/events-organizer.ts` + updated `types/event.ts`

**Files:**
- `types/event.ts` — add `organizer_id`, `origin`, `banner_url`, `published_at`, `admin_note` fields; keep `PublicEvent` as-is; add `OrganizerEvent` type that includes all statuses
- `lib/events-organizer.ts` — `fetchOrganizerEvents()`, `createOrganizerEvent()`, `submitOrganizerEvent()`

---

### Commit 8 — Organizer event list + create-event form

**Files:**
- `app/organizer/page.tsx` — fetch real events via `fetchOrganizerEvents()`; update status counts
- `app/organizer/OrganizerDashboardClient.tsx` — wire real counts; enable "Create event" button; link to `/organizer/create`
- `app/organizer/create/page.tsx` (new) — server guard; renders `<CreateEventClient />`
- `app/organizer/create/CreateEventClient.tsx` (new) — multi-step create form; calls `createOrganizerEvent()` RPC; on success redirect to `/organizer/events/[id]`

---

### Commit 9 — Organizer event detail + submit action

**Files:**
- `app/organizer/events/[id]/page.tsx` (new) — server guard + owner check; renders `<OrganizerEventDetailClient />`
- `app/organizer/events/[id]/OrganizerEventDetailClient.tsx` (new) — shows event detail, current state badge, "Submit for review" button (draft/rejected), locked message (pending_review), admin note (rejected)

---

### Commit 10 — Admin moderation UI

**Files:**
- `app/admin/AdminClient.tsx` — add pending events list; "Publish" and "Reject" actions via `admin_publish_event()` / `admin_reject_event()` RPCs; rejection reason input
- Remove client-side `events.insert()` call (migrate to RPC or leave admin-seeded as Supabase-direct for now)

---

## 14. Out of Scope for Phase 7B

These are deliberately deferred:

- Event editing after creation (Phase 7C)
- Banner image upload (Phase 7C — requires storage bucket)
- Organizer event search / filter (Phase 7C)
- Published event "request edit" workflow (Phase 7C)
- Event cancellation (Phase 7D)
- Ticketing and capacity (Phase 7E)
- Admin note editing after rejection (Phase 7C admin UI)
- Pagination on organizer event list (Phase 7C)

---

## Binding Decisions

These are fixed for all Phase 7B implementation. Any deviation requires explicit approval.

| # | Decision |
|---|---|
| D1 | No UPDATE RLS policy on `events`. All mutations via RPC. |
| D2 | `origin` column is set at creation and never updated. |
| D3 | `admin_note` is on the `events` row, not a separate table. Phase 7B scope only; a separate `event_moderation_log` table is a Phase 7C option. |
| D4 | `published_at` is NULL until `admin_publish_event()` runs. Backfill sets it to `created_at` for legacy rows. |
| D5 | Organizer cannot withdraw a pending event. Admin must send it back to draft (Phase 7C). |
| D6 | Commit 5 (discoverability card) ships before any 7B code. |
| D7 | All RPC functions are `SECURITY INVOKER`. No `SECURITY DEFINER`. |
| D8 | `organizer_id = NULL` is the canonical signal for admin-seeded or community-submitted events. No separate boolean flag. |
