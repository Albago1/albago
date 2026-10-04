# Event Intelligence Engine — Architecture Assessment

**Status:** ASSESSMENT v2 — awaiting approval. No code, schema, dependency or folder has been changed.
**Date:** 2026-10-04
**v2 change:** incorporates the commercial requirement that the engine be **independently sellable**, with
AlbaGo as its first consumer (§3, §4, §9 rewritten; §9 answers the five independence checks).
**Inputs read:** the repository (`lib/{lens,radar,crawl,scout,ingest,agent,ai}`, `app/api/*`, `vercel.json`,
`docs/seeds/*`), `docs/event-system-audit-2026-08-12.md` (2,500-line current-state audit written for this purpose),
`docs/master-plan/07-crawl.md`, `docs/product-bible/11-ai-roadmap.md`, `docs/phase-41-platform-cleanup-plan.md`,
and the live database (read-only counts).

---

## 0. Verdict

The direction is right: an engine separate from AlbaGo, a neutral canonical contract, adapters on the way out,
provenance, "AI proposes / code verifies", human approval first. But this is not greenfield — **~60% of the
pipeline already exists** (~6,000 lines). It is, however, **wired directly into AlbaGo** (tables, cities,
categories, storage, Next.js), so today it fails every independence check (§9). The plan is therefore:
**extract the existing logic into an engine that owns its own data and talks to AlbaGo only through an adapter** —
not a rewrite, and not a monorepo. The binding constraint remains supply (42 published events, 4 upcoming).

---

## 1. What exists today

| Stage | Exists? | Where | Gap |
|---|---|---|---|
| Source registry | Basic | `crawl_sources`, `/admin/sources`, `lib/crawl/sourceStore.ts` | No type/trust/interval/history |
| Discovery | Yes | `lib/radar/discovery.ts`, `lib/crawl/{discover,site}.ts`, Scout | Same-host depth 1; no RSS/iCal; no JS rendering |
| Acquisition | Yes | `safeFetch` + `lib/ssrfGuard.ts`, `fetchUrlContent()` | No retry, no robots `Disallow`, regex parsing |
| Raw evidence | Partial | `event_import_candidates.source_url/image_url/parser_version` | Raw text, content hash, retrieval time not stored |
| Detection + extraction | Yes | `PosterReading` via Vercel AI SDK (`lib/ai/*Reader.ts`) | No JSON-LD-first path; no field status; categories/languages are AlbaGo's |
| Normalization | Partial | `coercePosterReading`, `lib/timezone.ts`, `lib/recurrence.ts` | Country/city/price normalization missing |
| Venue resolution + geocoding | Yes (good) | `lib/lens/resolve.ts` | Resolves against AlbaGo's `places`; places never created |
| Dedup | Weak | URL key + advisory same-date/city/title warning | No cross-source identity, no merge |
| Validation + assessment | Yes | `lib/radar/{assess,approvalValidation}.ts` | Mixes universal checks with AlbaGo listing rules |
| Review | Yes, twice | `/admin/event-radar` → `event_submissions` → `/admin/queue` | Two approvals; client-side, non-transactional publish |
| Update monitoring | Partial | `lib/radar/verify.ts` | Reads/writes AlbaGo `events` directly |
| Scheduling | Yes | Vercel Cron 03:00/04:00/05:00 | No runs, no queue/lease, `CRON_SECRET` possibly unset |
| Tests | Minimal | 3 hand-rolled Node scripts | ~4 of ~25 pure modules covered |
| Schema in VCS | **No** | base tables never committed; no migration ledger | Blocks safe schema work |

---

## 2. Challenging the proposal

### Keep
1. Engine ≠ AlbaGo; AlbaGo is consumer #1. 2. Canonical contract + adapters. 3. Provenance, unknown stays unknown,
AI proposes / code verifies. 4. Human approval first. 5. Business logic in source-controlled code, not n8n.

### Change
1. **Observation vs Canonical.** Don't make one canonical object carry everything. Store each source reading as an
   immutable **Observation** (raw evidence + extracted fields + extractor version); the **Canonical Occurrence** is the
   merged belief, each field pointing to the observation it came from. Field provenance, cross-source merging,
   update detection and "learn from corrections" all fall out of this.
2. **Occurrence is the canonical unit** (one start, one place). Series/tours/festivals group occurrences.
3. **Deterministic field status** (`stated` / `derived` / `missing` / `conflicting` + agreeing-observation count)
   instead of LLM-reported or numeric confidence. Keep the explainable high/medium/low summary label.
