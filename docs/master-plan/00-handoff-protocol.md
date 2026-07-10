# 00 — Handoff Protocol (READ FIRST, every session, every model)

You are picking up work on **AlbaGo** (`C:\Users\papi\Desktop\Projects\AlbaGo\albago`, deployed at https://albago.org from `main` via Vercel). This file exists so that ANY model continuing this work produces the same quality and follows the same structure as the sessions that designed it. Follow it exactly; where it conflicts with improvisation, this file wins.

## 1. Read order before touching code

1. `CLAUDE.md` (repo root) — product philosophy, UX laws, established patterns.
2. Claude auto-memory `MEMORY.md` + `albago_revolution_merge_state.md` (session resumption state; TL;DR at top).
3. `docs/product-bible/README.md`, then §10 (business model) and §13 (roadmap) for anything commerce-related.
4. `docs/master-plan/README.md` (sequence + gates) and the track doc you're executing.
5. `docs/schema-reference.md` before ANY database work — it documents every table, RLS policy, and the design principles (esp. #4: no cached aggregates).

## 2. How the user works (violating these loses trust)

- **Plan-first, stage-and-confirm.** Write/point to the phase plan, get explicit approval on scope, then build the SMALLEST shippable piece and get a verdict before the next piece. Even when the user says "do it all" — ship reversible stages. (Recorded lesson: a big-bang homepage restructure had to be rolled back.)
- **SQL is NEVER executed programmatically.** Present complete copy-paste SQL blocks IN CHAT (not file references); the user runs them in Supabase and confirms. Seeds live in `docs/seeds/phase-*.sql` as the canonical copy.
- **No money, no credit card.** Hard constraint. Free tiers only. Stripe test mode is free; anything with a subscription cost is rejected. If a step requires money (store accounts), it goes on the User P0 checklist and work routes around it.
- **"Make X like Y" means copy Y literally** — when the user names a reference platform, match it, don't invent a "smarter" variant.
- **Plain language** for anything the user must do manually: numbered short sentences, no jargon.
- **Close tasks immediately** after the commit that ships them, not at end of turn.
- **Time prominence:** event times are NEVER muted text. Every new surface showing an event shows its time bold/flame. Friendly date labels ("Tonight") always keep the calendar date next to them.
- Commit style: `feat(scope): ...` / `fix(scope): ...`, plan-first phases historically `Phase N: ...`. Push to `main` deploys production. **PowerShell gotcha:** here-string commit messages explode on embedded double quotes — write messages without `"`.

## 3. Engineering laws of this codebase

- Next.js 16 App Router + React 19 + Tailwind v4 + Supabase (RLS + SECURITY DEFINER RPCs) + MapLibre + Resend + framer-motion. TypeScript strict. Tailwind only — no CSS files beyond `globals.css`, no inline styles unless dynamic.
- **Auth/roles:** `profiles.role` ('user'|'admin'), organizers = row in `organizers` keyed by auth uid. Admin checks via `is_admin()` SQL function; server components guard routes and redirect; client logic lives in sibling `*Client.tsx`.
- **RLS patterns:** per-user tables use `user_id = auth.uid()` policies + `UNIQUE(user_id, foreign_id)`; privileged mutations are SECURITY DEFINER RPCs gated on `is_admin()` (see `admin_set_studio_access` as the template).
- **No cached aggregates.** Counts/balances/availability = SQL functions computed from source tables, with `FOR UPDATE` row locks inside RPCs where concurrency matters.
- **Overlays:** any fixed-position overlay inside a stacking context (action panels, blurred parents) must render via `createPortal(document.body)`. z-map: page content ≤10, map UI 20–40, bottom nav 40, search overlay 70, modals 80.
- **Light mode:** dark is default; light works via global remap layers in `globals.css`. Text over photos needs `.on-media`; theme-immune on-photo UI uses arbitrary values (`bg-[rgba(...)]`, `text-[#fff]`); page-blend fades use `.fade-to-surface-t`, never raw `from-ink-950`.
- **i18n:** every user-facing string via `t('key')`, keys added ×4 (en/de/es/sq blocks in `lib/i18n/translations.ts`), natively phrased. Verify parity (same key count per language).
- **Email:** Resend, templates in the codebase; POSTs must target `www.albago.org` (apex 308s). Debug prod with `npx vercel logs <url> --json` immediately after triggering (logs rotate fast).
- **Verification bar per phase:** `npx tsc --noEmit` clean, `npx eslint` on touched files clean (pre-existing warnings documented), `npx next build` clean, and a scripted or manual E2E of the actual flow. State honestly in the summary what the USER still needs to verify.
- **Lint gotchas:** `react-hooks/immutability` forbids closure-variable reassignment even inside `useMemo` — derive arrays with pure lookback loops. `react-hooks/set-state-in-effect` fires on mount-load patterns — follow existing suppression style only where already established.

## 4. Quality bar — "best platform in the world" anchors

The user's standing instruction is to match the world's best, surface by surface. Anchors already established and approved:

| Surface | Anchor |
|---|---|
| Map + search | Google Maps app (copied literally, user-approved) |
| Bottom nav | Instagram liquid-glass pill |
| Event pages | DICE × Fever × RA synthesis |
| Tickets & QR at door | **DICE** (fan-first, cinematic, anti-tout) |
| Checkout | **Stripe Checkout** hosted (don't hand-roll payment UI) |
| Organizer tools | Linear-grade density (admin queue is the in-repo reference) |
| Admin | existing `/admin` patterns (AdminTopBar, command palette) |

"Best" means: fewest steps, instant feel, no enterprise smell, mobile-first, and the cinematic flame/ink brand carried into every artifact (a ticket should feel like a poster, not a receipt).

## 5. How to execute a phase from these track docs

1. Read the phase spec in the track doc. If anything is ambiguous, the track doc's Decision Log + product bible answer it before the user is asked.
2. Draft the SQL (if any) exactly in the style of `docs/seeds/phase-*.sql`, paste it in chat, wait for the user to confirm they ran it.
3. Build the smallest slice. Wire i18n ×4. Respect the engineering laws above.
4. Verify (tsc/eslint/build + real flow). Commit, push, confirm deploy.
5. Tick the checklist in the track doc + append to Decision Log if a decision was made. Update the auto-memory merge-state TL;DR with commit hash + what's unverified.
6. Give the user a plain-language "what to check on your phone" list.

## 6. Current state snapshot (update when it changes)

- Phases 1–30 shipped (see merge-state memory). Ticketing/payments/apps: **nothing built yet** beyond schema reservations (`organizers.stripe_account_id` reserved, `event_tickets`/`ticket_purchases` named in schema-reference Future Reserved — the track docs supersede those table sketches).
- Catalog is protest-heavy + growing regular events; Studio (AI posters/captions) is live; admin queue is Linear-grade; organizer dashboard has previews.
- No entity/bank/Stripe/store accounts exist yet (User P0 checklist in README).
