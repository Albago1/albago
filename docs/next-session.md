# AlbaGo — Next Session Handoff

**Last updated:** 2026-07-19 (consolidation pass — deps updated, lint 0/0, known bugs fixed)
**Branch:** `main` — all work commits directly to main and auto-deploys via Vercel.
**Stack:** Next.js 16 (App Router) · React 19 · TypeScript · TailwindCSS v4 · Supabase · MapLibre GL

> Strategy source of truth: `docs/product-bible/` (read its README before feature decisions).
> Engineering truth: `docs/platform-architecture.md` + `docs/schema-reference.md`.
> The May-2026 phase-plan handoff that used to live here is history; see git log.

---

## State as of 2026-07-19

**Quality gates (all green):** `npx tsc --noEmit`, `npx eslint` (0 errors, 0 warnings),
`npm run build` all pass. Keep them green — `react-hooks/set-state-in-effect` runs at
error strength; new mount-time setState patterns will fail lint (use
`hooks/useHydrated.ts`, `useSyncExternalStore`, or mount-gated child components —
see ThemeToggle / CookieConsent / AdminCommandPalette for the house patterns).

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
3. **Events discovery page is fully client-rendered** (audit P2 #10) — server-render
   the first page of results for SEO/first-paint on the core discovery surface.
4. **Wizard step consolidation** (audit P2 #8) — 8 steps, two are single-choice
   screens. UX restructure: stage-and-confirm with the user before shipping.
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
