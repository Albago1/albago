# Phase 2 — Submission & Moderation

**Status:** Not yet implemented  
**Depends on:** Phase 1 complete (commit with Phase 1 changes deployed, SQL migration run)  
**Goal:** Close the submission pipeline — auth-gated submissions linked to real users, venue matching at submission time, user submission history, improved admin review workflow.

---

## What Phase 2 does

Three concrete improvements to the event submission → moderation → publish pipeline:

1. **Auth-gated submissions** — `/submit-event` redirects to sign-in if the user is not logged in. After sign-in, the user is returned to the form. All submissions are stored with `submitted_by_user_id` so they are traceable.

2. **Venue linkage in the form** — Instead of a free-text `venue_name` field, the form shows a searchable list of existing venues for the selected location. If the user picks an existing venue, the submission stores `place_id`. If no match, the typed name is stored as `venue_name` (new venue to be created by admin on approval).

3. **User dashboard + improved admin review** — Regular users see their own submission history with status badges in `/dashboard`. Admins get status filter tabs (All / Pending / Approved / Rejected), an optional admin note on reject, and the approve action correctly links the new event to the venue's `place_id` when available.

No existing data is touched. All SQL changes are additive (`IF NOT EXISTS`). The existing submission flow continues to work during the migration window.

---

## Step 1 — Supabase SQL migration

### 2a — Add missing columns to `event_submissions`

The `types/backend.ts` `BackendEventSubmission` type already defines these fields — they may not exist yet in the live DB.

```sql
ALTER TABLE event_submissions
  ADD COLUMN IF NOT EXISTS submitted_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS place_id             uuid REFERENCES places(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS admin_note           text,
  ADD COLUMN IF NOT EXISTS price                text;
```

> Run this even if you think the columns exist — `IF NOT EXISTS` makes it idempotent.

### 2b — RLS on `event_submissions`

The table currently has no RLS, meaning any authenticated or anonymous user can read all submissions. This must be locked down before shipping the user dashboard.

```sql
ALTER TABLE event_submissions ENABLE ROW LEVEL SECURITY;

-- Users can read their own submissions. Admins can read all.
CREATE POLICY "submissions_select"
  ON event_submissions FOR SELECT
  USING (submitted_by_user_id = auth.uid() OR is_admin());

-- Authenticated users can insert their own submissions only.
CREATE POLICY "submissions_insert"
  ON event_submissions FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND submitted_by_user_id = auth.uid());

-- Only admins can update (status changes, admin_note).
CREATE POLICY "submissions_admin_update"
  ON event_submissions FOR UPDATE
  USING (is_admin());
```

> **Note on existing rows:** Submissions inserted before this migration have `submitted_by_user_id = NULL`. They will be invisible to regular users (correct — no user owns them). Admins still see them via `is_admin()`.

---

## Step 2 — Files that need changes

### `app/submit-event/page.tsx`

**Current issues:**
- Imports from `@/lib/supabase/client` — this file does not exist. The correct path is `@/lib/supabase/browser`. This is a live bug.
- No auth gate — anyone can submit without an account.
- Venue is a free-text field — produces orphaned submissions with no `place_id`.
- No `price` field.

**Changes:**
1. Fix import: `@/lib/supabase/client` → `@/lib/supabase/browser`
2. On page load, call `supabase.auth.getUser()`. If no user, redirect to `/sign-in?next=/submit-event`.
3. Add venue search: when location changes, fetch venues for that `location_slug` from `places`. Render a scrollable list of venue buttons above the text input. Clicking a venue button sets `selectedPlaceId` state and fills the name field. User can clear the selection and type a new name. If `selectedPlaceId` is set, include `place_id` in the submission. Always include `venue_name` (as a human-readable fallback).
4. Add optional `price` text input (e.g. "Free", "800 ALL", "€10").
5. Include `submitted_by_user_id: user.id` in the inserted row.

**New state needed:**
```ts
const [user, setUser] = useState<User | null>(null)
const [venues, setVenues] = useState<{ id: string; name: string; category: string }[]>([])
const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null)
```

**Submission object changes:**
```ts
const submission = {
  // existing fields...
  price: String(formData.get('price')) || null,
  place_id: selectedPlaceId,
  submitted_by_user_id: user!.id,
}
```

---

### `app/sign-in/page.tsx`

**Current:** After sign-in, always redirects to `/`.  
**Change:** Read `?next` search param. After successful sign-in, redirect to `next` (validated to be a relative path) or `/` as fallback.

```ts
const searchParams = useSearchParams()
const next = searchParams.get('next') ?? '/'
// after successful sign-in:
router.push(next.startsWith('/') ? next : '/')
router.refresh()
```

This requires wrapping in `<Suspense>` if it isn't already (required for `useSearchParams` in Next.js App Router).

---

### `app/dashboard/page.tsx`

**Current:** Admin-only — redirects all non-admin users to `/`. Regular users who sign in get sent away from their own dashboard.  
**Change:** Split into two views by role:

- **Admin view** (unchanged): stats grid + links to admin review and map.
- **Regular user view** (new): no stats, just a list of the user's own event submissions with status badges (Pending / Approved / Rejected) and admin note shown if rejected.

