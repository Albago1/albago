# Event Intelligence Engine — Phase 0 Plan

**Status:** PLAN — awaiting approval. Nothing implemented; no code, schema, dependency or folder changed.
**Date:** 2026-10-04
**Builds on:** `docs/event-engine-architecture-assessment.md` (v2, approved direction) and the owner's approvals of
2026-10-04 (engine/ + integrations/albago/, `engine` Postgres schema, Observation → Occurrence, truth vs customer
preference, neutral taxonomy, zod, vitest, limited ports, media classes, venue mappings outside the engine,
Supabase CLI migrations, compliant-collection policy, n8n deferred, Phase 41 folded in).

**Acceptance test applied to every decision below** — fail any → reconsider:
1 movable to another repo · 2 consumable without AlbaGo · 3 new customer schema via adapter/config ·
4 acquisition ⟂ delivery · 5 AlbaGo rules outside the engine · 6 engine owns its canonical data ·
7 if AlbaGo vanished, sources/observations/venues/occurrences/corrections/dedup knowledge remain useful.

---

## 1. Minimal engine database model (schema `engine`)

Five tables. Everything else is folded into these or deferred (§2). RLS enabled on all five with **no policies**, so only
the service role can touch them; nothing in `engine` is reachable by AlbaGo's anon/authenticated users.

### `engine.sources` — the source graph (asset)
| column | notes |
|---|---|
| `id` uuid pk | |
| `connector` text | `website_html` · `website_jsonld` · `rss` · `text` · `ingest_api` · `search` (open set, validated in code) |
| `url` text, `normalized_url` text unique | |
| `label` text | |
| `scope` jsonb | `{country_codes:[…], localities:[…]}` — geography the source covers |
| `access` jsonb | `{basis:'public'|'permission'|'partner'|'api', terms_note, robots_ok, contact}` — **compliance record** |
| `enabled` bool, `check_interval_hours` int | |
| `last_checked_at`, `last_status` (`ok`/`empty`/`error`), `last_error` | |
| `created_at`, `updated_at` | |

### `engine.observations` — what a source reported (asset, immutable)
| column | notes |
|---|---|
| `id` uuid pk | |
| `source_id` uuid → sources (nullable: pasted text / ingest API without a registered source) | |
| `connector` text, `source_url` text, `normalized_url` text | |
| `retrieved_at` timestamptz | the reference date for resolving "Friday" / missing years |
| `content_hash` text | `unique (normalized_url, content_hash)` → unchanged page = no new observation, no AI cost |
| `evidence` jsonb | `{jsonld:[…], text_excerpt, title, meta, media:[{url, role:'poster'|'gallery', rights:'unknown'}]}` — references only |
| `extracted` jsonb | extractor output in **contract shape** + per-field `{status, evidence_span?}` |
| `extractor` text | e.g. `jsonld@1`, `llm:gemini-flash-lite@3` |
| `occurrence_id` uuid → occurrences (nullable) | set by reconciliation |
| `match` jsonb | `{decision:'new'|'attached'|'possible_duplicate', score, reasons:[…], candidate_ids:[…], decided_by:'rule'|'human'}` — **dedup history (asset) without a separate table** |
| `status` text | `extracted` · `not_event` · `failed` |
| `error` text, `created_at` | |

Observations are never updated after reconciliation except `occurrence_id`/`match` (and those changes are logged in `review_actions`).

### `engine.occurrences` — what the engine believes (asset)
| column | notes |
|---|---|
| `id` uuid pk — stable public id | |
| contract columns | `title`, `description`, `language`, `event_type` (engine taxonomy), `tags` text[], `start_date` date, `start_time` time **null**, `end_date`, `end_time`, `timezone`, `venue_id` → venues, `venue_text`, `locality`, `country_code` char(2), `lat`, `lng`, `organizer_name`, `performers` text[], `price` jsonb `{state:'free'|'paid'|'unknown', min, max, currency, note}`, `ticket_url`, `status` (`scheduled`/`cancelled`/`postponed`/`rescheduled`) |
| `provenance` jsonb | `{field: {status:'stated'|'derived'|'missing'|'conflicting', observation_id, agree:int}}` |
| `review_status` text | `needs_review` · `verified` · `rejected` |
| `verified_at`, `verified_by` | |
| `version` int | bumps on every accepted change (adapters deliver by version) |
| `created_at`, `updated_at` | |

