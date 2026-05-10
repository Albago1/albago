# AlbaGo — Next Session Handoff

**Last updated:** 2026-05-11 (end-of-session state save)
**Branch:** `main` · HEAD `c0e1602` (Map FilterBar: Home button + tighter to navbar)
**Push state:** `main` fully pushed to `origin/main` at `https://github.com/Albago1/albago.git`. Working tree clean.
**Stack:** Next.js 16 (App Router) · React 19 · TypeScript · TailwindCSS v4 · Supabase · MapLibre GL
**Build status:** ✓ `next build` passed locally on 2026-05-10. No code changes since that have any TypeScript surface area beyond a new icon import + a `Link` wrapper in `FilterBar.tsx` — safe to re-verify, but expected to still pass.
**Phases 1–6:** Complete and verified.
**Audit batch (May 10):** Complete, committed, pushed.
**C2 RLS hardening (May 11):** Complete and verified — database-only migration, no code change.
**Map FilterBar polish (May 11):** Home button restored + tightened to navbar. Pushed.
**🚨 NEXT PRIORITY — DEPLOYMENT IS NOT WORKING.** See deployment section below.

---

## 🚨 Deployment status — UNRESOLVED, next session's first priority

The codebase is solid and the database is locked down. The blocker is shipping it to a public URL.

### What was tried this session