**Logic change:**
```ts
// Remove this line:
if (profile?.role !== 'admin') redirect('/')

// Add instead:
if (profile?.role === 'admin') {
  // existing admin JSX
} else {
  // fetch user's own submissions
  const { data: submissions } = await supabase
    .from('event_submissions')
    .select('id, title, venue_name, date, status, admin_note, created_at')
    .eq('submitted_by_user_id', user.id)
    .order('created_at', { ascending: false })
  // render user submissions list
}
```

Status badge colors: Pending = amber, Approved = green, Rejected = red.

---

### `app/admin/page.tsx`

**Current issues:**
- Redundant client-side auth check that the layout already handles server-side.
- No status filter — all submissions mixed together regardless of status.
- Approve action inserts event with `place_id: null` even when submission has a linked place.
- No admin note capability on reject.

**Changes:**

1. **Remove the redundant auth check** — the layout (`app/admin/layout.tsx`) already redirects non-admins server-side. The client-side `getUser()` + profile check inside the component can be removed entirely.

2. **Add status filter tabs** — `'all' | 'pending' | 'approved' | 'rejected'` state with tab pill UI. Filter the visible submissions client-side (all data is already fetched).

3. **Admin note on reject** — a small textarea that appears inline when the reject button is clicked. User types the note, then clicks "Confirm reject". The note is stored in `admin_note` on the submission row.

4. **Use `place_id` on approve** — when creating the event from an approved submission, use `submission.place_id` if it exists:
   ```ts
   place_id: submission.place_id ?? null,
   ```

5. **Show price on submission card** — if `price` is present, display it.

6. **Update the `Submission` type** to include `place_id`, `admin_note`, `price`.

---

## Step 3 — What to test

| Test | Expected result |
|---|---|
| Visit `/submit-event` while signed out | Redirected to `/sign-in?next=/submit-event` |
| Sign in from that redirect | Taken back to `/submit-event` after successful sign-in |
| Submit event while signed in | Row in `event_submissions` has correct `submitted_by_user_id` |
| Select existing venue in form | `place_id` stored on submission row |
| Type new venue name (no selection) | `venue_name` stored, `place_id = null` |
| Submit with price "800 ALL" | `price` stored on submission row |
| Visit `/dashboard` as regular user | Sees own submissions list (not admin stats) |
| Submission status shows "pending" | Amber badge visible |
| Visit `/dashboard` as admin | Unchanged stats + links view |
| Admin: filter by "Pending" | Only pending submissions visible |
| Admin: approve submission with place_id | Event created with correct `place_id` |
| Admin: reject with note "Missing date" | `admin_note` saved, user sees note in dashboard |
| Admin: reject submission | Status changes to "rejected", approve button disabled |
| Regular user: submission rejected with note | Note visible in `/dashboard` under that submission |
| Sign in with `?next=/submit-event` param | Correct redirect after auth |
| Existing admin flow (approve/reject) | Still works as before |

---

## Step 4 — Rollback plan

**Rollback SQL (2a — added columns):**
```sql
ALTER TABLE event_submissions
  DROP COLUMN IF EXISTS submitted_by_user_id,
  DROP COLUMN IF EXISTS place_id,
  DROP COLUMN IF EXISTS admin_note,
  DROP COLUMN IF EXISTS price;
```

**Rollback SQL (2b — RLS):**
```sql
DROP POLICY IF EXISTS "submissions_select" ON event_submissions;
DROP POLICY IF EXISTS "submissions_insert" ON event_submissions;
DROP POLICY IF EXISTS "submissions_admin_update" ON event_submissions;
ALTER TABLE event_submissions DISABLE ROW LEVEL SECURITY;
```

**Rollback app changes:**
Revert the git commit. The old submit-event form had a broken import (`@/lib/supabase/client`) that would cause a runtime error — the rollback restores that bug, so verify the exact commit to revert to.

---

## Step 5 — Risks

**Broken import on `submit-event`**  
`@/lib/supabase/client` does not exist — the current page throws a module resolution error at runtime on any submit attempt. Fixing this is the first change and has no risk.

**RLS breaking the admin page**  
After enabling RLS on `event_submissions`, the admin page's `supabase.from('event_submissions').select('*')` query must be executed with a session where `is_admin()` returns true. The admin page already reads user role from `profiles` — as long as the admin's `profiles.role = 'admin'`, the policy works. Test with the actual admin account before deploying.

**Venue fetch timing in the submission form**  
If the user changes location while venues are being fetched, there can be a stale venue list. Use a `useEffect` dependency on `locationSlug` and clear `selectedPlaceId` when location changes.

**`?next=` open redirect risk**  
The sign-in redirect must only accept relative paths. `next.startsWith('/')` check prevents `?next=https://evil.com`. Include this check explicitly.

**User dashboard empty state for old submissions**  
Submissions made before Phase 2 have `submitted_by_user_id = NULL` — they will not appear in any user's dashboard. This is correct and expected. Admins can still see them in `/admin`. No data is lost.

---

## Order of execution

1. Run Step 2a SQL (add columns)
2. Run Step 2b SQL (RLS) — **do not run 2b before 2a**
3. Deploy app changes (all files in Step 2)
4. Run manual tests from Step 3
5. If tests pass: commit and push

> Deploy app changes before enabling RLS if possible. The new INSERT policy requires `submitted_by_user_id` to be set — if you enable RLS before the app starts sending that field, the insert will be rejected with an RLS violation for any signed-in user. The SQL in 2a must be deployed first.
