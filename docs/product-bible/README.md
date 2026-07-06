# AlbaGo Product Bible

**Version 1.0 — 2026-07-06. Authored by the acting CPO (Claude). This directory is the permanent product source of truth for AlbaGo. Future sessions: read this README first, then load only the section you need.**

## What this is

A first-principles product & business audit of AlbaGo, written after a full codebase inspection (repo at commit `5ab7a05`, 48 routes, full Supabase schema per `docs/schema-reference.md`). It supersedes nothing technical — `docs/platform-architecture.md` and `docs/schema-reference.md` remain the engineering truth. This directory is the **product** truth: what to build, for whom, in what order, and why.

## The one-paragraph thesis

AlbaGo is currently two products in one codebase: a beautifully built event-discovery platform with almost no supply, and an Albanian civic/protest hub with real content, real emotion, and real distribution. The winning strategy is **diaspora-first community infrastructure**: use the civic wedge (protests, Pankartat, the Albanian Revolution moment) to own "Albanians worldwide," convert that trust into organizer supply (community events, concerts, diaspora meetups), and only then expand into general local discovery and ticketing. No global competitor serves a nation + its diaspora as one graph. That's the moat. "Another Eventbrite" is not.

## Sections

| File | Section | Read when |
|---|---|---|
| [01-executive-summary.md](01-executive-summary.md) | Executive summary — what it is, could become, SWOT | Always — the strategic frame |
| [02-product-audit.md](02-product-audit.md) | Every existing feature: keep / improve / remove, ranked | Before touching any existing surface |
| [03-user-personas.md](03-user-personas.md) | 8 personas: goals, frustrations, workflows | Before designing any flow |
| [04-competitive-analysis.md](04-competitive-analysis.md) | Feature-by-feature vs 9 competitors | Before building anything "new" |
| [05-feature-brainstorm.md](05-feature-brainstorm.md) | 310+ scored feature ideas in 13 groups | When planning a cycle |
| [06-growth-loops.md](06-growth-loops.md) | Organic growth loops, triggers, scaling logic | When growth stalls |
| [07-organizer-ecosystem.md](07-organizer-ecosystem.md) | The organizer platform end-state | Before organizer work |
| [08-community-ecosystem.md](08-community-ecosystem.md) | Communities as the durable layer beyond events | Strategic planning |
| [09-international-expansion.md](09-international-expansion.md) | DE / IT / UK / USA / JP launch requirements | Before any geo expansion |
| [10-business-model.md](10-business-model.md) | Monetization strategies, ranked | Before any revenue work |
| [11-ai-roadmap.md](11-ai-roadmap.md) | AI features, no-limits edition | AI planning |
| [12-ux-audit.md](12-ux-audit.md) | Flow-by-flow UX redesigns | Before UX work |
| [13-roadmap-24-months.md](13-roadmap-24-months.md) | Month-by-month plan with metrics | Every month |
| [14-brutal-criticism.md](14-brutal-criticism.md) | The failure post-mortem, written in advance | When tempted to polish instead of grow |
| [15-30-day-operating-plan.md](15-30-day-operating-plan.md) | Day-by-day founder execution plan (supply, i18n, tracking, retention) | **The active plan — check daily** |

## Standing rules for future sessions (CPO directives)

1. **Supply before features.** Any week where zero real (non-civic) events were added by real organizers, feature work is the wrong work. The platform's binding constraint is content, not code. (See §14.)
2. **The diaspora is the market.** ~1.4M people in Albania's cities vs ~1.5–2M Albanians abroad with more disposable income and more homesickness. Every feature should be checked against "does this work for an Albanian in Munich?"
3. **Civic stays free and sacred, forever.** Never monetize, gate, or track protest participation beyond aggregate counts. It is the trust engine; commercializing it kills the brand. (See §10.)
4. **Albanian is the first language, not a translation.** Any new user-facing string must ship through `t()` with `sq` copy at parity. English is the second language. (Current state: only 10/73 client components are wired — this is the standing i18n debt.)
5. **Measure before you build.** No `event_views` table exists as of this writing. Until per-event views/saves/shares are tracked, all product decisions are guesses. This is the single highest-leverage engineering task in the backlog.
6. **User's working style** (from memory, respect it): stage-and-confirm on big visual changes; "make X like Y" means copy Y literally; paste SQL inline; friendly date labels always keep the real date; Pankartat is a photo wall, not a generator; don't ship features the catalog can't back yet.

## Current-state snapshot (2026-07-06)

- **Stack:** Next.js 16.2.2 App Router, React 19, Tailwind v4, Supabase (RLS + RPC state machine), MapLibre, Resend, Vercel. No tests, no CI, no error monitoring (Sentry pending DSN).
- **Live surfaces:** home, /events (+detail), /map, /places/[slug], /protests (+detail), /movements/[slug], /pankartat, /volunteer, /submit-event (8-step wizard), organizer suite (onboarding/dashboard/create/verification), admin suite (Linear-style shell, 8 sections), trust pack (about/faq/press/contact/organizers), legal (privacy/terms/cookies), share system (Story/Square/FB posters + QR + 15/30s Reel video), PWA manifest + mobile bottom nav, light/dark themes, JSON-LD + sitemap SEO.
- **Data reality:** ~84 civic events (albanian-revolution tagged), a handful of non-civic events, near-zero venues (demo venues deleted 2026-06-23). Organizer count: single digits. This is the pre-launch supply state.
- **Open P0s (from `docs/audit-2026-07-02.md`, still open):** rotate/remove `ID_Resend.txt`, commit aging working-tree diff, live-test /submit-event end-to-end, Albanian i18n sweep, organizer analytics.