4. **Split verification from publication.** *"Is this event real and correctly described?"* is universal — the
   engine's review answers it once, and the answer is a shared asset. *"Does consumer X want it?"* is a per-consumer
   policy applied at delivery. AlbaGo's listing standard is a delivery policy, not engine logic.
5. **One review step**, server-side delivery in one transaction.
6. Detection + extraction stay **one AI call** (already the case).

### Unnecessary now
Full multi-tenancy, per-customer config UIs, webhook/CSV/custom adapters, AI schema-mapping, embeddings/ML dedup,
n8n, monorepo, calibrated numeric confidence.

### Missing
Supply strategy for social-only venues (§6); migration ledger; golden evaluation set; first-class change/cancel;
runs/cost/error visibility; folding Phase 41 normalization into the engine.

### Dangerous
Scraping Instagram/Facebook (Meta terms; also a due-diligence liability for any sale); rebuilding instead of
extracting; inert crons without `CRON_SECRET`; re-hosting third-party images without rights.

---

## 3. Recommended architecture

### 3.1 Layers and placement

```
repo root
├── engine/                      ← customer-neutral; could be moved to its own repo
│   ├── contract/                  canonical types + validators (versioned, e.g. v1) — the public contract
│   ├── core/                      PURE logic: normalize, dates/tz, match, field status, assess, taxonomy
│   ├── extract/                   extraction (JSON-LD first, AI second) — prompts use ENGINE taxonomy
│   ├── connectors/                InputConnector implementations (website, text, ingest-api, search)
│   ├── ports/                     interfaces the engine needs from the outside world:
│   │                                Store (Postgres), Fetcher, LLM, Geocoder, MediaStore, Clock, Config
│   ├── services/                  orchestration: ingest, review, deliver, verify, runs/jobs
│   ├── delivery/                  OutputAdapter interface + delivery bookkeeping (no customer code)
│   └── index.ts                   THE public API — the only thing outsiders may import
│
├── integrations/
│   └── albago/                  ← AlbaGo-specific, imports engine/index.ts only
│       ├── adapter.ts             OutputAdapter: canonical occurrence → AlbaGo events row (server-side, 1 transaction)
│       ├── config.ts              AlbaGo tenant config: geography beat, taxonomy→AlbaGo categories, languages,
│       │                          acceptance policy (listing-quality standard), delivery rules
│       └── wiring.ts              binds engine ports to this deployment (Supabase, AI SDK, Nominatim, storage)
│
└── app/, components/, lib/      ← AlbaGo product; may import engine/index.ts and integrations/albago only
```

### 3.2 Boundary rules (enforced by ESLint `no-restricted-imports`)
- `engine/**` may **not** import: `@/app/*`, `@/components/*`, `@/lib/*`, `@/integrations/*`, `next`, `next/*`,
  `react`, `server-only`, or read `process.env` directly (config arrives through the `Config` port).
- `integrations/albago/**` may import `@/engine` (index only) and AlbaGo code.
- `app/`, `components/`, `lib/` may import `@/engine` (index only) — never `@/engine/core/...` internals.

### 3.3 Data ownership
- Engine tables live in a separate Postgres schema **`engine`**; the engine **never reads or writes `public.*`**.
  AlbaGo's tables stay in `public` and are written only by `integrations/albago/adapter.ts`.
- Engine tables (v1): `sources`, `observations`, `occurrences` (canonical), `occurrence_fields` (or a jsonb field map
  with observation refs), `venues` (+ aliases), `match_decisions`, `review_actions` (incl. corrections as diffs),
  `consumers`, `deliveries` (occurrence → consumer, external_id, status, delivered_version), `runs`, `jobs`.
- Engine media in its own storage bucket (`engine-media`), with a rights flag per image.
- AlbaGo's `events` gains one column, `engine_occurrence_id` (unique), so delivery is idempotent and updates/retractions
  flow to the right row. AlbaGo's `places` becomes a consumer-side copy linked to `engine.venues` by id.

### 3.4 Neutral vocabulary
- **Taxonomy:** a small engine taxonomy (~15 hierarchical codes, e.g. `music.concert`, `nightlife.club_night`,
  `arts.theatre`, `film.screening`, `sports.match`, `food.festival`, `festival.multi`, `community.meetup`, …) plus
  free tags. AlbaGo's five categories are a **mapping in `integrations/albago/config.ts`**.
