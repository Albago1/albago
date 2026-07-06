# Opus continuation prompt — paste-ready (written 2026-07-06, end of Fable i18n sprint)

## 1. Current AlbaGo direction

AlbaGo (repo: `AlbaGo/albago`, Next.js 16 App Router + Supabase, prod at albago.org) is executing the **30-day founder operating plan** at `docs/product-bible/15-30-day-operating-plan.md`. Read it before proposing work; §9 anti-distraction rules apply (no RSVP/follows/push/communities/admin polish/AI/light-mode this month). Month goal: 20 real organizers, 50 venues, 50+ real non-civic events, 100 subscribers, tracking on everything, **Albanian everywhere users look**. The active build track is the Albanian i18n sweep (plan §3). Pankartat is de-prioritized: keep the feature alive but do not promote it publicly.

## 2. What Fable completed (this session, all UNCOMMITTED)

- **Albanian i18n on the full public visitor path**: HomeClient (search, suggestions, location picker, section headings, protest empty state, movement banner), EventsClient shell (back/H1/hero/error/empty states), ProtestCard (locale-aware dates + Civic/expected), ShareModal (all labels), SubmitEventClient (auth gate + success), ProtestsClient tooltip.
- **+74 keys × 4 languages** in `lib/i18n/translations.ts`; verified programmatically at **337-key parity** in en/de/es/sq.
- **Pankartat publicly disconnected**: links removed from Footer, MovementClient, AlbanianRevolutionClient, EdiRamaBerlinClient, press page, sitemap; FAQ Q&A deleted; /about mention neutralized (authenticity copy kept, feature name dropped); `/pankartat` route got `robots: { index: false, follow: false }`. Feature code fully intact; private dashboard links intact.
- Full detail + browser checklist: `docs/ops/i18n-sprint-handoff.md`.

## 3–4. Current uncommitted changes (exact files)

16 modified + 2 new docs, on top of pushed `main` @ `7e0c798`:

- `lib/i18n/translations.ts` (+74 keys × 4)
- `app/HomeClient.tsx`, `app/events/EventsClient.tsx`, `app/protests/ProtestsClient.tsx`
- `components/cinematic/ProtestCard.tsx`, `components/share/ShareModal.tsx`, `app/submit-event/SubmitEventClient.tsx`
- `components/layout/Footer.tsx`, `app/movements/[slug]/MovementClient.tsx`, `app/events/albanian-revolution/AlbanianRevolutionClient.tsx`, `app/protests/edi-rama-berlin-2026/EdiRamaBerlinClient.tsx`, `app/press/page.tsx`, `app/sitemap.ts`
- `app/faq/page.tsx` (Pankartat Q&A removed), `app/about/page.tsx` (mention neutralized), `app/pankartat/page.tsx` (noindex)
- NEW: `docs/ops/i18n-sprint-handoff.md`, `docs/ops/opus-continuation-prompt.md` (this file)

## 5. Manual browser tests needed (before commit, switch navbar language to SQ)

1. Homepage: search placeholder, dropdown headers, location picker, "Kërko", section headings, movement banner.
2. /events: "Kthehu" pill, "Të gjitha eventet në Tiranë" H1, empty state on nonsense search.
3. Protest cards: Albanian month/weekday, "Qytetare" chip, "X të pritur".
4. Any event → Share modal: fully Albanian.
5. /submit-event logged out: "Fillo tani, hyr më vonë" gate.
6. /faq renders with no gap where the Pankartat question was; /about "Real photos, real people" card reads naturally.
7. Footer + movement/revolution/Edi-Rama/press pages: no Pankartat link.
8. Flip EN/DE/ES once — no raw key names.

## 6. Manual dashboard tasks (user-only, still open, nag gently)

1. **Resend key rotation** at resend.com + update `RESEND_API_KEY` in Vercel env → **redeploy**. (File `ID_Resend.txt` is gone from disk and was never in git, but the key itself was exposed locally — rotation unconfirmed.)
2. **Sitemap submission**: search.google.com/search-console → property albago.org → submit `https://albago.org/sitemap.xml`.
3. **Google OAuth verification form** (removes "unverified app" interstitial).
4. **/submit-event E2E test** in production (post-Phase-25 casts never verified end-to-end).
5. **Sentry DSN** (create project, hand DSN over for ~20-min wire-up).
6. `.editorconfig` with `charset=utf-8` (tiny, prevents mojibake).

## 7–9. Commit first, exact command, messages

Commit the i18n sprint before any new work (after browser approval). **NO `git add .`** — untracked secrets have appeared in this tree before.

