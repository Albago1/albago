# i18n sprint handoff — 2026-07-06 (high-traffic Albanian sweep)

One focused batch: localize the public visitor path so Albanian visitors don't feel the platform is English-first, plus remove Pankartat from the public flow. All checks pass (tsc, eslint on touched files, `next build`).

## Files changed (13)

| File | What |
|---|---|
| `lib/i18n/translations.ts` | +74 new keys × 4 languages (en/de/es/sq). **All 4 blocks now at 337 keys, verified full parity.** New key groups: `home_*` (33), `events_*` (13), `protest_civic/expected`, `share_*` (11), `submit_*` (16), `view_all`. |
| `app/HomeClient.tsx` | Hero search placeholder + suggestions dropdown (Category/Explore/Upcoming/Cities/Browse by city), location picker (placeholder, "Use my current location", detecting, no-saved-location), Search button + hint, quick locations, "Across the platform", Featured events + sub, both "View all" links, Browse by category + sub, "{n} live" counter, "Venues in {city}" + sub, Upcoming protests section + empty state + "Post one", Featured-movement banner (reuses `protests_spotlight_label`) + title + body + "Enter the campaign". |
| `app/events/EventsClient.tsx` | Back link, header pill (All cities/Worldwide), H1 ("All events", "All events in {city}", "Results for"), hero subtitle, error card, all 3 empty states. |
| `components/cinematic/ProtestCard.tsx` | Now uses `useLanguage`; month/weekday formatted via `languageLocales[language]` (was hardcoded en-GB); "Civic" chip and "expected" label translated. |
| `components/share/ShareModal.tsx` | Header ("Share this event" + subtitle), Copy link/Link copied, Quick share, Send to a platform, Download share image, Download as Reel video, Caption/Copy caption/Copied. |
| `app/submit-event/SubmitEventClient.tsx` | Success screen (title, body, Reference, Browse events, Submit another — reuses existing `submit_another`), sign-in banner, AuthGateModal (both intro and final-gate variants: titles, bodies, draft-saves pills, Start my event, Sign in, Create account, Back to your draft). |
| `components/layout/Footer.tsx` | **Removed `/pankartat` link** from Explore column. |
| `app/movements/[slug]/MovementClient.tsx` | **Removed "Pankartat e Revolucionit" CTA** (whole Reveal block). |
| `app/events/albanian-revolution/AlbanianRevolutionClient.tsx` | **Removed Pankartat CinematicLink** from hero CTA row. |
| `app/protests/edi-rama-berlin-2026/EdiRamaBerlinClient.tsx` | **Removed Pankartat Link** from CTA row. |
| `app/press/page.tsx` | **Removed "Pankartat photo wall"** from the live-surfaces list. |
| `app/sitemap.ts` | **Removed `/pankartat` and `/pankartat/krijo`** from STATIC_ROUTES (route stays live, just not advertised to crawlers). |
| `app/protests/ProtestsClient.tsx` | Straggler tooltip ("Auto-updating as new protests are published") wired to new `protests_live_tooltip` key. |

## Pankartat public exposure — DONE (final 15-min pass)

Removed/neutralized: Footer, MovementClient, AlbanianRevolutionClient, EdiRamaBerlinClient, press page, sitemap, **FAQ Q&A deleted**, **/about mention neutralized** (authenticity copy kept, feature name dropped), **/pankartat noindexed** (`robots: { index: false, follow: false }`). Only private authed dashboard links remain (invisible to normal visitors). Feature code fully intact per instructions.

## Checks

- `npx tsc --noEmit` — **PASS** (clean).
- `npx eslint <touched files>` — **PASS except 1 pre-existing error** in `EdiRamaBerlinClient.tsx:42` (`react-hooks/set-state-in-effect`, setState in origin-detecting useEffect). Verified present at HEAD via `git stash` before my change — not introduced by this sprint. Fix idea: derive origin lazily at click-time instead of state+effect.
- `npx next build` — **PASS** (exit 0).
- Key parity — **verified programmatically**: en/de/es/sq all exactly 337 keys, no missing, no extras.
- Note: the full `next build` ran before the last two edits (sitemap array trim + ProtestsClient tooltip attr); tsc + eslint re-ran clean after them.

