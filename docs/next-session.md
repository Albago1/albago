# AlbaGo — Next Session Handoff

**Last updated:** 2026-05-10
**Branch:** main
**Stack:** Next.js 16 (App Router) · React 19 · TypeScript · TailwindCSS v4 · Supabase · MapLibre GL
**Build status:** ✓ `next build` passes — 0 TypeScript errors. All 10 routes intact.
**Phase 3 status:** ✓ Verified end-to-end on 2026-05-09.
**Phase 4 status:** ✓ Verified and committed on 2026-05-10.
**Phase 5 status:** ✓ Browser-verified and committed on 2026-05-10.

---

## Session summary (2026-05-10)

This session shipped Phase 4 (event detail pages) and Phase 5 (saved events) per their respective plan docs. No scope creep.

Phase 5 was implemented end-to-end:
- `saved_events` table created in Supabase with RLS (3 policies: SELECT/INSERT/DELETE — all `user_id = auth.uid()`)
- 4 SQL verification queries passed
- 18-test browser checklist passed

---

## What was completed this session

### Phase 5 — Saved Events

**1. `saved_events` table** in Supabase.
- `id`, `user_id` (FK profiles ON DELETE CASCADE), `event_id` (FK events ON DELETE CASCADE), `saved_at`
- `UNIQUE(user_id, event_id)` prevents double-saves at the DB level
- Index on `user_id` for fast dashboard queries
- RLS enabled with three policies: users can SELECT, INSERT, DELETE only their own rows. No UPDATE policy (saves are immutable — toggle = delete + insert).

**2. Heart button on three card surfaces.**
- Homepage Featured Events cards
- Events page list cards
- Event detail page (CTA row, size='md' with label)
- Anonymous users → `router.push('/sign-in?next=' + currentPath)`
- Logged-in users → optimistic toggle, in-flight lock prevents double-clicks, revert on error
- Card-link bubbling prevented via `e.stopPropagation()` + `e.preventDefault()`

**3. Dashboard "Saved events" section** on both admin and regular-user views.
- Server-fetched joined query (`saved_events → events → places.name`)
- Cascade-deleted events filtered out at the mapping layer
- Client wrapper (`SavedEventsList`) holds the list in state so unsaving a card removes it immediately
- Empty state with "Browse events" CTA when list is empty

**4. Three new shared modules.**
- `lib/savedEvents.ts` — `fetchSavedEventIds`, `saveEvent`, `unsaveEvent` (all accept a `SupabaseClient`, work in server and browser)
- `components/SaveEventButton.tsx` — two size variants (`sm` icon-only for cards, `md` with label for detail page)
- `components/SavedEventsList.tsx` — dashboard list wrapper with optimistic remove-on-unsave

---

## Files changed and committed in Phase 5

| File | Action | What |
|---|---|---|
| `lib/savedEvents.ts` | NEW | Three async helpers (fetch ids, save, unsave) |
| `components/SaveEventButton.tsx` | NEW | Client component, two sizes, anonymous redirect, optimistic toggle |
| `components/SavedEventsList.tsx` | NEW | Dashboard wrapper, removes cards on unsave, empty-state CTA |
| `app/page.tsx` | Modify | Added `isAuth` + `savedIds` state and load effect; heart in Featured Events card top-right |
| `app/events/page.tsx` | Modify | Same auth/savedIds pattern; heart in card right-side cluster |
| `app/events/[slug]/page.tsx` | Modify | Server-side checks saved_events for this event + user; `<SaveEventButton size="md">` next to Open in Map |
| `app/dashboard/page.tsx` | Modify | `fetchSavedEventCards` helper; "Saved events" section in both admin and regular-user views |
| `docs/phase-5-plan.md` | NEW | The plan |
| `docs/next-session.md` | Modify | This document |

---

## Current Phase status

| Phase | Status |
|---|---|
| Phase 1 — Venue foundation | Complete |
| Phase 2 — Auth + submissions + moderation | Complete |
| Stabilization pass | Complete |
| Phase 3 — Global full-text search + DB-driven locations | Complete and verified |
| UX polish batch (May 9) | Complete |
| Phase 4 — Event detail pages | Complete and verified |
| Phase 5 — Saved events | **Complete and verified** |
| Phase 6 | Not started — recommendations below |