- **Geography:** ISO 3166 country, locality name + coordinates (+ optional GeoNames id later). AlbaGo's `location_slug`
  is produced by the adapter, not stored in the engine.
- **Languages:** extraction keeps the source language as data; which translations to produce is consumer config.

### 3.5 Interfaces (shape only — not implemented yet)
```ts
interface InputConnector {          // website, text-paste, ingest-api, search, later: rss, ical, permitted social API, csv
  kind: string
  discover?(source: SourceRef, ctx): Promise<ItemRef[]>
  acquire(item: ItemRef, ctx): Promise<RawDocument>     // → becomes an Observation's evidence
}
interface OutputAdapter {           // AlbaGo now; later: rest, webhook, csv, wordpress, customer db
  id: string
  deliver(occurrence: CanonicalOccurrenceV1, cfg): Promise<{ externalId: string }>
  update(occurrence: CanonicalOccurrenceV1, externalId: string, cfg): Promise<void>
  retract(externalId: string, reason: string, cfg): Promise<void>
}
```
Customer schemas differ (`event_name` vs `name` vs `listing.title`) → that is purely the adapter's job; the contract
never changes per customer. A generic declarative "field mapping" adapter is a later convenience, not v1.

### 3.6 How it can be offered later (nothing built now)
| Model | What it takes from this design |
|---|---|
| Event Data API / hosted SaaS | Wrap `engine/index.ts` in versioned HTTP routes (`/api/engine/v1/...`) or a small standalone server; contract types → JSON Schema |
| Managed feed / webhooks / CSV | New `OutputAdapter`s; `deliveries` already tracks per-consumer state |
| Platform plugin | An adapter in that platform's shape |
| Customer-specific integration | Adapter + consumer config; no engine change |
| Private / on-prem | Move `engine/` to its own repo; implement ports with plain Postgres + S3-compatible storage + the customer's LLM key |

### 3.7 Provider abstraction — only where it pays
LLM: Vercel AI SDK behind the `LLM` port (already provider-neutral). Fetching: `Fetcher` port (`http` now, rendered
later). Geocoding: `Geocoder` port (Nominatim now). Store/media: ports, because portability is now a stated
commercial requirement. Orchestration: none — Vercel Cron + `engine.jobs` with leases; n8n could later call the
same service endpoints.

---

## 4. MUST BUILD NOW / DESIGN NOW, BUILD LATER / DO NOT BUILD YET

### MUST BUILD NOW
1. Migration ledger + committed base DDL (prerequisite for everything).
2. `engine/` + `integrations/albago/` folders with the ESLint boundary rules (§3.2).
3. Canonical **contract v1** (occurrence-based, small, versioned) + validators; JSON Schema export.
4. Engine schema: `sources`, `observations`, `occurrences`, field provenance, `venues`, `match_decisions`,
   `review_actions`, `consumers`, `deliveries`, `runs`, `jobs`.
5. Ports + the AlbaGo wiring (Supabase/AI SDK/Nominatim/storage implementations live in `integrations/albago/wiring.ts`).
6. Neutral taxonomy + AlbaGo mapping; ISO country + locality normalization (absorbs Phase 41.2–41.4).
7. Extraction: JSON-LD first, AI second, engine taxonomy, no invented values.
8. Rule-based matcher v1 against the **engine's own** occurrences (not AlbaGo's tables).
9. One review queue (engine verification) + AlbaGo delivery policy + server-side AlbaGo adapter.
10. Backfill: existing AlbaGo events imported as observations from a `albago-legacy` source, so matching sees them.
11. vitest + golden set (~50 labelled Tirana items).

### DESIGN NOW, BUILD LATER
Source reliability from correction history; auto-delivery for trusted sources; rendered fetching; read-only
`/api/engine/v1` export; series grouping (Phase 40); update/cancel flow from re-observations; `tenant_id`/consumer
scoping on config tables (the `consumers` table exists from day one; per-consumer *config storage* comes later).

### DO NOT BUILD YET
Multi-tenant auth/billing/isolation, customer self-service, webhook/CSV/WordPress adapters, AI field-mapping,
embeddings/ML dedup, n8n, monorepo, calibrated numeric confidence, Meta scraping.

---

## 5. Agent strategy