1. **Netlify** — `netlify.toml` was added in commit `14cb324` with:
   ```toml
   [build]
     command = "npm run build"
     publish = ".next"

   [[plugins]]
     package = "@netlify/plugin-nextjs"
   ```
   Deployment **returns 404** on the deployed URL. Build may complete on Netlify, but routing into the Next.js App Router doesn't serve pages. Root cause not yet diagnosed — likely candidates:
   - Next.js 16 / App Router compatibility with `@netlify/plugin-nextjs` version pinned by Netlify's auto-install
   - Environment variables (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`) not configured in Netlify dashboard → pages render but every Supabase call fails → could surface as 404 if those errors crash the route
   - `publish = ".next"` may be wrong for the Netlify Next.js plugin — the plugin typically manages its own publish dir
   - Middleware (`proxy.ts` — Next.js 16's renamed `middleware.ts`) may not be picked up by the Netlify plugin

2. **Vercel** — attempted, but **accidentally pointed at the wrong GitHub repo** the first time. Not retried this session. No `vercel.json` exists in the repo. Vercel is the canonical host for Next.js and should "just work" given a clean repo connection + the correct env vars.

### Why deployment is the next priority
- The app is feature-complete enough for temporary public testing (see safety assessment).
- Continuing engineering work without a deployed URL means no one outside this machine can use it.
- Friends / early testers cannot give feedback.

### Exact deployment steps for next session

**Recommended path: switch to Vercel.** It's the lowest-friction Next.js host. Netlify's Next.js plugin lags behind on App Router edge cases. Steps:

1. **Disconnect or pause the Netlify site** (don't delete it yet — keep as fallback). In Netlify dashboard → Site settings → Build & Deploy → Stop auto-publishing.
2. **Create a Vercel project, pointing at the *correct* repo:** `https://github.com/Albago1/albago.git`, branch `main`. Double-check the repo name matches before clicking import.
3. **Configure environment variables in Vercel** (Settings → Environment Variables). Copy from `.env.local`:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - Any `SUPABASE_SERVICE_ROLE_KEY` if it's used server-side (check `lib/supabase/server.ts`)
4. **Trigger a deploy.** Vercel auto-detects Next.js. No `vercel.json` needed.
5. **If deploy fails:** read the Vercel build log end-to-end. Most common issues:
   - Missing env vars → build will surface clearly
   - Image domain not whitelisted → `next.config` may need `images.remotePatterns`
   - Middleware file naming — Next.js 16 uses `proxy.ts`; Vercel should accept it but worth confirming
6. **Configure Supabase Auth redirect URLs** in Supabase dashboard → Authentication → URL Configuration. Add the new Vercel preview + production URLs to the allowlist or sign-in / sign-up redirects will break in prod.
7. **Smoke test the deployed URL:**
   - Home page renders
   - `/events` renders with real data
   - `/map` renders with markers
   - `/sign-in` flow works end-to-end (the redirect URL is the trap)
   - `/submit-event` requires login and submits successfully

### Fallback if Vercel also fails

If Vercel deploys but specific routes 404, that's an App Router / framework issue, not a hosting issue. Re-check `next.config.js`, route file naming, and that `proxy.ts` is at the project root (not in `app/`).

If Netlify must be revived: rebuild the `netlify.toml`, remove the `publish = ".next"` line and let `@netlify/plugin-nextjs` set it. Pin the plugin version in `package.json` rather than relying on auto-install. Last resort.

---

## Session summary (2026-05-10)

This session shipped Phases 4 (event detail pages), 5 (saved events), 6 (venue detail pages), and an **audit batch** addressing the highest-impact issues found in a senior-level audit (security, UX dead-ends, open-redirect, data correctness, visual polish).

The audit batch landed as a single commit covering 7 fixes plus a FilterBar polish.

---

## Audit batch — what shipped

### C1 — Admin role guard on `/admin`
The admin route now does a server-side check: redirects to `/sign-in?next=/admin` if not authenticated, redirects to `/dashboard` if `profile.role !== 'admin'`. Previously any logged-in user could load the admin UI. The page is split into `app/admin/page.tsx` (server component, the guard) and `app/admin/AdminClient.tsx` (the existing client logic — state, approve/reject, JSX). Mirrors the pattern already used by `/dashboard`.

### C2 — `event_submissions` RLS tightening (resolved 2026-05-11)
Verification query exposed three problems on `event_submissions`:

1. **`submissions_public_insert` with `WITH CHECK true`** — wide-open INSERT, any caller (incl. anonymous), bypassed the stricter `submissions_insert`.
2. **`Anyone can create event submissions` with `WITH CHECK (status = 'pending')`** — also permitted anonymous inserts.
3. **Duplicate / dead policies:** `Admins can read submissions`, `submissions_admin_select`, `Admins can update submissions`, plus the inert `Users cannot read submissions publicly` (qual=false, contributes nothing under RLS OR semantics).

Database migration applied (manual SQL):

```sql
DROP POLICY IF EXISTS "submissions_public_insert" ON event_submissions;
DROP POLICY IF EXISTS "Anyone can create event submissions" ON event_submissions;
DROP POLICY IF EXISTS "Users cannot read submissions publicly" ON event_submissions;
DROP POLICY IF EXISTS "Admins can read submissions" ON event_submissions;
DROP POLICY IF EXISTS "submissions_admin_select" ON event_submissions;
DROP POLICY IF EXISTS "Admins can update submissions" ON event_submissions;
```

Final policy set on `event_submissions` (4 policies):

| policyname | cmd | rule |
|---|---|---|
| `submissions_insert` | INSERT | `auth.uid() IS NOT NULL AND submitted_by_user_id = auth.uid()` |
| `submissions_select` | SELECT | `submitted_by_user_id = auth.uid() OR is_admin()` |
| `submissions_admin_update` | UPDATE | `is_admin()` |
| `submissions_admin_delete` | DELETE | `is_admin()` |

Verified live via `SET LOCAL ROLE anon` insert test (rejected, 42501) and `SET LOCAL ROLE authenticated` + spoofed `submitted_by_user_id` insert test (also rejected). Legitimate signed-in submit flow unchanged; `/submit-event` still redirects anonymous users at the auth gate.

**No code changes.** App-side submit form (`app/submit-event/page.tsx` line 119) already sets `submitted_by_user_id: user.id`, so the tightened policy was already compatible.

**Note on initial verification attempt:** The first proposed browser-console test used `window.supabase.from(...)` and failed with `Cannot read properties of undefined (reading 'from')` because the AlbaGo runtime does NOT expose a global Supabase client on `window`. This was a problem with the verification snippet, not with RLS. The verification was redone correctly inside the Supabase SQL editor using `SET LOCAL ROLE anon` — that is the cleanest verification path for this architecture and should be used for any future RLS spot-checks.

### H1 — `/events?time=tonight` activates the time filter
Events page now reads `?time=` from URL on mount with a `'tonight' | 'weekend'` whitelist. The URL-sync effect writes `time=` when the active filter is non-default. The homepage Tonight CTA now actually filters the events page.

### H3 — LandingNavbar visible on `/map`
Removed the `if (pathname === '/map') return null` early-return. On `/map` the navbar uses a slightly more transparent background (`bg-[#070b14]/55`) so the map shows through. FilterBar's top offset moved from `top-4`/`top-3` to `top-20` so it clears the 64px navbar.

### H4 — Sign-up redirect / message behavior
After `signUp` succeeds, if `data.session` is non-null (email confirmation disabled), `router.push('/')` + `router.refresh()`. Otherwise the message reads "Account created. Check your email to confirm, then sign in." with a green pill **Go to sign in →** linking to `/sign-in`.

### H5 — Sign-in `next` open-redirect protection
`next` parameter now must start with `/`, NOT start with `//`, NOT start with `/\`. Anything else falls back to `/`. Closes the protocol-relative URL hole.

### M3 — Inactive venues 404 on `/places/[slug]`
`fetchVenue` adds `.or('status.eq.active,status.is.null')` so `pending` and `inactive` venues 404 instead of rendering. Null branch keeps legacy data working in case `status` was added with a default but pre-existing rows weren't backfilled.

### L6 — Verified badge gated on `place.verified`
Trending Places mapping in `app/page.tsx` now includes `verified: p.verified ?? false`. The "Verified" chip is wrapped in `{place.verified && (...)}` so it only shows for venues actually marked verified.

### FilterBar UX polish (extra this session)
`/map` filters were too visually heavy after the navbar appeared. The desktop bar shrank from ~225px tall to ~110px:
- Width 720px → 600px, padding `p-3` → `p-2`, lighter shadow
- Removed redundant Home button and inner LanguageSwitcher (both in navbar now)
- Time + category chips in one row, smaller (`px-3 py-1.5 text-xs rounded-full`)
- **Tags row hidden by default** behind a `Tags` expand button (only renders when `availableOptionChips.length > 0`)
- Stats and Reset collapsed from chunky pills to a thin text line at the bottom
- Mobile bar: removed Home button, tightened padding from `p-2.5` → `p-2`. Bottom sheet untouched.

All filter functionality preserved.

---

## Files changed and committed

| File | Action | What |
|---|---|---|
| `app/admin/page.tsx` | Rewrite | Server component — auth + admin role guard, redirects on fail. Renders `<AdminClient />` only after both pass. |
| `app/admin/AdminClient.tsx` | NEW | Existing admin client logic (state, approve/reject, JSX) lifted out of `page.tsx`. |
| `app/events/page.tsx` | Modify | Read `?time=` from URL on mount; URL-sync effect now also writes `time=`. |
| `app/page.tsx` | Modify | Place mapping includes `verified`; Verified badge gated on `place.verified`. |
| `app/places/[slug]/page.tsx` | Modify | `fetchVenue` adds `.or('status.eq.active,status.is.null')`. |
| `app/sign-in/page.tsx` | Modify | `next` parameter validated against `//` and `/\` prefixes. |
| `app/sign-up/page.tsx` | Modify | Redirect on session; prominent sign-in link otherwise. |
| `components/layout/LandingNavbar.tsx` | Modify | Renders on `/map` with slightly transparent background. |
| `components/layout/FilterBar.tsx` | Modify | Slimmer desktop + mobile layouts; tags collapsed; `top-20` for navbar clearance. |
| `docs/next-session.md` | Modify | This document. |

**Ten files: one new, nine modified.**

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
| Phase 5 — Saved events | Complete and verified |
| Phase 6 — Venue detail pages | Complete and verified |
| Audit batch (May 10) | Complete and committed |
| **C2 RLS tightening (May 11)** | **Complete and verified — DB only** |
| **Map FilterBar polish (May 11)** | **Home button restored + tightened to `top-[72px]` (commit `c0e1602`)** |
| **Deployment** | **🚨 Unresolved — Netlify 404, Vercel mis-pointed. Next session's first priority.** |
| Phase 7 | Not started — only begin after deployment works |

---

## Audit findings still open

C2 is resolved (see section above). Remaining open items, in rough priority order:

| Tag | Issue | Severity | Notes |
|---|---|---|---|
| H6 | Submitted events with new venue → `place_id = null` after approval, never on map | high | Architectural gap. Stopgap: refuse approval when `place_id IS NULL`. Full fix: in-app venue linker for admins. |
| M1 | Submit-event location dropdown ignores referrer context | medium | Read `?location=` from URL on mount; pass through from homepage CTA. |
| M2 | `getLocationBySlug` silently falls back to Tirana for unknown slugs | medium | Synthesize a fallback `LocationOption` from the slug instead. |
| M4 | `SaveEventButton` shows no error feedback to user on save failure | medium | Add 3-sec inline tooltip. |
| M5 | Admin approve flow has partial-failure window (insert events ok, update submission fails) | medium | Wrap in a Postgres function (`approve_submission(submission_id)`). |
| M6 | Hero CTAs on homepage are desktop-tuned; huge on mobile | medium | Drop to `px-6 py-3 text-base` below sm breakpoint. |
| M7 | No `sitemap.xml` or `robots.txt` | medium | Static `app/robots.ts` + dynamic `app/sitemap.ts` listing event/venue slugs. |
| M8 | Hardcoded category list duplicated in 3+ files | medium | Centralize in `lib/categories.ts`. Pure refactor. |
| M9 | "Open in Map" CTA on event detail page is a dead link when `place_id` is null | medium | Hide or rename when null. |
| L1–L10 | Various small polish items | low | See audit transcript for details. |

---

## Current architecture state

### Pages

| Route | Auth | Component type | Notes |
|---|---|---|---|
| `/` | Public | Client | Featured events + Trending Places. Heart on event cards (logged-in). Verified badge gated. |
| `/events` | Public | Client (Suspense) | Cross-location search. Heart on cards. **Reads `?time=` from URL.** |
| `/events/[slug]` | Public | Server | Phase 4. Heart in CTA row. |
| `/places/[slug]` | Public | Server | Phase 6. **Filters out inactive/pending venues.** |
| `/map` | Public | Client | MapLibre. **LandingNavbar now visible.** Slimmer FilterBar. |
| `/submit-event` | Required | Client | |
| `/dashboard` | Required | Server | Saved events section + submissions/admin actions |
| `/admin` | **Admin only (server-guarded)** | **Server** | Phase: split into server guard + AdminClient. |
| `/sign-in` | Public | Client | Open-redirect protection on `next=`. |
| `/sign-up` | Public | Client | Redirects on session; pill link to sign-in. |

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
    middleware.ts      session refresh helper
proxy.ts               Next.js 16 middleware
```

### Supabase tables

| Table | Notes |
|---|---|
| `events` | `slug` populated and unique. RLS public read where `status='published'`. |
| `places` | `slug` populated and unique. `verified` boolean — UI now respects it. RLS public read. |
| `event_submissions` | RLS hardened 2026-05-11 — 4 policies (insert-self / select-own-or-admin / update-admin / delete-admin). |
| `cities` | RLS public read confirmed. |
| `profiles` | Self read only. `role` ('user'\|'admin'). |
| `saved_events` | Per-user RLS (SELECT/INSERT/DELETE all `user_id = auth.uid()`). |

---

## Recommended next: Phase 7 options

Choose one. All build cleanly on top of the audit batch.

**Option A — Saved venues (recommended)**
Symmetric to Phase 5. New `saved_places` table with the same per-user RLS pattern. Heart button on Trending Places cards, the venue detail page, and (optional) the map place panel. Dashboard gets a "Saved venues" section.

**Option B — Run C2 + close audit M-tier**
Run the C2 SQL verification, then knock down M1, M2, M4, M6, M7, M8, M9 in one focused batch. Smaller per-item but high cumulative polish.

**Option C — H6 stopgap (refuse approval without venue link)**
The "submissions with no place_id" architectural gap. One-line guard on the admin approve action; full venue-linker UI is half a session.

**Option D — Custom 404 pages**
`/events/[slug]/not-found.tsx` and `/places/[slug]/not-found.tsx` with friendly empty states.

**Option E — Map clustering**
Independent quality-of-life. MapLibre GeoJSON cluster source.

---

## Exact next steps for next session

**Deployment first. Engineering work blocked behind it.**

1. **Resolve deployment.** Follow the "Exact deployment steps" in the deployment section above. Recommended path: switch to Vercel pointing at the correct repo with env vars configured. Smoke test all critical routes after deploy.
2. **Configure Supabase Auth redirect URLs** for the production domain.
3. Once a public URL works and smoke tests pass, mark deployment as resolved in this doc and the memory file.
4. **Then and only then,** pick a Phase 7 engineering direction (recommended batch below) and plan-first via `docs/phase-7-plan.md`.

### Recommended next engineering batch (AFTER deployment is fixed)

A small, focused "Eventbrite/Fever-grade polish" batch that delivers visible quality improvements without architectural risk. In suggested commit order:

1. **M9** — kill the dead "Open in Map" link on event detail when `place_id` is null. Hide the CTA or rename it.
2. **M6** — mobile-tune the homepage hero CTAs (`px-6 py-3 text-base` below sm breakpoint).
3. **Friendly date formatting** — single helper in `lib/dateFilters.ts`, used by every card. "Tonight · 21:00", "Fri · 9 PM", "May 14" instead of raw timestamps.
4. **`loading.tsx`** for `/events/[slug]` and `/places/[slug]` — instant page transitions, ~10 lines each.
5. **Friendly 404s** — `not-found.tsx` per detail route with a "Browse all events" CTA.

After that, larger items: **map clustering** (one focused commit), **image-forward cards** (visible quality jump), **empty states** for filter results, and **Phase 7A saved venues** (mirrors saved events). Detailed scope in the prior session's recommendation block.

### Remaining medium-priority audit items (deferred)

These are all open and tracked in the "Audit findings still open" table above:

- **H6** (high) — submissions with new venues land with `place_id = null`, never on map. Needs at minimum an admin-side guard refusing approval when `place_id IS NULL`; full fix is an in-app venue linker.
- **M1** — submit-event location dropdown ignores `?location=` referrer context.
- **M2** — `getLocationBySlug` silently falls back to Tirana for unknown slugs. Synthesize fallback from the slug instead.
- **M4** — `SaveEventButton` has no error feedback to the user on save failure.
- **M5** — admin approve flow has a partial-failure window. Wrap in a Postgres function `approve_submission(submission_id)`.
- **M7** — no `sitemap.xml` / `robots.txt`. Static `app/robots.ts` + dynamic `app/sitemap.ts` listing event/venue slugs.
- **M8** — hardcoded category list duplicated in 3+ files. Centralize in `lib/categories.ts`.
- **L1–L10** — small polish items, see original audit transcript.

No critical audit items remain. Submissions surface is locked down at the DB level.

---

## Next Session First Prompt

```
Read docs/next-session.md and CLAUDE.md before starting.

Context:
- Phases 1–6 + May 10 audit batch + May 11 C2 RLS hardening + Map FilterBar polish are all complete.
- main is clean, c0e1602 is HEAD, pushed.
- Build passes locally.
- 🚨 Deployment is NOT working — this is the first priority.
  - Netlify: deployed but routes 404.
  - Vercel: was tried but pointed at the wrong repo. Not retried since.

Step 1: Walk me through deploying AlbaGo to Vercel from scratch,
pointing at the correct repo (https://github.com/Albago1/albago.git).
Include env-var setup and Supabase auth redirect-URL configuration.
Smoke-test the public URL on all key routes before declaring it done.

Step 2 (only after deploy works): propose docs/phase-7-plan.md for
the "Eventbrite-grade polish" batch (M9, M6, friendly dates,
loading.tsx, friendly 404s). Wait for approval before implementing.

Same rules: plan first, get approval, implement.
```
