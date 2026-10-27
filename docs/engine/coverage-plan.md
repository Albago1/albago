# Engine coverage plan: more Albanian events for the same free budget

**Status:** approved 2026-10-27 (D19–D23 as recommended).

- **Stage 1 is built.** The test fixtures are shaped like real pages rather than copied from them, because the repo is public. Real pages were checked in a dry run (memory only, no database writes), for example: 0 → 10 Albanian concerts from elinaduni.com, and 3 events with real dates from albanianregistry.org.
- **The dry run found two rules,** both added:
  - a date must state its day: "November 2026" is not a date;
  - "Elina Duni & Rob Luft" counts as Elina Duni.
- Stages 2–4 are not started.

**Date:** 2026-10-27
**Goal:** Find many more real Albanian events every month, still at zero cost. Four stages:

1. Read pages that list many events.
2. Re-read known websites for free.
3. Use official ticket APIs.
4. Keep a bank of search phrases that learns which searches work.

Each stage stands on its own and ships as its own commit.

---

## Where we stand (live database, 2026-10-27)

| Measure | Today |
|---|---|
| Discovery runs since 2026-10-04 | 117 (11 failed, mostly Gemini free-tier overload) |
| Tavily searches in October | 475 of the 900 cap |
| Events created, ever | about 54. 19 verified, 18 on AlbaGo. |
| Events per 100 searches | **about 11** |
| Different searches tried | 461. **Only 34 (7%) ever found an event.** |
| Artist watch | 19 runs, 72 searches, 85 pages read, **0 events** |
| Events found without using a search | **0** |
| Albanian events by country | US 17 · AL 9 · XK 8 · CH 8 · DE 3 · IT/GR/GB 0 |

Why:

1. **One event per page.** The engine only accepts a page that announces exactly one event. Artist tour pages, venue programmes and ticket-shop lists hold many events, so they are thrown away. Two rules do this:
   - the AI reader's rule "listings of many events → `is_event: false`" (`engine/extract/llm.ts`);
   - JSON-LD is only used when a page has exactly one Event (`engine/services/observe.ts`).
2. **Big ticket sites refuse our bot.** Ticketmaster, Bandsintown, SeatGeek and festivaly all failed to read.
3. **No free re-reading.** The agent has proposed 33 good websites, but the lane that re-reads them (W2 in `worldwide-plan.md`) was never built. Every event costs searches.
4. **Searches are guesses.** The AI invents its searches every run, keeps no memory of what worked, and repeats generic ones ("Albanian party Munich 2026"). It also tried to search again without reading first 337 times. Those were refused, but each one cost a Gemini call.
5. **The old crawler is broken.** 28 of the 31 sites in `public.crawl_sources` have the site's name pasted into the address. For example:

   ```
   https://tirana.al/%20%E2%80%94%20Tirana%20Municipality
   ```

   The old nightly crawler (`/api/cron/discover`) therefore finds nothing, every day.

---

## Stage 1: pages with many events

**Result:** tour pages, venue programmes and ticket-shop lists become events. This should take the artist watch from zero to useful.

**Engine (`engine/`):**

- New `observePage(input, ctx)`, the one entry point for a fetched page. It decides between one event and many:
  - **JSON-LD with 2 or more Events:** each Event becomes its own observation and goes through the normal `observe` pipeline. No AI.
  - **No JSON-LD:** one AI call, the *listing reader*. It returns up to 30 items. Each item has a title, date, time, venue, city, link and performers.
    - The current quote rule applies to every item. The date and venue must be copied word for word from the page, or they are dropped.
  - **Page facts carry over to items,** but only when the page states them. Examples: the artist on an artist's tour page, or the venue on a venue's own programme.
  - **One event on the page:** today's path, unchanged.
- **Items outside the goal window** are skipped before anything is written.
- **Detail links.** An item with its own link uses that link as its address. If the engine later reads the detail page, it merges into the same event instead of creating a duplicate.
- **Duplicate check.** A tour-page item "Yll Limani · 5 Dec · New York" must merge with a ticket page titled "Yll Limani in New York - 5 December". The rule: same date, same city, and the performer's name in both titles means the same event. It is tested on fixtures, and the matcher is tuned if needed.

**Agent (`engine/services/discover.ts`):**

- `submit_event` becomes `submit_page`, which accepts single-event and listing pages.
- Prompt rule 3 changes from "only pages with ONE event" to "event pages and pages that list events".

**Limits:** 30 items per page, and one AI call per listing page.

**Tests:** fixtures saved from real pages:

