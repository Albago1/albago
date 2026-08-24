# AlbaGo — Next Session Handoff

**Last updated:** 2026-07-19 (consolidation pass — deps updated, lint 0/0, known bugs fixed)
**Branch:** `main` — all work commits directly to main and auto-deploys via Vercel.
**Stack:** Next.js 16 (App Router) · React 19 · TypeScript · TailwindCSS v4 · Supabase · MapLibre GL

> Strategy source of truth: `docs/product-bible/` (read its README before feature decisions).
> Engineering truth: `docs/platform-architecture.md` + `docs/schema-reference.md`.
> The May-2026 phase-plan handoff that used to live here is history; see git log.

---

## OPEN — parked, waiting on a decision (2026-08-24)

**The nightly Scout (Phase 39) is built, deployed and blocked on one thing: a paid
AI provider for web search.** Everything else in the chain is verified working.

Deliberately parked by the user on 2026-08-24 — "for now nothing, add it to the
things that need and can be done later". Do not re-litigate it; just pick it up
when they say so.

To unblock, either:
- **Google (fewest steps):** enable billing on the existing `GOOGLE_GENERATIVE_AI_API_KEY`
  project at aistudio.google.com. No env change, no redeploy — the provider
  resolver already falls back to Google when `OPENAI_API_KEY` is absent.
