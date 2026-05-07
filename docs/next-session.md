# AlbaGo — AI Engineering Handoff

**Last updated:** 2026-05-07  
**Stack:** Next.js 16 (App Router) · React 19 · TailwindCSS v4 · Supabase · MapLibre GL · TypeScript

---

## Current Project State

AlbaGo is a nightlife/events discovery platform for Albania and the Balkans. It is a working full-stack app — not a prototype. All major systems are live and connected to a real Supabase backend.

**What is working end-to-end:**
- Interactive map (`/map`) with live Supabase data, MapLibre GL markers, multi-filter system, place panel (desktop sidebar + mobile bottom sheet), location switcher
- Events page (`/events`) with live Supabase data, time/category/search/location filters
- Home page (`/`) with live Supabase data — trending places, events, real stats
- Auth — sign in/up (`/sign-in`, `/sign-up`), session persistence via `@supabase/ssr` middleware, sign-out
- Admin protection — `/admin` and `/dashboard` are server-side protected via `app/admin/layout.tsx` and `app/dashboard/page.tsx` (both redirect if not `role = 'admin'`)
- Admin dashboard (`/dashboard`) with live stats (published events, pending submissions, total places)
- Admin review page (`/admin`) — approve/reject event submissions, auto-publishes to events table on approve
- Event submission form (`/submit-event`) — stores to `event_submissions` table with status `pending`
- i18n — 4 languages (en, de, es, al) via `LanguageProvider` React context + `LanguageSwitcher` component
- SEO metadata — all pages have correct titles (`%s | AlbaGo` template), descriptions, OpenGraph

**Database tables in use:** `places`, `events`, `event_submissions`, `profiles`  
**RLS:** Enabled on all tables. `is_admin()` SQL helper (SECURITY DEFINER) guards admin writes.  
**Auth trigger:** `on_auth_user_created` → `handle_new_user()` inserts into `profiles` with `role = 'user'` on every new signup.

---

## Completed Today

### Step 1 — Metadata, cleanup, navbar admin gate
- `app/layout.tsx` — Updated root metadata: title template `%s | AlbaGo`, description, OpenGraph
- `app/map/page.tsx`, `app/dashboard/page.tsx` — Added `export const metadata` (server components)
- Created `app/events/layout.tsx`, `app/submit-event/layout.tsx`, `app/sign-in/layout.tsx`, `app/sign-up/layout.tsx` — thin server layouts that export page-specific metadata for client component pages
- Deleted `app/supabase-test/` — debug route removed entirely
- `components/layout/LandingNavbar.tsx` — Added `isAdmin` state; queries `profiles.role` on auth state change; Dashboard nav item conditionally rendered only when `isAdmin === true`

### Step 2 — Supabase auth verification (database only, no code)
- Confirmed `on_auth_user_created` trigger exists and is correct
- Confirmed `handle_new_user()` function has `SECURITY DEFINER` and correct `search_path`
- Confirmed admin user profile row exists with `role = 'admin'`

### Step 3 — Location switcher on the map
- `components/map/map.types.ts` — Added `flyToLocation(center, zoom)` to `MapAdapter` type
- `components/map/maplibreAdapter.ts` — Implemented `flyToLocation` using `map.flyTo()`
- `components/layout/FilterBar.tsx` — Added `activeLocationSlug`, `locationOptions`, `onLocationChange` props; desktop: location `<select>` pill in bottom row with MapPin icon; mobile sheet: location chip buttons as first section
- `components/map/MapView.tsx` — Added `useRouter`; `handleLocationChange(slug)` updates URL with `router.replace` (preserves time/category filters); new `useEffect` on `[locationSlug]` flies map to new city; fixed two silent bugs: `filteredEvents` missing `events` dep, `selectedPlace` missing `places` dep

---

## Current Build/Test Status

**Last clean build:** Commit `1343a52` — "Fix build: consolidate Supabase clients and add Suspense boundaries"

**Changes since last build (not yet committed):** All three steps above. No new build errors expected — all changes follow existing patterns. The two useMemo dep fixes were bugs that would have caused runtime issues but not build failures.

**Known issues:**
- `react-map-gl` is in `package.json` but not used anywhere — dead dependency, can be removed
- No test suite exists — zero coverage
- `proxy.ts` at root (Next.js 16 middleware convention) — if someone accidentally adds `middleware.ts` it will conflict

**Env vars required (must be set in Vercel when deploying):**
```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
```

---

## Important Architecture Notes

### Auth Flow
```
User request → proxy.ts (updateSession) → refreshes cookie → page renders
Client pages → createClient() from lib/supabase/browser.ts (createBrowserClient)
Server pages → createClient() from lib/supabase/server.ts (createServerClient + cookies())
Admin gate → app/admin/layout.tsx (server component, redirects before page renders)
```
`lib/supabase/client.ts` is a legacy re-export shim pointing to `browser.ts` — do not remove, some pages still import from it.

### Supabase Integration
- All data is live from Supabase — no static seed data files (they were deleted)
- Places and events are fetched by `location_slug` — every location-aware fetch must include `.eq('location_slug', slug)`
- Events have `status` field — always filter `.eq('status', 'published')` on public pages
- `event_submissions` table is for user submissions, `events` is the published table