### `engine.venues` — neutral venue/entity graph (asset)
`id`, `name`, `aliases` text[], `address`, `locality`, `country_code`, `lat`, `lng`, `website`, `created_from_observation`,
`created_at`, `updated_at`. **No customer ids here** — AlbaGo's `place_id` mapping lives in AlbaGo's schema (§4).

### `engine.review_actions` — human corrections + audit (asset)
`id`, `occurrence_id`, `observation_id` (nullable), `action` (`verify`/`reject`/`edit`/`attach`/`detach`/`create_venue`),
`changes` jsonb (`{field: {from, to}}` — extracted value → human value), `reason`, `actor` (uuid, opaque to the engine),
`created_at`.
Cheap now, impossible to recover later: every correction from day one is training/evaluation data and the basis for
source reliability.

---

## 2. Deferred tables

| Proposed earlier | Decision | Why it can wait |
|---|---|---|
| `consumers` | **Design boundary now / build later** | One consumer. The `OutputAdapter` interface carries the consumer identity; no table needed until a second consumer exists. |
| `deliveries` | **Design boundary now / build later** | For AlbaGo, delivery state lives on the consumer side: `public.events.engine_occurrence_id` + `engine_version` (§4). A generic engine-side ledger is needed only for webhooks/feeds/2nd consumer. |
| `jobs` (queue + leases) | **Build later (M2)** | 10 sources × daily = small batches that fit Vercel Cron within 300 s. Revisit when a run no longer fits. |
| `runs` | **Build later (M2)**; v1 logs to `sources.last_*` + existing `ai_usage` | Per-source last status is enough at 10 sources. |
| `match_decisions` | **Folded** into `observations.match` | Same information, one less table. |
| `corrections` | **Folded** into `review_actions.changes` | |
| media store / `engine.media` | **Design boundary now / build later** | v1 stores media **references** in observations only (media class 1, §5.4). |
| tenants, API keys, per-customer config storage, webhooks, CSV/REST export | **Do not build yet** | No customer. |

---

## 3. Engine public API / contracts

### 3.1 Contract (zod, versioned) — `engine/contract/`
- `CanonicalOccurrenceV1` — the occurrence columns above + `provenance`, `id`, `version`, `review_status`. JSON Schema export
  for future external consumers. Additive changes only within v1.
- `EventTypeV1` — the neutral taxonomy (§3.3).
- `FieldStatus`, `PriceV1`, `VenueRefV1`, `ObservationInputV1` (what any input connector hands to the engine).
- zod used **only** at these public boundaries and on LLM output; internal objects stay plain TS types.

### 3.2 API — `engine/index.ts` (in-process now; maps 1:1 to future `/api/engine/v1/*`)
```ts
createEngine(deps: { store, fetcher, extractor, geocoder, config }): Engine

engine.observe(input: ObservationInputV1)            // extract → normalize → resolve → reconcile → validate
  → { observationId, occurrenceId | null, outcome: 'new'|'attached'|'possible_duplicate'|'unchanged'|'not_event'|'failed' }
engine.sources.list() / add() / update() / runDue(now)   // runDue: each due source through its InputConnector → observe()
engine.review.queue(filter) / get(occurrenceId)          // occurrence + its observations + conflicts + duplicate candidates
engine.review.verify(occurrenceId, edits, actor)        // writes review_actions, sets verified, bumps version
engine.review.reject(occurrenceId, reason, actor)
engine.review.attach(observationId, occurrenceId, actor) // resolve a possible duplicate
engine.occurrences.get(id) / listVerified(filter)       // what adapters read
engine.deliver(occurrenceId, adapter: OutputAdapter, cfg) // calls adapter.deliver/update; returns externalId
```