```
git add lib/i18n/translations.ts app/sitemap.ts app/protests/ProtestsClient.tsx app/HomeClient.tsx app/events/EventsClient.tsx components/cinematic/ProtestCard.tsx components/share/ShareModal.tsx app/submit-event/SubmitEventClient.tsx components/layout/Footer.tsx "app/movements/[slug]/MovementClient.tsx" app/events/albanian-revolution/AlbanianRevolutionClient.tsx app/protests/edi-rama-berlin-2026/EdiRamaBerlinClient.tsx app/press/page.tsx app/faq/page.tsx app/about/page.tsx app/pankartat/page.tsx docs/ops/i18n-sprint-handoff.md docs/ops/opus-continuation-prompt.md
```

Either one commit:

```
feat(i18n): localize homepage, events, share + submit flows; disconnect Pankartat from public

- 74 new keys x 4 languages (all blocks verified at 337-key parity)
- HomeClient, EventsClient, ProtestCard, ShareModal, SubmitEventClient,
  ProtestsClient wired to t(); ProtestCard dates locale-aware
- Pankartat: links removed from footer, movement page, revolution hub,
  Edi Rama Berlin page, press page, sitemap; FAQ entry removed; about
  mention neutralized; /pankartat noindexed (feature code untouched)
```

or split into `feat(i18n): …` (first 13 files + handoff) and `chore(pankartat): finish public disconnect` (faq/about/pankartat pages).

## 10. Next 10 implementation tickets, in order

1. **Language cookie** — make the chosen language readable server-side (see §12). Blocks everything server-rendered.
2. **Event detail page i18n + trust labels** (`app/events/[slug]/page.tsx`) — biggest remaining visitor surface. Labels: Data / Ora / Vendndodhja / Adresa / Kategoria / Kthehu / Hape në Google Maps / Get Directions → "Merr drejtimet", Venue → "Vendi", Expected attendees → "Pjesëmarrës të pritur", Safety & legality → "Siguria dhe ligjshmëria", About this event → "Rreth eventit", Organizer → "Organizatori".
3. **Trust copy row on event detail**: "Burimi", "Përditësuar së fundmi" (from `updated_at`), "Kopjo adresën" button, "Raporto korrigjim" (mailto with prefilled subject is enough — NO ticket system).
4. **"Je organizatori? Merre eventin në kontroll"** — one static line on event detail linking to /become-organizer with `?event=` param. NO claim backend this month.
5. **Add-to-calendar** (.ics + Google Calendar link on event pages) — plan §6 Days 15–16, instrument with `calendar_add` interaction.
6. **Subscribe capture** (`subscribers` table + one reusable input, Resend double-opt-in) — plan §6 Days 17–19.
7. **Protest alerts** — extend `notify-event-published` to fan out to civic subscribers — plan §6 Days 20–21.
8. **i18n batch: trust pages** (/about, /faq, /press, /contact, /organizers) — needs ticket 1.
9. **i18n batch: map chrome + event wizard steps + auth screens.**
10. **Build-time key-parity check** (tiny script in CI/prebuild that fails if any language block diverges from en) — plan §3 explicitly asks for this.

## 11. What NOT to build (plan §9, reaffirmed)

RSVP/save-for-later expansion, follows, web push, communities/comments, admin redesign, AI features, light-mode polish, Pankartat anything, ticketing, native apps, Spanish improvements. Every "while I'm here" impulse goes to `docs/ops/later.md`.

## 12. Event detail i18n — the correct approach (do NOT hack)

**Problem:** `app/events/[slug]/page.tsx` is a server component (generateMetadata, notFound, JSON-LD). The UI language lives only in `localStorage("albago_language")`, which the server can never read. So `t()` via LanguageProvider is unreachable there.

**Recommended (safest) option — language cookie, ~1h:**
1. In `LanguageProvider.setLanguage`, also write `document.cookie = "albago_language=" + lang + "; path=/; max-age=31536000; SameSite=Lax"`, and on mount prefer localStorage but fall back to the cookie (keeps existing users' choice).
2. New tiny helper `lib/i18n/server.ts`: `getServerLanguage()` reads `cookies().get('albago_language')`, validates against `languages`, defaults `"en"`; `getServerT(lang)` returns the same lookup closure over `translations`.
3. In the detail page: `const lang = await getServerLanguage(); const t = getServerT(lang)` and use it for the ~15 labels. Note: reading cookies makes the route dynamic — it already uses `createClient()` (cookies) so nothing changes.
4. First paint after a language switch can lag by one navigation (cookie set client-side) — acceptable; do NOT add middleware for this.

**Rejected alternatives:** per-label client components (death by a thousand islands, breaks metadata anyway); route-level `[lang]` segments (URL migration, sitemap churn — way out of scope this month).

## 13. Hard reminders

- **Never `git add .`** — secrets have landed in this tree before; add files by exact path.
- No secrets in code or commits; env vars go in Vercel dashboard (user does that manually).
- No paid tools/integrations without the user asking.
- No new vanity features — the month is i18n + retention loop + organizer supply (user-side).
- Never add `user_id` to the `interactions` table — analytics is PII-free by design.
- Commit only when the user says so; they eyeball surfaces in the browser first.
