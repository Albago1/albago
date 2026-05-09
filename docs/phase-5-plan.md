# Phase 5 — Saved Events

**Status:** Plan — awaiting approval before implementation
**Depends on:** Phase 4 complete (event detail pages — saving needs events to be addressable, which they now are)
**Goal:** Let authenticated users save events to a personal list and view them on the dashboard.

---

## What Phase 5 does

Three concrete deliverables:

1. **`saved_events` table** in Supabase with strict RLS (users see/insert/delete only their own rows).

2. **Heart button on every event card surface** — homepage Featured Events, events page list, event detail page. Click toggles save/unsave with optimistic UI. Anonymous users are redirected to `/sign-in?next=...` so they return to where they were.

3. **Dashboard "Saved events" section** — server-rendered list of the user's saved events, with the same card design as `/events` plus an unsave control. Empty state when nothing is saved.

### What Phase 5 deliberately does NOT do

- No saved venues / places (only events)
- No collections, tags, or named lists — single flat list per user
- No social sharing of saved events / public profile pages
- No notifications when saved events are updated, cancelled, or postponed
- No "recently viewed" or "interested" beyond the binary saved state
- No keyboard shortcuts, no drag-to-sort
- No analytics / save counts visible to organizers (privacy by default)

---

## Schema

### Migration SQL (you run manually in Supabase SQL editor)

```sql
-- Create the table
CREATE TABLE IF NOT EXISTS saved_events (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id   uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  event_id  uuid NOT NULL REFERENCES events(id)   ON DELETE CASCADE,
  saved_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, event_id)
);

-- Index for the dashboard "list my saves" query
CREATE INDEX IF NOT EXISTS saved_events_user_id_idx ON saved_events(user_id);

-- Enable RLS
ALTER TABLE saved_events ENABLE ROW LEVEL SECURITY;

-- Users can read their own saves
CREATE POLICY saved_events_select_own ON saved_events
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Users can insert saves only with their own user_id
CREATE POLICY saved_events_insert_own ON saved_events
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Users can delete only their own saves
CREATE POLICY saved_events_delete_own ON saved_events
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());
```

Verification (run after the migration):

```sql
-- 1. Table exists with correct columns
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'saved_events' ORDER BY ordinal_position;
-- Expected: id (uuid), user_id (uuid), event_id (uuid), saved_at (timestamptz)

-- 2. RLS enabled
SELECT relname, relrowsecurity FROM pg_class WHERE relname = 'saved_events';
-- Expected: relrowsecurity = true

-- 3. Policies exist
SELECT policyname, cmd FROM pg_policies WHERE tablename = 'saved_events';
-- Expected: 3 rows — saved_events_select_own (SELECT),
--                    saved_events_insert_own (INSERT),
--                    saved_events_delete_own (DELETE)
```

---

## Files to touch

| File | Action | What |
|---|---|---|
| `lib/savedEvents.ts` | **NEW** | Helper functions: `fetchSavedEventIds(supabase)`, `saveEvent(supabase, eventId)`, `unsaveEvent(supabase, eventId)`. All take a `SupabaseClient` arg so they work in both server and browser contexts. |
| `components/SaveEventButton.tsx` | **NEW** | Client component. Heart icon (filled vs outline). Anonymous → `router.push('/sign-in?next=...')`. Logged-in → optimistic toggle, calls helper. Shows a brief lock state while the request is in flight to prevent double-clicks. |
| `app/page.tsx` | Modify | Render `<SaveEventButton eventId={event.id} initialSaved={savedIds.has(event.id)} />` on each Featured Events card. Fetch `savedIds` once when the user is logged in. |
| `app/events/page.tsx` | Modify | Same pattern: fetch `savedIds` once, render heart on each list card. |
| `app/events/[slug]/page.tsx` | Modify | Server-side: pass `initialSaved` (boolean) to a new `<SaveEventButton>`. Render near the existing CTAs. |
| `app/dashboard/page.tsx` | Modify | Add a "Saved events" section to the regular-user view. Optional: also add a smaller version to the admin view (defer if it complicates the layout). Server-side fetch joins `saved_events` to `events` for the cards. |
| `docs/phase-5-plan.md` | NEW | This plan |

**Seven files: three new, four modified.**

---

## Component design

### `lib/savedEvents.ts`

Thin wrapper functions. No business logic beyond the queries.