### 3.3 Neutral taxonomy v1 (16 types)
`concert` · `club_night` · `party_social` · `festival` · `theatre` · `opera_ballet_classical` · `comedy` · `film` ·
`exhibition` · `talk_workshop` · `sports_match` · `sports_participation` · `food_drink` · `family` · `market_fair` ·
`community_civic` · (`other` fallback).
`community_civic` exists because the engine must stay **neutral**: classifying an event is an engine fact; *not
publishing* it is AlbaGo policy. ⚠ This contradicts the current AI prompts, which reject protests at extraction time — an
AlbaGo rule that leaked into what becomes engine code. Proposed: engine classifies; `integrations/albago/policy.ts` drops
`community_civic`. AlbaGo's product rule ("no protests on AlbaGo") is unchanged. **Needs your decision (§11, D3).**

### 3.4 Plugin interfaces
```ts
interface InputConnector  { kind; discover?(source, deps): Promise<ItemRef[]>; acquire(item, deps): Promise<ObservationInputV1> }
interface OutputAdapter   { id; deliver(o: CanonicalOccurrenceV1, cfg): Promise<{externalId}>;
                            update(o, externalId, cfg): Promise<void>; retract(externalId, reason, cfg): Promise<void> }
```

---

## 4. AlbaGo adapter responsibilities — `integrations/albago/`