| Agent | Responsibility | Owns | Must not touch | When |
|---|---|---|---|---|
| **Main / Architect** (this session) | Contracts, ports, engine schema & migrations, boundary rules, AlbaGo integration, review + commits | `engine/contract/**`, `engine/ports/**`, `engine/index.ts`, migrations, `integrations/albago/**`, `docs/**`, `CLAUDE.md`, ESLint config | — | Always |
| **Engine agent** | Implements engine stages behind agreed ports/contract, with tests | `engine/{core,extract,connectors,services,delivery}/**`, `tests/engine/**` | `engine/contract/**`, `engine/ports/**`, `integrations/**`, `app/`, `components/`, `lib/`, migrations, `.env*` | One stage at a time, isolated worktree, given interface + golden-set threshold |
| **Review (on demand)** | Correctness, edge cases, boundary violations, security | read-only | everything | After each stage (`/code-review`) |

Shared contracts (contract, ports, schema, migrations) change only through the main agent.

---

## 6. Risks

| Risk | Severity | Mitigation |
|---|---|---|
| Social-only venues (Instagram/Facebook) | **High** | No Meta scraping. Organizer submission + paste/forward (Lens/Compose), official Graph API for businesses that connect, ticketing/venue sites with structured data, partnerships. |
| Hallucinated fields | High | Field must be `stated` with evidence or stays null; golden-set scoring on every prompt/model change. |
| Bad dates / timezones | High | Deterministic resolution against observation `retrieved_at`; never infer missing times. |
| Venue matching | Medium | Existing tiered matcher, now against `engine.venues`; venues creatable from review. |
| Duplicates | Medium | Matcher v1 + review shows candidates; weekly leakage metric. |
| Changes / cancellations | Medium | New observation disagrees → review → adapter `update`/`retract`. |
| Legal reuse / image rights | High for B2B | Rights flag per image; re-host only owned/licensed; robots.txt compliance; source terms recorded per source. |
| Boundary erosion (AlbaGo logic creeping into engine) | **High for sale** | Lint rules (§3.2) fail the build; review checklist item. |
| AI / crawl cost | Low–Medium | Content-hash cache, JSON-LD path skips AI, runs record tokens. |
| Timeouts / concurrency | Medium | Jobs with leases, small batches under 300s. |
| Schema drift | High | Ledger first. |
| Agent code quality | Medium | Narrow briefs, owned paths, tests + golden set as gates. |

---

## 7. Phases

**M0 — Foundations:** ledger + base DDL; vitest; `engine/` + `integrations/albago/` skeleton with lint boundary;
contract v1 + taxonomy + ports (types only); engine schema migration; golden set.
*Exit:* lint proves the boundary; contract approved; tests run.

**M1 — One queue, one truth (vertical slice):** 10 permitted Tirana sources → observations → occurrences →
matcher → single review → AlbaGo adapter → live. Existing Radar/ingest/Scout re-pointed to the engine intake;
legacy AlbaGo events backfilled. *Exit:* ≥95% approved events need no date/time edit; dup leakage <5%;
median review <60s; ≥30 upcoming Tirana events live.

**M2 — Breadth:** 30–50 sources (Tirana, Prishtina, Durrës, Berlin); rendered fetching; source stats; update/cancel.
**M3 — Trust:** reliability scores; auto-delivery for top sources; read-only `/api/engine/v1` export (first external surface).
**M4 — Productize (only with a real prospect):** tenant isolation, auth/keys, more adapters, SLAs.

---

## 8. Decision

**Architecture:** extract the existing pipeline into an independent `engine/` (own contract, own `engine` Postgres
schema, ports for every external dependency, public API via `engine/index.ts`), with all AlbaGo behaviour in
`integrations/albago/` (adapter, taxonomy mapping, geography, acceptance policy, wiring). Observation → Canonical
Occurrence with per-field provenance; verification in the engine, publication policy per consumer.

**First milestone:** M0 + M1.

**Agents:** Main/Architect + one Engine agent (isolated worktree); review on demand.

**Changes from your idea:** Observation/Canonical split; occurrence unit; deterministic field status; verification vs
publication split; one review; ports instead of direct Supabase/Next coupling; no n8n/monorepo/tenancy yet; ledger +
golden set first; no Meta scraping; Phase 41 normalization folded into the engine.

**Files (eventually):** new `engine/**`, `integrations/albago/**`, `supabase/migrations/**` (or `db/migrations/**`),
`tests/**`, `vitest.config.ts`, `docs/engine/{contract-v1,taxonomy,agent-briefs}.md`; changed `eslint.config.mjs`,
`package.json` (test script; vitest + zod as direct deps), `tsconfig.json` (`@/engine` path), `lib/{lens,radar,crawl,scout,ingest,ai}/**`
(logic moves into `engine/`, thin re-exports during transition), `app/admin/event-radar/**`, `app/admin/AdminClient.tsx`,
`app/api/cron/**`, `CLAUDE.md`.