```ts
import type { SupabaseClient } from '@supabase/supabase-js'

export async function fetchSavedEventIds(
  supabase: SupabaseClient
): Promise<Set<string>> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Set()
  const { data } = await supabase
    .from('saved_events').select('event_id').eq('user_id', user.id)
  return new Set((data ?? []).map((r) => r.event_id))
}

export async function saveEvent(
  supabase: SupabaseClient,
  eventId: string
): Promise<{ error: string | null }> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'not_authenticated' }
  const { error } = await supabase
    .from('saved_events').insert({ user_id: user.id, event_id: eventId })
  return { error: error?.message ?? null }
}

export async function unsaveEvent(
  supabase: SupabaseClient,
  eventId: string
): Promise<{ error: string | null }> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'not_authenticated' }
  const { error } = await supabase
    .from('saved_events').delete()
    .eq('user_id', user.id).eq('event_id', eventId)
  return { error: error?.message ?? null }
}
```

### `components/SaveEventButton.tsx`

Client component. Three pieces of internal state: `saved` (the optimistic value), `loading` (in-flight lock), and an internal effect to refresh truth from DB on mount when initialSaved is undefined.

Pseudo-shape:

```tsx
'use client'
type Props = {
  eventId: string
  initialSaved: boolean
  size?: 'sm' | 'md'  // size variant for cards (sm) vs detail page (md)
}
```

Behavior:
- Anonymous (auth check on click): `router.push('/sign-in?next=' + encodeURIComponent(currentPath))`
- Logged in + not saved: optimistically flip to saved → call `saveEvent` → on error, revert and show toast or alert
- Logged in + saved: optimistic flip to unsaved → call `unsaveEvent` → on error, revert
- Disabled (`loading`) for ~150ms during the request to prevent double-clicks

Accessibility:
- `aria-pressed={saved}`
- `aria-label={saved ? 'Saved' : 'Save event'}`
- Icon only on cards (`size='sm'`); icon + label on detail page (`size='md'`)

### Card placement

Heart sits in the top-right of each card, replacing the current "Hot" badge position when both are present (Hot stays — they coexist, heart is to the right of Hot). On the detail page, heart goes inline with the existing CTA row.

To avoid the heart being a click target inside the `<Link>` wrapper that takes the user to the detail page: stop event propagation on heart click (`e.stopPropagation(); e.preventDefault()`). The card stays clickable; the heart toggles independently.

---

## Dashboard section design

Regular user view: insert a "Saved events" section above the existing "My submissions" section.

```
┌─────────────────────────────────────────┐
│ My Dashboard                            │
│ user@example.com                        │
├─────────────────────────────────────────┤
│ SAVED EVENTS                            │
│  ┌──────────┐  ┌──────────┐             │
│  │ card     │  │ card     │  ← unsave   │
│  └──────────┘  └──────────┘             │
├─────────────────────────────────────────┤
│ MY SUBMISSIONS                          │
│  ...existing...                         │
└─────────────────────────────────────────┘
```

Empty state: "You haven't saved any events yet. Browse events to get started." with a CTA to `/events`.

Admin view: same Saved section appears above the admin stats. Smaller. (If layout gets crowded, defer admin view — admins can use a regular account for testing. Decide during implementation.)

---

## Test checklist

### SQL pre-flight (run before any UI work)

| # | Check | Expected |
|---|---|---|
| S1 | Run migration SQL | Returns success, no errors |
| S2 | `\d saved_events` (or column query) | Table has id, user_id, event_id, saved_at |
| S3 | RLS enabled | `relrowsecurity = true` |
| S4 | 3 policies exist | select_own, insert_own, delete_own |

### Browser tests (after implementation)