| File | Owns |
|---|---|
| `wiring.ts` | Builds the engine with AlbaGo's deployment: Supabase service client scoped to schema `engine` (store), `safeFetch` (fetcher), AI SDK model (extractor), Nominatim (geocoder), config |
| `adapter.ts` | `OutputAdapter`: verified occurrence → `public.events` row in **one server-side transaction** (RPC), idempotent by `engine_occurrence_id`; `update` on newer `version`; `retract` → unpublish (never delete) |
| `mapping.ts` | engine taxonomy → AlbaGo 5 categories; ISO country + locality → AlbaGo `location_slug`/labels; languages; price → AlbaGo price display fields |
| `policy.ts` | AlbaGo acceptance/publishing rules: required fields (today's `approvalValidation` + `listing-quality-standard.md`), excluded types (`community_civic`), geography beat, auto-deliver-on-verify |
| `venues.ts` | `public.place_engine_venues (place_id, engine_venue_id)` mapping — customer ids never enter `engine.venues` |
| `media.ts` | Media class 3/4: decide per image whether AlbaGo links, copies (only `rights ∈ {owned, licensed, organizer_provided}`) into AlbaGo Storage, or omits |
| `scout-beat.ts` | Today's 27-area Scout beat (AlbaGo configuration, not engine logic) |
| migrations (AlbaGo side) | `public.events.engine_occurrence_id uuid unique`, `engine_version int`; `public.place_engine_venues` |

AlbaGo UI (review screen, sources screen) lives in `app/admin/engine/**` and calls **only** `engine/index.ts` through
`integrations/albago/wiring.ts`.

---

## 5. Dependency boundaries / interfaces

### 5.1 Ports — only four now
| Port | Purpose | v1 implementation (in `integrations/albago/wiring.ts`) |
|---|---|---|
| `EngineStore` | all engine persistence | supabase-js service client, `.schema('engine')` |
| `Fetcher` | HTTP acquisition (SSRF-safe) | existing `safeFetch` (moved into engine; it's generic) |
| `Extractor` | AI extraction (text/poster → contract) | Vercel AI SDK (`generateText` + zod-validated JSON) |
| `Geocoder` | address → coordinates | Nominatim (existing code) |
Not ports: clock and config are plain function parameters; media store is deferred; scheduler is whoever calls `runDue()`.

### 5.2 Lint rules (`eslint.config.mjs`, `no-restricted-imports`)
- `engine/**` ✗ `@/app/*` `@/components/*` `@/lib/*` `@/integrations/*` `next` `next/*` `react` `server-only`; ✗ `process.env`
  (custom rule or grep check in CI script).
- `integrations/albago/**` ✓ `@/engine` (index only) + AlbaGo code.
- `app/` `components/` `lib/` ✓ `@/engine` index only, ✗ `@/engine/*` deep imports.
- tsconfig path `@/engine` → `engine/index.ts`.

### 5.3 Runtime
Engine is plain TypeScript (ES modules), no Next.js APIs, so it runs under Next route handlers today and a plain Node
server/worker later.

### 5.4 Media classes (approved distinction)
1. **Source media reference** — URL + role + `rights:'unknown'` in `observations.evidence.media`. v1: only this.
2. **Engine-held media** — copies the engine may legally store (later; needs `MediaStore` port + rights basis).
3. **Delivered media** — what an occurrence offers a consumer (reference or engine-held copy).
4. **Customer storage** — AlbaGo Storage; decided and done by `integrations/albago/media.ts`.
Consequence: the paused "photo fix" (load external images directly) is **superseded** — recommend discarding it and
handling images in the adapter (D6).

---

## 6. Existing modules that migrate into the engine

| Today | → Engine | Change needed |
|---|---|---|
| `lib/ssrfGuard.ts` | `engine/acquire/fetch.ts` | none (generic) |
| `lib/radar/normalizeUrl.ts` | `engine/core/url.ts` | none |
| `lib/crawl/discover.ts`, `lib/crawl/site.ts` | `engine/connectors/website/` | inject fetcher |
| `lib/ai/urlReader.ts` (`fetchUrlContent`, JSON-LD/meta) | `engine/extract/html.ts` + `engine/extract/jsonld.ts` | split deterministic JSON-LD path out; validate it (see almanart end<start bug) |
| `lib/ai/posterReader.ts`, `promptReader.ts`, `parseModelJson.ts` | `engine/extract/llm/` | prompts use engine taxonomy, keep source language, field status; remove AlbaGo category list |
| `lib/lens/resolve.ts` — pure parts (`titlesMatch`, `normalizeVenueTokens`, `venueMatchTier`, `matchVenueCandidates`, `matchCityLocal`, `stemCityName`, `haversineKm`) | `engine/core/match/`, `engine/core/geo/` | none |
| `lib/lens/resolve.ts` — I/O parts (reads `places`, `events`, `event_submissions`, AlbaGo locations) | rewritten as `engine/services/resolve.ts` against `engine.venues` / `engine.occurrences` | the core decoupling |
| `lib/radar/assess.ts` | split: universal checks → `engine/core/validate.ts`; AlbaGo listing rules → `integrations/albago/policy.ts` | |
| `lib/radar/discoveryClassify.ts`, `lib/radar/verifyDecide.ts` | `engine/core/` | none (pure) |
| `lib/radar/discovery.ts`, `lib/radar/verify.ts` | `engine/services/sources.ts` (re-observation replaces verify) | write observations, never `public.events` |
| `lib/ingest/schema.ts` | `engine/connectors/ingest-api/` | output `ObservationInputV1` |
| `lib/scout/search.ts` | `engine/connectors/search/` | provider via extractor port; beat → AlbaGo config |
| `lib/recurrence.ts`, `lib/timezone.ts` (date math) | `engine/core/time/` | timezone map becomes country-based data, not AlbaGo slugs |
| Phase 41 41.2–41.4 (ISO countries, locality aliases, price states) | `engine/core/normalize/` | built once here |

## 7. Modules that stay AlbaGo-specific

`lib/wizardSubmit.ts`, `lib/eventDraftFromReading.ts`, `lib/eventDraftFromRow.ts`, `components/event-wizard/**`
(community/organizer creation — AlbaGo product; may later feed the engine as an input connector),
`lib/crawl/toSubmission.ts` (**retired** — replaced by the adapter), `lib/radar/approvalValidation.ts` (→ `policy.ts`),
`lib/radar/candidate.ts` + `event_import_candidates` (**retired** after cut-over, kept read-only),
`lib/lens/scanLimiter.ts`, `lib/lens/enrich.ts` (Lens consumer feature), `lib/agent/**` (Compose — AlbaGo admin UI; will
call `engine.observe`), `lib/ai/{captionWriter,posterArtDirection,translateEvent,studioAccess,textModel}.ts`,
`lib/media/remoteImage.ts` (→ `integrations/albago/media.ts`), `lib/locations.ts`, `lib/seo/**`, `lib/share/**`,
`lib/scout/brief.ts` beat (→ `integrations/albago/scout-beat.ts`), all `app/**` routes (they become thin callers).

---

## 8. Migration strategy (strangler pattern — no big bang)

The old pipeline keeps running until the new one has proven itself on the same sources.

| Step | What | Production impact |
|---|---|---|
| **B1 Baseline** | Supabase CLI init + link (you run `supabase login`); `supabase db pull` → `supabase/migrations/<ts>_baseline.sql` = today's real `public` schema (tables, RLS, RPCs, triggers); diff against `docs/schema-reference.md` + audit; document drift in `docs/engine/baseline-report.md`; mark baseline as already applied (`supabase migration repair --status applied`). | **None** — read-only pull; nothing recreated. |
| **B2 Characterization tests** | vitest; port `scripts/radar-test.mjs`; add tests that pin today's behaviour of every module in §6 (fixtures: saved HTML of ~10 real pages, recorded model JSON). | None |
| **B3 Skeleton + boundary** | `engine/`, `integrations/albago/`, lint rules, tsconfig alias, contract v1 + taxonomy (types/zod only). | None |
| **B4 Move pure modules** | One module per commit into `engine/`, old path re-exports it; characterization tests must stay green. | None |
| **B5 Engine schema** | Migration creating schema `engine` + 5 tables (additive; touches nothing in `public`). Reviewed by you, applied via CLI. | Additive |
| **B6 New path, shadow mode** | `engine.observe` + `runDue` on the 10 approved sources, writing only to `engine.*`. Old Radar keeps feeding AlbaGo. Compare outputs. | None to AlbaGo |
| **B7 Review + adapter** | `app/admin/engine` review screen; AlbaGo migration (`engine_occurrence_id`, `place_engine_venues`); server-side adapter RPC. Verified engine events start publishing. | AlbaGo gets events from the engine |
| **B8 Re-point intakes** | Radar URL/text paste, `/api/ingest`, Scout, Compose → `engine.observe`. Backfill existing AlbaGo events as observations from source `albago-legacy` so matching sees them. | Old candidate path idle |
| **B9 Retire** | Stop writing `event_import_candidates`/import submissions; keep tables read-only for history. Community wizard unchanged. | Cleanup |

## 9. Regression-test strategy (before moving code)

1. **Unit / characterization (vitest, fast, no network, no AI):** pin current outputs for `normalizeImportUrl`,
   `titlesMatch`, venue tiers incl. tie-demotion, city matching, `assessReading`, `coercePosterReading` (recorded model
   JSON as input), JSON-LD/meta extraction (saved HTML fixtures), `decideVerify` verdicts, recurrence/date helpers,
   SSRF guard (private ranges, redirects). Each move (B4) must keep these green — behaviour changes are separate,
   reviewed commits.
2. **Contract tests:** zod round-trip of `CanonicalOccurrenceV1`; AlbaGo mapping table tests (every engine type maps;
   every ISO country used in the beat maps to a location).
3. **Golden set (eval, manual run, costs AI tokens):** ~50 labelled items from the approved sources (incl. known traps:
   almanart's end-before-start, price "0", overnight club nights, Albanian month names, missing year). Scores per field;
   any prompt/model change must not lower date/time accuracy.
4. **Boundary check:** lint run + a script that imports `engine/index.ts` in plain Node (no Next) to prove portability (tests 1–2).
5. **Shadow comparison (B6):** old vs new pipeline on the same pages before cut-over.

Fixtures stored under `tests/fixtures/` (saved pages are for private testing only, not republished).

---

## 10. Candidate Tirana sources

Probed 2026-10-04 with one polite request per page (robots.txt checked with a standard parser for generic crawlers).

| # | Name | URL | Type | Categories | Frequency (observed) | Collection method | Access / reliability concerns | Why useful |
|---|---|---|---|---|---|---|---|---|
| 1 | Almanart | almanart.al | Culture & nightlife agenda (aggregator) | club nights, brunch DJs, exhibitions, concerts, theatre; multi-city | Daily (18 events on home, 7 Tirana; per-occurrence URLs) | JSON-LD `Event` + listing pages | Aggregator → reuse permission advisable; **JSON-LD contains errors** (end before start, price "0") | Best structured source; ideal test of "verify JSON-LD, don't trust it" |
| 2 | MyTicket | myticket.al/events-blog.php | Ticketing platform | concerts, festivals, theatre, sports | Weekly | HTML (server-rendered, 42k chars), no JSON-LD | Commercial seller → partnership ideal; no robots.txt | Big-ticket concerts/festivals with prices + ticket links |
| 3 | Vivere | vivere.al | Ticketing platform | concerts, shows, theatre | Weekly | HTML event pages (`index.php?idev=`) | Commercial; query-string URLs need normalization | Second ticketing source → cross-source dedup test |
| 4 | GoWild | gowild.al/event/… | Nightlife/events platform | club nights, parties, brunch, festivals | Several/week (23 on home) | HTML event pages (no JSON-LD) | Platform content → permission advisable; images hosted there (cookie/privacy issue seen) | Strongest **nightlife** source — clubs otherwise live on Instagram |
| 5 | TKOB — National Opera & Ballet | tkob.gov.al | Public institution | opera, ballet, classical | Monthly repertoire | HTML repertoire pages | Low legal risk (public body); no robots.txt | Reliable primary venue; multi-performance occurrences |
| 6 | National Theatre | teatrikombetar.gov.al | Public institution | theatre | Weekly | **RSS** (`/feed/`) + HTML | Low risk | RSS connector test; primary venue |
| 7 | Visit Tirana | visit-tirana.com/events | Tourism portal | festivals, film, city events | Weekly | **RSS** (`/events/feed/`) + HTML | Ownership/terms unclear | City-wide festivals; tourism angle (B2B relevance) |
| 8 | University of Arts | uart.edu.al | Institution | classical concerts, performances, exhibitions | Irregular (news posts) | HTML | Event info mixed into news → detection test | Free cultural events, primary source |
| 9 | Football Federation (FSHF) | fshf.org | Sports body | `sports_match` (national team, Superiore) | Weekly in season | HTML (WordPress) | Fixtures pages may be tables | Covers a category none of the others do |
| 10 | Kinema Millennium | kinemamillennium.com | Cinema | `film` | Daily screenings | HTML program | High volume of near-identical screenings | Stress-tests the occurrence model + dedup |
| 11 | Cineplexx Tirana | cineplexx.al | Cinema chain | film | Daily | **JS-rendered** (58 chars of HTML) | Needs rendered fetching | Later (M2) |
| 12 | BunkArt | bunkart.al | Museum/venue | exhibitions, events | Monthly | **JS-rendered** | Needs rendered fetching | Later |
| 13 | Tirana Film Festival | tiranafilmfest.org | Festival | film (annual) | Seasonal | HTML + RSS | Annual burst | Later (festival-season test) |
| 14 | Shqiptarja — "Aktivitetet kulturore" | shqiptarja.com/lajm/aktivitetet-kulturore-… | Media daily agenda | multi-city culture roundup | Daily | Multi-event text extraction | Article copyright → **lead only**, publish from primary sources | Discovery feed of what's on nationally |
| 15 | Love Albania | lovealbania.al/things-to-do-in-tirana | Blog weekly roundup | mixed | Weekly | Multi-event text | Editorial content → lead only | Discovery leads |
| 16 | Tirana Municipality | tirana.al | Public body | Artfest, marathon, city festivals | Seasonal | News pages (no event listing found yet) | Calendar location unknown | Later once the calendar is located |
| 17 | AllEvents (Tirana) | allevents.in/tirane | Aggregator | mixed | Daily | JSON-LD | Second-hand data; terms restrict reuse | Lead only, never published from |
| 18 | Eventbrite (Tirana) | eventbrite.com | Platform | mixed | Weekly | Official API only covers own-org events; page scraping against terms | **Not for M1** |
| 19 | Songkick (Tirana) | songkick.com | Concert DB | concerts | Weekly | Partner API (application required) | Terms | Later partnership |
| 20 | Venue/club Instagram accounts (e.g. Frekuence Club) | instagram.com | Social | club nights | Daily | **Only** official API / organizer submission / pasted URLs | No unauthorized scraping | Via organizer onboarding, not M1 |

### Recommended 10 for Milestone 1
**1 Almanart, 2 MyTicket, 3 Vivere, 4 GoWild, 5 TKOB, 6 National Theatre, 7 Visit Tirana, 8 University of Arts,
9 FSHF, 10 Kinema Millennium.**
Covers 6 connector shapes (JSON-LD, RSS, server HTML, query-string pages, news-mixed, high-volume schedules), all major
categories, two ticketing platforms for cross-source dedup, and the strongest nightlife source.
**Policy suggestion:** for the four commercial platforms (1–4), send a short permission/partnership email before AlbaGo
publishes their events; until answered, their observations can be collected and reviewed but delivered only after
confirming against the venue/organizer (D8).

---

## 11. Exact first implementation sequence (each step = one approval-gated, test-green commit)

| # | Step | Needs from you |
|---|---|---|
| 1 | `supabase` CLI added as dev dep; `supabase init`; you run `supabase login` + `supabase link` (password stays with you) | Login/link |
| 2 | `supabase db pull` → baseline migration (read-only) + `docs/engine/baseline-report.md` (drift vs docs) | Review report |
| 3 | Mark baseline applied (`migration repair`) — no SQL executed against prod | Approve |
| 4 | vitest + `npm test`; port `scripts/radar-test.mjs` | — |
| 5 | Characterization tests for every §6 module + saved HTML fixtures | — |
| 6 | `engine/` + `integrations/albago/` skeleton, lint boundary, `@/engine` alias, plain-Node import check | — |
| 7 | Contract v1 (zod) + taxonomy + JSON Schema export + `docs/engine/contract-v1.md` | **Approve contract** |
| 8 | Move pure modules (§6, pure rows) one per commit with re-exports | — |
| 9 | `engine` schema migration (5 tables) — you apply via CLI | **Approve SQL** |
| 10 | Ports + `integrations/albago/wiring.ts`; `engine.observe` (JSON-LD → LLM fallback → normalize → resolve → reconcile → validate) | — |
| 11 | Connectors for the 10 approved sources; `runDue` behind existing cron, **shadow mode** | Source list approval (§10) |
| 12 | Golden set (50 items) + eval script; shadow comparison report | Review report |
| 13 | Review screen `app/admin/engine`; AlbaGo migration (`engine_occurrence_id`, `place_engine_venues`); adapter RPC | **Approve SQL** |
| 14 | Go live: verified occurrences publish to AlbaGo | **Go/no-go** |
| 15 | Re-point Radar/ingest/Scout/Compose; legacy backfill; retire old import path | — |

Agents (as approved): steps 1–3, 7, 9, 13 by the main agent (shared contracts/schema); 5, 8, 10–12 delegated to the
Engine agent in an isolated worktree with the contract and tests as its gate; `/code-review` after each delegated step.

---

## 12. Decisions needed before step 1

| # | Decision | Recommendation |
|---|---|---|
| D1 | Approve the 5-table minimal model (§1) and deferrals (§2) | Approve |
| D2 | Approve API/ports/lint boundaries (§3, §5) | Approve |
| D3 | Engine classifies `community_civic` neutrally; AlbaGo policy excludes it (reverses the "reject at extraction" prompt rule for engine code only) | Approve — required for neutrality |
| D4 | Supabase CLI as a dev dependency; you run `login`/`link` | Approve |
| D5 | Approve the 10 sources (§10) | Approve or swap |
| D6 | Discard the paused, uncommitted photo fix (local changes + `lib/imageSrc.ts`); images handled by `integrations/albago/media.ts` | Discard |
| D7 | `engine` schema exposed to the Data API for the service role only (Supabase dashboard → API → exposed schemas) — or access via RPC instead | Expose, service-role only |
| D8 | Commercial-platform policy: email for permission; publish their events only after confirming with venue/organizer until answered | Approve |
| D9 | Taxonomy v1 (16 types) | Approve or edit |
