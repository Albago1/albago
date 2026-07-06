# 2. Product Audit — every existing feature

Verdicts: **KEEP** (works, leave alone) · **IMPROVE** (right feature, wrong depth) · **DEMOTE** (keep but stop investing) · **REMOVE** (delete or archive). Impact = how much this feature moves acquisition/retention/supply today, 1–5.

## Ranked by impact

| # | Feature | Verdict | Impact | Real user problem? | Notes |
|---|---|---|---|---|---|
| 1 | **/events discovery** (filter bar, image cards, calendar, search) | IMPROVE | 5 | Yes — "what's happening" is the core promise | World-class UI on thin data. Improve: SSR the list (currently client-fetched — slower + invisible to crawlers), personal defaults (remember city), i18n. The Airbnb-grade filter bar is ready for 10,000 events; it has dozens. |
| 2 | **/protests + countdowns + movements** | KEEP | 5 | Yes — real coordination need, proven usage | The demand engine. Only additions: push/email alerts for new protests in your city, and iCal export. Don't redesign what's working. |
| 3 | **Event detail pages** (SSR, JSON-LD, gallery, save, share, directions) | KEEP | 5 | Yes | Best-built surface in the app. Missing only: "I'm going" (RSVP-lite), view counter plumbing, related events. |
| 4 | **Share system** (posters, QR, captions, Reel export, admin batch) | KEEP | 5 | Yes — this IS the growth loop | Genuinely differentiated; no competitor generates branded protest Reels. Improve later: per-category visual variants, share-click analytics. |
| 5 | **Organizer platform** (onboarding, dashboard, create wizard, tiers) | IMPROVE | 5 | Yes — but unproven with real organizers | The machinery is built; the *experience of success* isn't. No analytics = no reason to return weekly. See §07. Also: onboarding asks revenue/audience-size at step 2 — move behind first value. |
| 6 | **Pankartat photo wall** (upload, vote, report, moderate) | KEEP | 4 | Yes — emotional contribution + social proof | The most "community" thing in the product. Un-hide the /protests CTA when ready; seed real photos. Finish Step-2 cleanup (delete legacy krijo editor code — user decision confirmed: photo wall, not generator). |
| 7 | **/submit-event wizard** (8 steps, drafts, rate-limited RPC) | IMPROVE | 4 | Yes — the community supply path | Auth-gate fixed (97c8253). Still: 8 steps → 5 (merge Type+Category, fold Media into Basics); never live-tested E2E (P0!); English-only. |
| 8 | **/map** (MapLibre, civic pins, place panel, popups) | IMPROVE | 4 | Yes — "near me" is a top-3 query | Solid. Missing: clustering, civic-vs-venue marker distinction, "near me now" geolocation default, and — critically — venues to show. Map value scales with supply. |
| 9 | **Save events + saved-changed emails** | KEEP | 3 | Yes, but thin catalog limits it | Correct implementation. Extend into follows (organizer/city/category) — that's the retention unlock. |
| 10 | **i18n system** (en/sq/es, 215 sq keys) | IMPROVE | 4 | Yes — respect for the core audience | Infrastructure fine; adoption 10/73 components. This is a P1 crisis, not polish. Also rename `al`→`sq` (ISO) during sweep. |
| 11 | **Admin suite** (queue, events, users, placards, volunteers, share-batch, ⌘K) | DEMOTE | 3 | Yes (for ops) | Linear-grade shell around a near-empty queue. It's *done enough*. Stop investing until moderation volume demands it. Exception: keep the planned dense-queue table in the backlog for when submissions/day > 10. |
| 12 | **/volunteer signups** | KEEP | 3 | Yes — converts sympathy into structure | Feed volunteers to organizers/communities later. |
| 13 | **Dashboards (user)** — Spotify-style hero metrics | DEMOTE | 2 | Partially | Beautiful, but a user with 3 saves doesn't need sparklines. Real user dashboard = "my upcoming week." Don't invest further. |
| 14 | **Trust pack** (/about /faq /press /contact /organizers) | KEEP | 3 | Yes — organizer/press conversion | Cheap to maintain, high credibility. Keep copy current. |
| 15 | **Legal + cookie consent + rate limits + reports** | KEEP | 3 | Yes | Table stakes done properly. |
| 16 | **PWA (manifest, bottom nav, apple icon)** | IMPROVE | 3 | Yes — mobile is the platform | Next: push notifications (the actual reason PWAs matter), offline event pages, install prompt at the right moment (after 2nd visit). |
| 17 | **Light mode** | DEMOTE | 2 | Marginal | CSS-override strategy works. Patch reactively when users report; zero proactive investment. Dark is the brand. |
| 18 | **SEO plumbing** (JSON-LD, sitemap, OG images) | KEEP | 4 | Yes — the free-traffic engine | Submit the sitemap to Search Console (STILL not done — 30-second task, weeks old). Add generated OG images for banner-less events. |
| 19 | **Recurring events + auto-archive cron** | KEEP | 3 | Yes | Quiet infrastructure that prevents a dead-looking catalog. Add `recurrence_exceptions` UI eventually. |
| 20 | **Reel video export** | KEEP | 3 | Yes (organizer/social teams) | Unverified on Instagram upload (WebM risk on Firefox). Verify once, then leave. |
| 21 | **Organizer verification tiers** (standard/established/verified + auto-promote trigger) | KEEP | 3 | Yes — trust architecture for scale | Ahead of its time (good). Surface the badge more prominently on event pages. |
| 22 | **/places/[slug] venue pages** | IMPROVE | 3 | Yes — but ~zero venues exist | The page is fine; the table is empty. This is a supply task (seed 50 real Tirana venues), not a code task. |
| 23 | **Homepage** (hero, category tiles, venue rail, protest cards, stats) | IMPROVE | 4 | Yes — first impression | Stage 2 unreviewed by owner. Structural issue: it tries to be both platform identities at once; see §12 for the mode-aware redesign. |
| 24 | **Edi Rama Berlin standalone page** | DEMOTE | 1 | Was yes; event-specific | Historical artifact of one event. Generalize: any protest can have a rich page via /protests/[slug]; no more hand-built one-offs. |
| 25 | **submit-event-v2 route** | REMOVE | 0 | No | Dead/duplicate route sitting in the tree. Delete or merge; a stray route is confusion + surface area. |
| 26 | **Pankartat krijo editor** (legacy generator) | REMOVE | 0 | No — explicitly rejected direction | User decision on record: photo wall, not generator. Delete `app/pankartat/krijo/`, `PlacardTemplate.tsx`, `SEED_PLACARDS`, legacy SVG branch, sitemap entry. |
| 27 | **albago_base44 fork** (outside this repo) | REMOVE | 0 | No | Archive the folder; it exists only to be edited by mistake. |

## The pattern in this audit

Everything scoring 4–5 is either **civic** (protests, pankartat, share) or **discovery UI waiting for supply** (events, map, venues). Everything over-invested is **back-office** (admin chrome, dashboard sparklines, light mode). The product doesn't need more features to be good; it needs *content* to make its existing features true. The audit's single instruction: redirect the next quarter's build energy from surfaces to supply, measurement, and language.

## Does each feature solve a real user problem? — summary

- **Solves a burning problem today:** protests, share posters, pankartat, volunteer.
- **Solves a real problem once supply exists:** events discovery, map, venue pages, save, organizer suite, submit wizard.
- **Solves the founder's problem, not the user's:** admin polish beyond current volume, dashboard analytics theater, light mode perfectionism.
- **Solves nobody's problem:** submit-event-v2, krijo editor, base44 fork.