---

## Current architecture state

### Pages

| Route | Auth | Component type | Notes |
|---|---|---|---|
| `/` | Public | Client | Featured events have heart button (logged-in users) |
| `/events` | Public | Client (Suspense) | Heart button on every card |
| `/events/[slug]` | Public | **Server** | Heart button (size md) in CTA row alongside Open in Map / Get Directions / Website |
| `/map` | Public | Client | MapLibre map — LandingNavbar returns null |
| `/submit-event` | Required | Client | Auth-gated form with venue search |
| `/dashboard` | Required | Server | "Saved events" section above existing content for both admin and regular users |
| `/admin` | Admin only | Client | Approve/reject submissions |
| `/sign-in` | Public | Client | Supabase auth, supports `?next=` redirect (used by heart-button anonymous flow) |
| `/sign-up` | Public | Client | Supabase auth |

### Key lib files

```
lib/
  locations.ts         LocationOption[], getLocationBySlug(), fetchLocations()
  useLocations.ts      'use client' hook — instant fallback array + DB update
  dateFilters.ts       isToday(), isThisWeekend(), getTodayDateString()
  eventLinks.ts        Phase 4 — buildMapHref(), buildDirectionsHref()
  savedEvents.ts       Phase 5 — fetchSavedEventIds(), saveEvent(), unsaveEvent()
  supabase/
    browser.ts         createClient() for client components
    server.ts          createClient() for server components
    client.ts          legacy re-export shim → browser.ts (safe to keep)
    middleware.ts      session refresh helper
proxy.ts               Next.js 16 middleware
```

### Supabase tables

| Table | Key columns | RLS | Notes |
|---|---|---|---|
| `events` | `status`, `slug`, `location_slug`, `place_id`, `search_vector` | Public read where `status='published'` | |
| `places` | `location_slug`, `search_vector`, `address`, `website_url`, `lat`, `lng` | Public read | |
| `event_submissions` | `status`, `submitted_by_user_id`, `place_id`, `admin_note` | Submitter + admin | |
| `cities` | `slug`, `name`, `country`, `region`, `lat`, `lng` | Public read | |
| `profiles` | `id`, `role` ('user'\|'admin') | Self read | |
| `saved_events` | `user_id`, `event_id`, `saved_at`, UNIQUE(user_id, event_id) | **Self only** (SELECT/INSERT/DELETE all `user_id = auth.uid()`) | New in Phase 5 |

---

## Recommended next: Phase 6 options

Choose one. All build cleanly on top of Phase 5.

**Option A — Venue detail pages `/places/[id]` (recommended)**
Mirror of Phase 4 for venues. Reuses the detail-page pattern. A user can open a venue page showing all upcoming events at that venue + address + map embed link. The "Open in Map" buttons across the platform get a sibling: "View Venue."

**Option B — Saved-events email digest**
Weekly email of upcoming saved events. Needs cron + email infra (Resend / Supabase Edge Function). Bigger lift than B/C, but high engagement payoff.

**Option C — Custom 404 for `/events/[slug]/not-found.tsx`**
Smaller polish. Friendly empty state with "Browse all events" CTA.

**Option D — OpenGraph images for event pages**
Once event covers are uploadable (or generated banners per category), wire into `openGraph.images`.

**Option E — Map clustering**
Independent of everything else. MapLibre cluster source. Quality-of-life as the venue count grows.

---

## Exact next steps for next session

1. Pick a Phase 6 direction.
2. Plan-first via `docs/phase-6-plan.md`.
3. Get approval, then implement.

---

## Next Session First Prompt

```
Read docs/next-session.md and CLAUDE.md before starting.

Context:
- Phases 1, 2, 3, 4, 5 are complete, verified, and committed.
- main is clean.
- Build passes.

I want to start Phase 6: [A — venue detail pages / B — email digest /
C — custom 404 / D — OG images / E — map clustering].

Propose docs/phase-6-plan.md covering scope, files, tests, risks, rollback.
Wait for approval before implementing.

Same rules: plan first, get approval, implement.
```