- an artist tour page;
- a venue programme with JSON-LD;
- a ticket-shop list without JSON-LD;
- a page whose items fall outside the window.

**Database:** no migration.

**Done when:** tests pass, and one artist run plus one city run on real pages produce events that were previously thrown away.

---

## Stage 2: known websites, re-read for free

**Result:** events found with **zero** search credits, from sites you approve once.

**Admin (`/admin/engine`):** a new **Sources** panel.

- It lists the proposed sites, each with the agent's reason.
- **Test** reads the page now (respecting robots.txt) and shows what it found, for example "12 upcoming events, 5 Albanian". Nothing is saved.
- **Approve** makes the site `active`. **Reject** keeps a reason, and the site is never proposed again.
- Each site has a check interval: every 3 days by default, daily for busy sites.
- Each site has a scorecard: visits, events found, Albanian events, events you approved, and errors.

**Monitoring lane (engine + `integrations/albago/`):**

- New route `/api/cron/engine-sources` with 3 daily slots, kept apart from the research slots so both fit inside 300 s.
- Each call re-reads up to 8 due sites through Stage 1's `observePage`.
  - An unchanged page (same fingerprint as last time) is skipped. No AI.
  - A page with JSON-LD events is read without AI.
  - Anything else costs one AI call per page.
- **Daily AI cap for this lane** (default 60 calls) protects the free Gemini quota.
- After 5 failures in a row, a site pauses itself and shows the reason.
- Runs are recorded with lane `monitoring`. The `engine.runs` table already allows this.

**Old sources:**

- The 31 `crawl_sources` are copied into `engine.sources` as `proposed`, with their broken addresses fixed. You then approve them like the others.
- Once they are covered, the old `/api/cron/discover` crawler is turned off (D21).

**Database:**

- One small migration: `engine.sources.last_content_hash text`.
- A one-time data copy of the old sources.
- Both are applied through the connector after your yes.

**Search credits used:** 0.

---

## Stage 3: official ticket APIs (direct lane)

**Result:** events straight from ticket companies. No AI, no search credits, no bot blocks.

### 3a: Ticketmaster Discovery API

- **Access.** A free key with 5,000 calls a day; the limit is 2–5 calls a second, depending on the docs page. You create the key at developer.ticketmaster.com, because I can't create accounts. Store it in Vercel as `TICKETMASTER_API_KEY`.
- **Connector.** New `engine/connectors/ticketmaster.ts` turns API records into evidence for `observe`. The key is passed in by the deployment; the engine never reads env.
- **Artist matching.** Each confirmed artist is looked up once on Ticketmaster.
  - Some names are common words (Besa, Fifi, Kida, Gashi, Enca, Majk, Noizy) and would match strangers.
  - So the first match for each artist waits for one click from you.
  - After that, the Ticketmaster id is stored on the artist, and their events are checked daily. The full list is about 160 calls, well inside the free quota.
- **Keyword checks.** A few keyword searches ("albanian", "shqip") per country add community events.
- **Database:** migration adding `engine.entities.external_ids jsonb`, which holds the Ticketmaster id per artist.
- **Terms** (read 2026-10-27):
  - no reselling of Ticketmaster data, and no making money from the API itself;
  - data is kept only as long as needed;
  - data is removed within 24 hours if Ticketmaster asks.

  This is fine for AlbaGo, which is free discovery that links to the ticket page. For the sold engine, each customer brings their own key and accepts the terms themselves. We never resell the data.
- **Coverage:** measured on the first run. No country list is assumed.

### 3b: Eventfrog (Switzerland, many diaspora parties), after 3a

- Eventfrog has a public read-only API, and "operators of event platforms" are a listed use case.
- Before building, we confirm the key and terms with Eventfrog.

### Not usable now

- **Bandsintown:** the API is only for artists and their teams, unless Bandsintown approves another use in writing. We could ask later.
- **Songkick:** closed to new users.
- **Eventbrite:** blocked by its terms.
- **Skiddle (UK):** free key, terms unclear. Later.

---

## Stage 4: search phrase bank

**Result:** searches go to phrases known to find events. The bank grows and prunes itself.

**Engine (neutral, keyed by criteria id, so another customer gets its own bank):**

- New table `engine.search_phrases`. Each row holds:
  - a phrase template with `{city}`, `{month}` and `{year}`;
  - its language, its kind (`city`, `region`, `worldwide`) and its origin (`seed`, `learned`);
  - an optional season;
  - counters: uses, results, pages read, events found, Albanian events found, last used, last hit;
  - a status (`active` or `retired`).