## Remaining English-heavy public surfaces (next i18n batch, in priority order)

1. `app/events/[slug]/page.tsx` — **event detail page is a server component**; `t()` from LanguageProvider (client context) doesn't reach it. Options: extract label strips into small client components, or read the language cookie server-side. Biggest remaining visitor surface.
2. `app/protests/ProtestsClient.tsx` — mostly wired already (`protests_*` keys); tooltip straggler fixed this sprint, re-grep for anything else.
3. `/about`, `/faq`, `/press`, `/contact`, `/organizers` — trust pages, fully English server components.
4. `app/map/*` — map UI chrome.
5. Event wizard steps (`components/event-wizard/*`) — the submit flow past the gate.
6. `app/sign-in`, `app/sign-up` — auth screens.
7. `components/events/EventsFilterBar.tsx` mobile sheet was done in `efc45ac`; double-check tag rail labels.

## Manual browser checklist (switch language to SQ in navbar)

1. Homepage: hero, search placeholder, suggestion dropdown headers, location picker, "Kërko" button, section headings (Evente të zgjedhura / Shfleto sipas kategorisë / Vende në {qytet} / Protestat e ardhshme), "Shiko të gjitha", movement banner, live counters ("N live").
2. /events: "Kthehu" back pill, H1 "Të gjitha eventet në Tiranë", subtitle, empty state after a nonsense search ("Nuk u gjetën evente për …").
3. Protest cards (homepage + /protests): month/weekday now in Albanian (e.g. "kor · e hën"), "Qytetare" chip, "X të pritur".
4. Event detail → Share: modal fully Albanian (Shpërndaje këtë event, Kopjo linkun, Shkarko imazhin…).
5. /submit-event logged out: intro gate ("Fillo tani, hyr më vonë"), banner, then submit success screen if testing E2E.
6. Footer: confirm **no Pankartat link**; /movements/albanian-revolution, /events/albanian-revolution, /protests/edi-rama-berlin-2026, /press: confirm **no Pankartat CTA**.
7. Sanity-check EN/DE/ES still render (no raw key names anywhere).
8. Light mode spot-check on homepage (strings unchanged structurally, should be fine).

## Git

Working tree at `7e0c798` + these 13 modified files + this doc. Safe add (NO `git add .`):

```
git add lib/i18n/translations.ts app/faq/page.tsx app/about/page.tsx app/pankartat/page.tsx docs/ops/opus-continuation-prompt.md app/sitemap.ts app/protests/ProtestsClient.tsx app/HomeClient.tsx app/events/EventsClient.tsx components/cinematic/ProtestCard.tsx components/share/ShareModal.tsx app/submit-event/SubmitEventClient.tsx components/layout/Footer.tsx "app/movements/[slug]/MovementClient.tsx" app/events/albanian-revolution/AlbanianRevolutionClient.tsx app/protests/edi-rama-berlin-2026/EdiRamaBerlinClient.tsx app/press/page.tsx docs/ops/i18n-sprint-handoff.md
```

Suggested commit message:

```
feat(i18n): localize homepage, events, share + submit flows; disconnect Pankartat from public

- 74 new keys x 4 languages (all blocks verified at 337-key parity)
- HomeClient: hero search, suggestions, location picker, all section
  headings, protest empty state, movement banner
- EventsClient: back/header/hero, error card, all empty states
- ProtestCard: locale-aware month/weekday, Civic + expected labels
- ShareModal + SubmitEventClient (gate + success) fully wired to t()
- Pankartat: links removed from footer, movement page, revolution hub,
  Edi Rama Berlin page, press page, sitemap; FAQ entry removed; about
  mention neutralized; /pankartat noindexed (feature code untouched)
```