**Approvals needed:**
1. Direction: extract & harden into an independent engine; Observation/Occurrence model; verification vs publication split.
2. Layout: `engine/` + `integrations/albago/` with lint-enforced boundaries (no monorepo).
3. Separate `engine` Postgres schema in the same Supabase project; engine never touches `public.*`.
4. Migration ledger — Supabase CLI migrations, or numbered SQL files you keep running manually.
5. New dev/direct dependencies: `vitest` (dev), `zod` (direct; already installed transitively, v4).
6. Neutral engine taxonomy, with AlbaGo's 5 categories as a mapping.
7. No Instagram/Facebook scraping.
8. n8n deferred.
9. M0 + M1 scope, and ~10 Tirana sources from you.
10. Phase 41 steps 41.1–41.6: pause and fold into the engine, or finish first.

---

## 9. Independence verification

### 9.1 Today's code — all five checks fail
| Check | Today | Why |
|---|---|---|
| 1. Could it move to another repo? | **No** | `@/lib/*` imports, `server-only`, `createAdminClient` with AlbaGo env |
| 2. Consumable without AlbaGo code? | **No** | `resolvePoster` reads AlbaGo `places`, `events`, `event_submissions`, AlbaGo city list (`lib/locations`) |
| 3. New customer schema via adapter only? | **No** | Approval writes AlbaGo `event_submissions` via `crawlReadingToSubmission`; publish is AlbaGo client code |
| 4. Acquisition separate from output? | **No** | Radar/ingest services both acquire and write AlbaGo tables; verify loop rewrites AlbaGo `events` |
| 5. AlbaGo rules outside the core? | **No** | `PosterReading` hard-codes AlbaGo's 5 categories and 4 languages; Scout's 27-area beat; listing-quality rules in `approvalValidation`; `SITE_URL`; images re-hosted to AlbaGo storage |

### 9.2 Proposed design — how each check becomes YES
| Check | Answer | Guaranteed by |
|---|---|---|
| 1. Movable to another repo | **Yes** | `engine/` imports nothing outside itself except npm packages (lint rule); config and I/O come through ports; no Next.js/React/`server-only` |
| 2. Consumable without AlbaGo code | **Yes** | Public API is `engine/index.ts`; AlbaGo is just one caller wiring the ports |
| 3. Customer schema via adapter | **Yes** | `OutputAdapter` + `deliveries`; contract v1 is versioned and never shaped per customer |
| 4. Acquisition vs output separate | **Yes** | `InputConnector` → observations; `OutputAdapter` ← occurrences; they share only the contract and store |
| 5. AlbaGo rules outside core | **Yes** | Taxonomy mapping, geography slugs, languages, acceptance policy, beat, wiring all in `integrations/albago/` |

### 9.3 Commercial assets — where each lives
| Asset | Engine home |
|---|---|
| Source graph | `engine.sources` (+ terms/permission notes per source) |
| Observation history | `engine.observations` (immutable, content-hashed) |
| Source reliability history | derived from `engine.review_actions` + `observations` |
| Canonical event database | `engine.occurrences` (+ field provenance) |
| Venue/entity graph | `engine.venues` (+ aliases, coordinates, source refs) — AlbaGo `places` is a consumer copy |
| Dedup history | `engine.match_decisions` |
| Human corrections | `engine.review_actions` (observation value → approved value) |
| Normalization rules | `engine/core/**` (code, tested) |
| Extraction / evaluation corpus | `engine/eval/` golden set (+ labels), versioned in git |

None of these live in AlbaGo tables or AlbaGo code under this design.

### 9.4 Residual coupling, stated honestly
- **Same Supabase project and same Vercel deployment** in v1. Acceptable: separate schema + ports keep moving it a
  mechanical job (new project, copy schema, re-wire ports), not a redesign.
- **Review UI lives in the AlbaGo admin** in v1, but it calls only the engine's public API (`engine.review.*`). Moving it
  means re-hosting a UI, not changing the engine.
- **One consumer configured** (AlbaGo). `consumers`/`deliveries` exist from day one; per-consumer config storage and
  tenant isolation are deferred until a second consumer exists.
