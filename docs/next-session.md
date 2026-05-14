# AlbaGo — Next Session Handoff

**Last updated:** 2026-05-14 (end-of-session — Phase 7B migration live, Commit 8 shipped but form broken)
**Branch:** `main` · HEAD `3e76c27`
**Push state:** All commits pushed to `origin/main`. Working tree clean.
**Vercel deployment:** Live and auto-deploying from `main`.
**Stack:** Next.js 16 (App Router) · React 19 · TypeScript · TailwindCSS v4 · Supabase · MapLibre GL

---

## Phase Status

| Phase | Status |
|---|---|
| Phase 1 — Venue foundation | ✅ Complete |
| Phase 2 — Auth + submissions + moderation | ✅ Complete |
| Stabilization + UX polish | ✅ Complete |
| Phase 3 — Full-text search + DB-driven locations | ✅ Complete |
| Phase 4 — Event detail pages | ✅ Complete |
| Phase 5 — Saved events | ✅ Complete |
| Phase 6 — Venue detail pages | ✅ Complete |
| Audit batch (May 10) | ✅ Complete |
| C2 RLS hardening (May 11) | ✅ Complete (DB-only) |
| Phase 7A — Organizer foundation | ✅ All 5 commits complete and live |
| **Phase 7B — Event lifecycle** | 🔴 Migration live · Commit 7 (types+lib) live · Commit 8 (UI) live but **form broken** |
| Phase 7B — Commits 9–10 | ❌ Not started |

---

## Immediate First Actions Next Session

**In order — do not skip:**

1. **Fix the create-event form bug** (see §Known Bugs below). Do this before anything else.
2. **Redesign the create-event form** per user feedback (see §Form Design Feedback below).
3. After both fixes pass build + Vercel smoke test, continue with Commit 9 (organizer event detail page + submit action).

---

## Git State

| Item | Value |
|---|---|
| Branch | `main` |
| HEAD | `3e76c27` — Phase 7B: organizer event list + create-event form |
| Remote | `origin/main` in sync |
| Working tree | Clean |

### Commit log (this session)

| Hash | Commit |
|---|---|
| `3e76c27` | Phase 7B: organizer event list + create-event form |
| `833c27c` | Phase 7B: event types + organizer event lib |
| `3bf93cd` | Docs: schema-reference v1.1 — architectural rationale section |
| `686cc64` | Phase 7A: /dashboard discoverability card |

---

## Known Bugs — Fix First

### Bug 1: Create-event form always shows "Something went wrong. Please try again."

**File:** `lib/events-organizer.ts` — `createOrganizerEvent()`

**Symptom:** Submitting the form returns the generic fallback error every time, regardless of what the actual Supabase error is.

**Root cause:** The retry loop swallows all non-retriable errors and silently retries 3 times before returning the generic message. The actual error from Supabase is never logged or surfaced.

```ts
// Current broken logic — falls through for all non-23505, non-not_organizer errors:
for (let attempt = 0; attempt < 3; attempt++) {
  ...
  if (!error) return { id: data as string, error: null }
  if (error.message.includes('not_organizer')) { ... return }
  if (error.code === '23505') continue  // ← only retries slug collisions
  // ← everything else falls through and retries unnecessarily
}
return { id: null, error: 'Something went wrong. Please try again.' }
```

**Fix needed:** Fail fast on non-retriable errors. Return the actual error or a specific message. Add a `console.error` so the real Supabase error is visible in browser DevTools for diagnosis.

```ts
// Correct logic:
for (let attempt = 0; attempt < 3; attempt++) {
  const slug = slugifyEvent(input.title)
  const { data, error } = await supabase.rpc('organizer_create_event', { input: { ...input, slug } })

  if (!error) return { id: data as string, error: null }

  if (error.message.includes('not_organizer')) {
    return { id: null, error: 'You must complete organizer onboarding before creating events.' }
  }

  if (error.code === '23505') continue  // slug collision — retry with new slug

  // All other errors: fail immediately, log for diagnosis
  console.error('organizer_create_event error:', error)
  return { id: null, error: 'Something went wrong. Please try again.' }
}
return { id: null, error: 'Could not generate a unique event URL. Try a slightly different title.' }
```

**After fixing the logic**, check browser DevTools console for the actual Supabase error to confirm whether the root cause is:
- RLS policy blocking the INSERT (likely if error code is 42501)
- Missing GRANT EXECUTE on `organizer_create_event` function (if PostgREST 403)
- Some other constraint violation