- **Before each run,** the engine picks 3 phrases for the job and hands them to the agent as "start with these proven searches":
  - 2 with the best score, where score = (Albanian events + 1) / (uses + 2);
  - 1 untried phrase, so new phrases get a fair chance.
- **The agent may still invent 1–2 new searches per run.** If one finds an Albanian event, it joins the bank, with the city and month turned back into placeholders.
- **A phrase retires** after 6 uses with no events. You can revive it.
- **Credit.** Every observation already records the search that led to it (`lead.query`). The run log also records which bank phrase each search came from, so counters update at the end of the run.
- **Seasons.** Flag Day phrases run only from 15 Oct to 30 Nov. Summer-festival phrases run from May to August.

**Admin:** a **Search phrases** table showing phrase, language, uses, events found and status. You can add phrases or retire them.

**Seed phrases** (`integrations/albago/`; edit freely):

| Language | Phrases |
|---|---|
| Albanian | mbrëmje shqiptare {city} · natë shqiptare {city} · koncert shqip {city} · festa shqiptare {city} · shoqata shqiptare {city} · stand up shqip {city} · teatër shqip {city} · koncerte {city} {month} {year} · *Festa e Flamurit {city}* · *28 Nëntori {city}* |
| German | Albaner Party {city} · albanische Party {city} · albanisches Konzert {city} · albanischer Abend {city} · albanische Nacht {city} |
| Italian | serata albanese {city} · festa albanese {city} · concerto albanese {city} |
| French | soirée albanaise {city} · concert albanais {city} |
| English | Albanian night {city} · Albanian party {city} · Albanian concert {city} · Albanian festival {city} · concerts {city} {month} {year} · *Albanian Independence Day {city}* |
| Swedish | albansk fest {city} · albansk konsert {city} |
| Dutch | Albanees feest {city} |
| Greek | αλβανική συναυλία {city} |

*Italic* = seasonal (Flag Day). "concerts / koncerte {city} {month} {year}" are for Albanian-speaking cities, where they were the best performers so far.

**Agent hygiene (D23):** after 2 refused searches in a row, the refusal names the unread results to read next. The model then stops spending calls on retries.

**Database:** migration creating `engine.search_phrases`, with the same lock-down as the other engine tables (RLS on, service role only).

---

## How we'll know it worked

A scoreboard from `engine.runs` and `engine.observations`, comparing the two weeks before and after each stage:

| Measure | Today |
|---|---|
| Events per 100 searches | about 11 |
| Share of searches that find an event | 7% |
| Artist-watch events per run | 0 |
| Events found with zero searches | 0 |
| Albanian events in DE / IT / GB | 3 / 0 / 0 |

A hand-checked test list (real events in Zurich, Munich and New York) would measure the share of *all* events we find. It is not in this plan, but is recommended next.

## Cost

Everything stays on free tiers:

- **Tavily:** fewer searches needed.
- **Gemini flash-lite:** paced, with a new daily cap for the monitoring lane.
- **Ticketmaster:** a free key.

No new paid service.

## Engine boundary

The generic parts go in `engine/` and keep the engine sellable:

- multi-event reading;
- the monitoring lane;
- API connectors;
- the phrase bank.

AlbaGo's parts stay in `integrations/albago/`: seed phrases, artist list, keys and cron routes. The boundary test keeps enforcing this.

## Order and shipping

1. **Stage 1** (Stages 2 and 3 benefit from it).
2. **Stage 2.**
3. **Stage 3a,** as soon as the Ticketmaster key exists. It can move earlier if the key arrives first.
4. **Stage 4.**
5. **Stage 3b,** after Eventfrog confirms.

Each stage is built, tested, committed as `Engine: …`, and reported with its scoreboard numbers before the next one starts. Each migration gets a one-line yes first.

## Decisions needed

| # | Decision | Recommendation |
|---|---|---|
| D19 | Approve the four stages and the order above | Approve |
| D20 | Ticketmaster key: you create a free account at developer.ticketmaster.com and add `TICKETMASTER_API_KEY` to Vercel | Do it when Stage 1 ships |
| D21 | Turn off the old `/api/cron/discover` crawler once Stage 2 covers its sources | Yes |
| D22 | New search phrases that found an Albanian event join the bank automatically (they are only search words, never published) | Yes. The alternative is to wait for your click. |
| D23 | Ride-along fix in Stage 4: stop the wasted repeat-search attempts | Yes |

## Not in this plan

- Selling and packaging: a standalone API and separate customers.
- **Making the GitHub repo private.** It is public today, so the engine can be copied. Do this before selling.
- The hand-checked test list.
- Instagram and Facebook. They stay uncollected; promoters posting their own events is the route there.