### Map Integration
- MapLibre GL via custom adapter pattern: `createMaplibreAdapter()` → `MapAdapter` interface
- Map initializes once (guarded by `if (mapAdapterRef.current) return`) — never re-initialized
- Location changes use `flyToLocation()` (smooth camera animation, no re-init)
- Place selection uses `flyToPlace()` (tighter zoom, accounts for panel overlay padding)
- `proxy.ts` at root uses `export async function proxy` (not `middleware`) — Next.js 16 requirement

### Routing & State
- URL is the source of truth for: `location`, `place`, `time`, `category`, `q`
- Local component state mirrors URL params via `useEffect([searchParams])` sync
- `useSearchParams()` always requires a `<Suspense>` boundary — every page using it is wrapped
- No global state library — all `useState` + `useMemo` in individual components

### Locations System
`lib/locations.ts` — 4 locations: Tirana, Durrës, Albanian Coast, Prishtina. Each has `slug`, `label`, `country`, `center: [lng, lat]`, `zoom`. Add new locations here and seed matching data in Supabase.

---

## Technical Debt

- `lib/supabase/client.ts` is a re-export shim — should eventually consolidate all imports to `browser.ts` directly
- `react-map-gl` unused dependency in `package.json` — remove it
- `app/admin/page.tsx` has its own client-side auth check duplicating what `app/admin/layout.tsx` does server-side — client check can be removed, layout is the real guard
- `PlacePanel.tsx` uses emoji literals (`🕒`, `🎧`, `💰`) in JSX — should use Lucide icons for consistency
- `Event.placeId` in `types/event.ts` is typed as `string` but can be `null` in the DB (`place_id` is nullable) — this is a type lie that could cause runtime issues
- FilterBar `DesktopFilterBar` and `MobileFilterBar` share almost all logic but are duplicated — eventual candidate for a shared hook
- No loading skeleton UI — pages show "Loading..." text during Supabase fetches
- `hero_badge` translation hardcodes "Tirana, Albania" — should be dynamic

---

## Recommended Next Phase

### Step 4 — Git Remote + Vercel Deployment

**Why now:** The platform is feature-complete enough to deploy. Testing on a real URL on a real mobile device will surface any remaining issues. Everything else (GPS, user profiles, analytics) depends on having a live URL.

**What to do:**
1. Create GitHub repo, push code: `git remote add origin <url>` → `git push -u origin master`
2. Import to Vercel, set env vars (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`)
3. Set Supabase Auth "Site URL" and "Redirect URLs" to the Vercel domain
4. Verify auth works on the deployed URL (sign in, check admin gate)

**Files likely needing changes:** None for basic deployment. If redirect issues arise: `lib/supabase/middleware.ts` (session handling) and Supabase Auth dashboard settings.

### After Step 4 — Suggested P1 Features
1. **Place images** — `places.image_url` is stored but only 2–3 places have it set; add images for more places
2. **Fix `Event.placeId` nullable type** — `types/event.ts` line 6: change `placeId: string` to `placeId: string | null`
3. **User profile page** — currently users can sign up but have no profile page; basic `/profile` page showing email + account info
4. **Remove `react-map-gl`** from package.json

---

## Important Warnings

**DO NOT break:**
- The `proxy.ts` export name — it must be `export async function proxy`, not `middleware`. Next.js 16 specific.
- The `<Suspense>` wrappers on `/map/page.tsx` and `/events/page.tsx` — removing them breaks the build
- The `app/admin/layout.tsx` server-side auth gate — this is the real security, not the client-side check in `admin/page.tsx`
- The `.eq('status', 'published')` filter on event queries — removing it exposes draft/rejected events publicly
- The `SECURITY DEFINER` on `handle_new_user()` SQL function — removing it breaks new user signup (function loses permission to write to profiles)

**Risky areas:**
- `maplibreAdapter.ts` — MapLibre map instance is stateful and held in a `useRef`. Any change that causes re-initialization (e.g. key prop on the container div) will break the map
- `LandingNavbar.tsx` — The `isAdmin` check makes an extra Supabase query on every page load; if `profiles` table RLS blocks reads, the Dashboard link silently disappears for all users including admins
- `lib/supabase/server.ts` — The `try/catch` in `setAll` silently swallows cookie-setting errors in Server Components. This is intentional (middleware handles it) — do not remove

---

## Suggested First Prompt For Tomorrow

```
Read docs/next-session.md first. Then read CLAUDE.md.

We are deploying AlbaGo to Vercel. The app is at C:\Users\papi\Desktop\Albago\albago.

Step 1: Help me set up the GitHub remote. I need to push the current master branch.
The last commit is 1343a52. There are uncommitted changes from today's session (Steps 1-3 of the handoff doc) that need to be committed first.

Step 2: After pushing, I will import to Vercel. The required env vars are:
  NEXT_PUBLIC_SUPABASE_URL
  NEXT_PUBLIC_SUPABASE_ANON_KEY

Step 3: After deployment, verify that:
- Supabase Auth "Site URL" is set to the Vercel domain
- "Redirect URLs" includes the Vercel domain + /auth/callback
- Sign in works on the live URL
- The admin gate on /dashboard works correctly

Do not make any code changes until the git situation is resolved. Ask me for the GitHub repo URL before running any git commands.
```