**If it's a missing GRANT**, run in Supabase SQL editor:
```sql
GRANT EXECUTE ON FUNCTION organizer_create_event(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION organizer_submit_event(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION admin_publish_event(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION admin_reject_event(uuid, text) TO authenticated;
```

---

## Form Design Feedback

The user is not happy with how `app/organizer/create/CreateEventClient.tsx` looks. The form was built minimally for Commit 8. In the next session:

- **Redesign the form** — ask the user what direction they want before rebuilding.
- The structure (fields, validation logic, success state, RPC call) is fine. It's the visual design and UX flow that needs rethinking.
- Reference the existing form patterns in `/submit-event/page.tsx` for style consistency if needed.
- Keep the form minimal in scope (no venue picker, no banner upload — that is still out of scope).

---

## Current Supabase Migration State

### All tables live in production

| Table | Migration | Notes |
|---|---|---|
| `auth.users` | Supabase-managed | |
| `profiles` | Pre-Phase 1 | |
| `events` | Pre-Phase 1 + Phase 7B | Phase 7B columns + RLS live |
| `event_submissions` | Phase 2 + C2 hardening | |
| `places` | Phase 1 + Phase 6 slug backfill | |
| `saved_events` | Phase 5 | |
| `cities` | Phase 1 | |
| `organizers` | Phase 7A | |
| `organizer_onboarding_responses` | Phase 7A | |

### Phase 7B schema changes (live)

**New columns on `events`:** `organizer_id`, `origin`, `banner_url`, `published_at`, `admin_note`

**CHECK constraints:** `events_status_check`, `events_origin_check`

**Indexes:** `events_organizer_id_status_idx`, `events_status_created_at_idx`

**RLS policies (current):**
- `events_admin_write` (ALL) — `is_admin()` — kept from before migration
- `events_select_published` (SELECT) — `status = 'published'`
- `events_select_owner` (SELECT) — `organizer_id = auth.uid()`
- `events_insert_organizer` (INSERT) — `organizer_id = auth.uid() AND status = 'draft' AND origin = 'organizer_dashboard'`

**RPC functions (live):**
- `organizer_create_event(input jsonb)` — SECURITY INVOKER
- `organizer_submit_event(event_id uuid)` — SECURITY INVOKER
- `admin_publish_event(event_id uuid)` — SECURITY INVOKER
- `admin_reject_event(event_id uuid, note text)` — SECURITY INVOKER

---

## Current Routes

| Route | Auth | Works | Notes |
|---|---|---|---|
| `/` | Public | ✅ | |
| `/events` | Public | ✅ | |
| `/events/[slug]` | Public | ✅ | |
| `/places/[slug]` | Public | ✅ | |
| `/map` | Public | ✅ | |
| `/submit-event` | Required | ✅ | |
| `/dashboard` | Required | ✅ | |
| `/admin` | Admin only | ✅ | |
| `/sign-in` | Public | ✅ | |
| `/sign-up` | Public | ✅ | |
| `/become-organizer` | Public | ✅ | |
| `/onboarding/organizer` | Required | ✅ | |
| `/organizer` | Required (organizer) | ✅ | Shows real event list + counts |
| `/organizer/create` | Required (organizer) | 🔴 | Auth guard works; form submits but RPC call fails |

---

## Remaining Phase 7B Commits

| Commit | Scope | Status |
|---|---|---|
| Commit 5 | /dashboard discoverability card | ✅ Done |
| Commit 6 | DB migration | ✅ Done |
| Commit 7 | types + lib | ✅ Done |
| Commit 8 | /organizer event list + /organizer/create form | ✅ Shipped — **form broken** |
| **Commit 8 fix** | Fix RPC error handling + redesign form | ❌ Next session |
| Commit 9 | Organizer event detail + submit action | ❌ Not started |
| Commit 10 | Admin moderation UI (pending events + publish/reject) | ❌ Not started |

---

## Binding Architecture Decisions (unchanged)

| Decision | Detail |
|---|---|
| Organizer is a capability, not a role | Determined by presence of `organizers` row |
| `event_submissions` is permanent | Community funnel coexists with organizer events forever |
| `events.organizer_id` is nullable | NULL = admin-seeded or community-promoted |
| TEXT + CHECK, never ENUM | Adding status values requires only a CHECK constraint change |
| RLS is the final security boundary | Frontend validation is UX only |
| No UPDATE RLS policy on `events` | All state changes are RPC-only |
| Dual moderation queues stay separate | `event_submissions` and `events` state machine are independent |
| Organizer onboarding required before event creation | Enforced by redirect |
| Slugs are permanent | Set at creation, never regenerated |
| `origin` column is immutable | Set at event creation, never updated |