- **OpenAI (the user's stated preference):** create a key at platform.openai.com
  with credit, add `OPENAI_API_KEY` to Vercel (Production + Preview), redeploy.

Then: `/admin/event-radar` → **Search the web for events** → empty box → **Search now**.
After that it self-runs at 03:00 nightly across the 27-area beat.

**Why it's blocked:** the first live run failed with a Google free-tier quota error
on Search *grounding specifically* — a plain Gemini call on the same key still
worked. Grounding carries its own quota. Lens, translations, captions and compose
are unaffected and were never broken (an earlier diagnosis wrongly assumed they were).

**Also outstanding, smaller:**
- `CRON_SECRET` in Vercel — without it `/api/cron/scout` and `/api/cron/discover`
  reject their own scheduler, so the nightly runs silently do nothing.
- The user's Custom GPT ("AlbaGo Scout", private) may not have its Action wired.
  Symptom: it describes events in chat and nothing reaches the queue. Fix is
  Configure → Actions → Import from URL `https://www.albago.org/api/ingest/openapi`
  → API Key / Bearer / `INGEST_API_KEY`. Unverified as of parking.
- `docs/seeds/crawl-sources.sql` still unapplied — only needed for the older
  site-crawler cron, not for the Scout.
- A diagnostic row titled "ZZZ TEST — delete me" may still sit in the queue.

**Verified working end-to-end (don't re-test blindly):** `POST /api/ingest/events`
with the bearer key → candidate created, city resolved to `tirana` unaided,
warnings attached, `event_import_candidates` table live. See Phases 38/39 below.

---

## State as of 2026-07-19

**Quality gates (all green):** `npx tsc --noEmit`, `npx eslint` (0 errors, 0 warnings),
`npm run build` all pass. Keep them green — `react-hooks/set-state-in-effect` runs at
error strength; new mount-time setState patterns will fail lint (use
`hooks/useHydrated.ts`, `useSyncExternalStore`, or mount-gated child components —
see ThemeToggle / CookieConsent / AdminCommandPalette for the house patterns).

**Recently shipped (July 20):**
- AlbaGo Crawl CRAWL-1 (`docs/master-plan/07-crawl.md`): autonomous website
  crawler that feeds the moderation queue. `lib/crawl/{sources,toSubmission,crawl}.ts`
  + `app/api/admin/crawl/route.ts`. Reuses `readEventFromUrl` + `resolvePoster`
  end-to-end; writes crawler finds as `event_submissions` pending rows with
  `submitted_by_user_id = NULL` via the service client (no schema change — frozen
  table, null submitter is admin-only readable). Admin-gated POST, dry-run by
  default. Also CRAWL-1.5 multi-event discovery (`lib/crawl/discover.ts`):
  `listingUrls` mode fetches an index page, finds the event links on it
  (same-host, event-looking, +schema.org Event urls), and reads each — the
  "search over a page of events" ask. And CRAWL-1.6 site mode
  (`lib/crawl/site.ts`): `siteUrls` mode takes just a domain, reads the site's
  sitemap (via robots.txt / conventional locations, sitemap-index aware) or
  falls back to the homepage, to find its event pages itself. And CRAWL-1.7
  huge-list batching: `crawlSources` is time-budgeted (45s) and returns
  `report.remaining` grouped by mode; `scripts/crawl-batch.mjs` drives a whole
  file of domains/URLs to completion by looping on `remaining` (chunked). Route
  auth now also accepts a `CRAWL_SECRET` bearer (env var — for the batch script /
  future cron) alongside the admin session. CRAWL-1.8 admin UI at `/admin/crawl`
  (rail link added): paste domains/pages → Dry run → results table → tick "send
  to queue" to insert pending rows. Uses the admin session (no CRAWL_SECRET
  needed in-browser); client loops on `report.remaining` so it drives huge lists.
  Route body `{ dryRun, sourceUrls, listingUrls, siteUrls, maxEventsPerListing }`.
  CRAWL-1.9 multi-event LIST extraction: listing/site modes now read the whole
  page and extract EVERY event (array) via `readEventListFromUrl` — fixes the
  "found nothing" on inline-listing pages (ChatGPT-style). `classifyReading`
  shared; `crawlListing`/`crawlSite` do list-extract → link/sitemap fallbacks.
  KNOWN CEILING: JS-rendered pages still yield little from raw fetch (needs a
  headless renderer later). CRAWL-1.10 paste-text mode works AROUND that ceiling:
  `pastedText` on the route + paste box on `/admin/crawl` → user pastes an events
  list (e.g. gathered via ChatGPT) → `readEventListFromText`/`crawlFromText`
  structure + resolve + queue them, no fetching. Source registry ships as
  disabled templates.
  tsc/eslint/build clean. **USER VERIFY:** open `/admin/crawl`, paste a real
  Albanian venue domain, Dry run, eyeball results; or POST `/api/admin/crawl`
  `{ "sourceUrls": ["<a real Albanian venue/ticket page>"] }` (dry-run) and eyeball
  the would_submit payload; then `{ "dryRun": false, "sourceUrls": [...] }` and
  confirm one pending row appears in `/admin/queue`. CRAWL-2 (DB source table +
  Vercel Cron + rejected-dedup) is spec'd, not built.

**Recently shipped (July 19):**
- Weather forecast widget on event detail pages (`components/events/EventWeatherCard.tsx`,
  `lib/weather.ts` — Open-Meteo, no key) + compact chip on protest cards
  (`components/protest/ProtestWeatherMeta.tsx`, `hooks/useEventForecast.ts`).
- Foundation pass: all react-hooks findings fixed properly (useSyncExternalStore
  for theme/consent/language, shell+body modals, admin queue refresh pattern).
- Consolidation pass: Next 16.2.10 (high-sev advisory fixed), safe minor updates,
  `getLocationBySlug` no longer lies "Tirana" for unknown slugs (audit M2 closed),
  raw DB errors no longer shown on public surfaces (/events, report, settings).

**Known accepted debt:**
- 2 moderate npm advisories remain (postcss <8.5.10 pinned inside next's bundle;
  build-time only, fix arrives with future Next releases — do not `audit fix --force`).
- framer-motion held at 11.x (12 is a major; migrate deliberately, not in passing).
- 4 documented `eslint-disable` mount-fetch sites in admin clients (rule can't trace
  post-await setState; pattern matches UsersClient precedent).

---

## Open work, in priority order

1. **Albanian i18n sweep** (operating plan §3; audit P1 #6) — the platform is still
   English-first for an Albanian audience. Biggest open "perfect what exists" item.
2. ~~/submit-event end-to-end verification~~ — **CLOSED 2026-07-19.** Real run:
   fresh user → confirm → submit_event_submission RPC → row pending in queue →
   submitter delete correctly blocked by RLS. Side catches fixed the same day:
   admin users table unscrollable on mobile, and admin_confirm_user_email
   writing the now-GENERATED confirmed_at column (seed + live DB both fixed).
3. ~~Events discovery client-rendered~~ — **CLOSED 2026-07-19.** /events now
   server-renders the initial list (search mode stays client-side).
4. ~~Wizard step consolidation~~ — **CLOSED 2026-07-19.** Type+Category merged
   into one screen; 8 steps → 7. User should eyeball the new combined step.
5. **Seeds reconciliation** — `docs/seeds/` has drifted from the live DB before;
   verify deployed RPC signatures before any `CREATE OR REPLACE` (see memory note).

**User-side manual items (ask, don't assume done):** Resend key rotation confirmed in
dashboard, sitemap submitted to Search Console, Google OAuth verification form,
Sentry DSN.

---

## Working agreements (unchanged)

- Mobile-first, cinematic flame-red/ink-black brand, Instrument Serif display type.
- Supply before features; civic free forever; measure before build (product bible).
- Manual SQL is delivered as copy-paste blocks in chat — never executed by tooling.
- Big visual restructures: ship the smallest reversible piece first and confirm.