| # | Test | Expected |
|---|---|---|
| 1 | Logged-out user sees heart on `/events` cards | Heart renders as outline |
| 2 | Logged-out user clicks heart | Redirected to `/sign-in?next=/events` |
| 3 | After sign-in via that flow | Lands back on `/events` |
| 4 | Logged-in user clicks heart on `/events` card | Heart fills immediately (optimistic), no full page reload |
| 5 | Reload `/events` | Heart still filled (truth comes from DB on next load) |
| 6 | Click filled heart | Heart goes outline, DB row deleted |
| 7 | Save an event on `/events`, then visit `/` | If event is in Featured Events, heart shows filled there too |
| 8 | Visit `/events/{slug}` for a saved event | Heart on detail page shows filled |
| 9 | Save an event on detail page | Heart fills; reload page; still filled |
| 10 | Open `/dashboard` as a regular user with 2 saved events | Saved Events section shows 2 cards |
| 11 | Click unsave on a dashboard card | Card disappears, DB row deleted |
| 12 | Click unsave on the last saved event | Empty state appears with browse-events CTA |
| 13 | Logged-out user visits `/dashboard` | Redirected to sign-in (existing behavior, regression check) |
| 14 | Two browsers: User A saves an event; User B visits same event detail page | User B sees outline heart (RLS isolation) |
| 15 | User A's saves invisible to User B in Supabase logs | RLS isolation confirmed |
| 16 | Build passes | `npm run build` → 0 TS errors, all routes still listed |
| 17 | Click heart twice rapidly | No double-save (UNIQUE constraint or in-flight lock prevents it); UI ends in correct state |
| 18 | Network throttle, click heart | Optimistic UI flips immediately; if DB rejects, UI reverts |

---

## Risks and mitigations

**Optimistic UI drift**
The heart shows the optimistic value before the server confirms. If the server rejects (RLS misconfigured, network drop), the user thinks it's saved when it isn't. **Mitigation:** on error, revert UI and surface a non-blocking message ("Couldn't save — try again"). Don't silently swallow errors.

**Heart click bubbling to card link**
Cards are wrapped in `<Link>` so the whole card is clickable. The heart must not navigate. **Mitigation:** `onClick={(e) => { e.stopPropagation(); e.preventDefault(); ... }}`.

**Hydration mismatch**
SSR renders the homepage / events page anonymously (no auth). Client hydrates and may know the user is logged in. If the server renders heart-outline and the client immediately flips to filled, there's a flash. **Mitigation:** always render outline on first paint, then fetch `savedIds` in a client effect and update. Acceptable: 100ms heart-fill latency on logged-in pageload. Avoids hydration warnings.

**RLS misconfiguration**
If the INSERT policy has the wrong check, users could insert saves on others' behalf or fail to insert their own. **Mitigation:** the policies use `auth.uid()` directly. Verify in test 14 (two-user isolation).

**Race: same event saved twice**
The UNIQUE(user_id, event_id) constraint catches it at the DB level. The client-side `loading` lock catches it at the UI level. Both layers; harmless if one fails.

**ON DELETE CASCADE on `events`**
If an admin deletes an event, all `saved_events` rows referencing it disappear. This is correct behavior — the saved item no longer exists. No user-visible error since the dashboard query joins to `events`; the row simply isn't returned.

**Dashboard performance**
A power user with hundreds of saves would do a single query joined to `events`. Postgres handles this trivially with the `user_id` index. No pagination needed for a long time.

**SSR vs client Supabase client**
The dashboard server component uses `lib/supabase/server.ts` (cookies-aware). The card components use `lib/supabase/browser.ts`. The helpers in `lib/savedEvents.ts` accept a `SupabaseClient` so both contexts can call them.

---

## Order of execution

1. You run the migration SQL in Supabase SQL editor and confirm SQL pre-flight checks S1–S4.
2. Implement `lib/savedEvents.ts`.
3. Implement `<SaveEventButton>`.
4. Wire into `/events` cards. Run dev server, test browser tests 1–6.
5. Wire into `/` Featured Events. Test 7.
6. Wire into `/events/[slug]`. Test 8–9.
7. Add Saved Events section to `/dashboard` (regular user view first; admin view if straightforward). Test 10–13.
8. Run `npm run build`. Test 16.
9. Final pass on tests 14, 15, 17, 18.
10. Commit.

---

## Rollback plan

**App rollback:** revert the commit. Heart buttons disappear. Dashboard "Saved events" section disappears. No user data exposure.

**DB rollback:**
```sql
DROP TABLE IF EXISTS saved_events CASCADE;
```
No other tables reference `saved_events`, so CASCADE is a no-op. User saves are deleted (acceptable — feature is being rolled back).

---

## After Phase 5

Natural next steps, all independent:

1. **Saved venues** — symmetric `saved_places` table + heart on place cards. Small.
2. **Saved-events email digest** — weekly email with upcoming saved events. Bigger lift, needs cron + email infra.
3. **"Going" / "Interested" instead of just "Saved"** — three-state model. UI complication; defer until there's signal it matters.
4. **Public profile** showing curated saved events (opt-in). Privacy and abuse considerations; not soon.
