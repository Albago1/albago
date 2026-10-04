# Event Engine — Acquisition & Discovery Architecture (Phase 0 amendment)

**Status:** PLAN — awaiting approval. Amends `docs/engine/phase-0-plan.md` §1, §3, §5, §10, §11. Nothing implemented.
**Date:** 2026-10-04
**Principle:** *AI researches and reasons. The Engine controls, remembers, validates and delivers.*
The engine is an AI event researcher with deterministic infrastructure around it — not a crawler with an LLM parser.

---

## 1. Three acquisition lanes, one intake

```
                      DiscoveryGoal  (configuration, not code)
             { geography, categories, horizon_days, communities?, languages?, budget }
                                     │
              ┌──────────────────────┼───────────────────────┐
              ▼                      ▼                       ▼
   A. RESEARCH LANE          B. MONITORING LANE       C. DIRECT LANE
   AI Discovery Agent        known sources, on a      structured sources:
   (tool-calling loop,       schedule; change-        JSON-LD, RSS, iCal,
   budgeted)                 detected by content      partner/official APIs
   finds events AND          hash; AI only on         — no LLM unless the
   new sources               changed pages            data is unusable
              │                      │                       │
              └──── evidence: fetched page / feed item / API record ────┘
                                     ▼
                       engine.observe(ObservationInputV1)
       deterministic validation → normalization → venue resolution →
       reconciliation/dedup → canonical occurrence (needs_review)
                                     ▼
                     one human review → verified occurrence
                                     ▼
                    OutputAdapter (AlbaGo now, customers later)

   Research lane side-output:  proposed sources ──► source evaluation ──► registry (lane B/C)
```

**Planner (deterministic)** decides per goal which lanes run, cheapest first:
direct (C) → monitoring (B) → research (A) only for the remaining coverage gap and within the goal's budget.
Coverage gap = categories/days/localities in the goal window with fewer verified or pending occurrences than a target.

**Hard rule kept from today's ingest path:** a search result or a model's claim is a **lead**, never an observation.
Only content the engine actually fetched (page, feed item, API record) becomes evidence. The model's answer is
re-checked against that evidence and the page wins every contested field.

---

## 2. The AI Discovery Agent

An AI SDK tool-calling loop (the same mechanism the Compose agent already uses, `lib/agent/run.ts`), run per goal,
with a hard budget (max steps, searches, fetches, tokens, wall-clock).

| Tool | Backed by (existing code reused) | Deterministic guard inside the tool |
|---|---|---|
| `web_search(query)` | **new** `SearchProvider` port | records query + result list as run evidence; result cap |
| `fetch_page(url)` | `safeFetch`/`ssrfGuard`, `fetchUrlContent` (urlReader) | SSRF, robots.txt, domain policy (no unauthorized social scraping), size/time limits, per-host politeness |
| `read_structured(url)` | JSON-LD/meta extraction from urlReader | validated: dates sane, end ≥ start, etc. |
| `list_event_links(url)` | `lib/crawl/discover.ts` | same-host, event-looking URLs only |
| `read_site(domain)` | `lib/crawl/site.ts` (robots → sitemap → home) | robots compliance |
| `extract_event(evidence)` | `posterReader`/`urlReader`/`promptReader` extraction contract | zod-validated, field status, no invented values |
| `read_image(url)` | Lens poster reader | — |
| `resolve_place(name, city)` | `lib/lens/resolve.ts` matching + geocoder (rewritten against `engine.venues`) | tie → suggestion, never auto-link |
| `check_known(url \| title+date+place)` | engine store lookup (normalized URL, matcher v1) | prevents re-researching known events |
| `submit_observation(evidence, extracted)` | `engine.observe` | only accepts fetched evidence ids, not free text |
| `propose_source(url, why)` | new: writes `engine.sources` with `status='proposed'` | dedup by normalized URL |

What the agent decides (semantic): which queries to run, which results look like real event pages or event-rich
sources, whether a page is an event, how to interpret messy text/posters, which sources disagree and what to look up
next (e.g. "time missing → search the venue's page").
What it can never do: write occurrences, verify, publish, bypass a tool's guard, or create a field value without evidence.

**Second agent mode — `research(occurrence)`:** for an occurrence with missing/conflicting fields, the same agent with a
narrow goal ("find the start time and price for X at Y on Z") produces new observations that reconcile into it.

---

## 3. Source lifecycle (registry no longer limits discovery)

```
proposed (by agent or admin) → evaluated → active (monitored, lane B/C) → paused / retired
                                   └──→ rejected (with reason; agent won't propose again)
```
**Evaluation is deterministic, from recorded facts:** events yielded per visit, share that passed verification, presence of
structured data/RSS, update frequency, robots/terms/permission basis, error rate. A human approves `proposed → active`
in v1 (cheap, protects compliance). Later: auto-promote above thresholds, and reliability history from review corrections.

---

## 4. Goals are configuration (commercial requirement)

```ts
DiscoveryGoalV1 = {
  id, label,
  geography: { scope: 'worldwide' } | { country_codes: string[], localities?: string[] },
  categories?: EventTypeV1[],                                         // omitted = all types
  horizon_days: number,                                               // 14 · 30
  relevance?: RelevanceCriteriaV1,                                    // see §7 — topic/community/cultural relevance
  languages?: string[],                                               // query languages, e.g. ['sq','de','en']
  expansion?: SearchDimensionsV1,                                     // see §7 — how to fan out a worldwide goal
  budget: { max_searches, max_fetches, max_tokens, max_minutes },
  schedule?: cron-like string
}
```
- AlbaGo's current 27-area Scout beat becomes ~27 goals in `integrations/albago/goals.ts`.
- "Croatia, music + nightlife, 30 days", "Germany, tech conferences", "Albanian diaspora in DE/CH/AT" are new goal
  objects — **no engine code change, no AlbaGo code touched.**
- Query generation is the agent's job (from the goal), seeded with goal-language hints — not hard-coded search strings.
- `relevance` covers the diaspora case today's `brief.ts` handles with its `scope` field, generalised (§7).

---

## 5. Answers

**1. Existing components that become agent tools:** Fetch + SSRF guard, URL normalization, page distillation and JSON-LD
reading (urlReader), link discovery (crawl/discover), sitemap/site reading (crawl/site), the extraction contract
(poster/url/prompt readers), Lens venue/city matching + geocoding, the dedup title matcher, and the ingest
"re-read the page and let it win" verification. The Compose agent's loop (`lib/agent/run.ts`) is the agent runtime
pattern. Scout's `brief.ts` (area + window + diaspora scope) becomes `DiscoveryGoalV1`. Radar/discovery and verify become
lane B. Nothing is deleted.

**2. Missing for autonomous wide-web research:**
- A real **search tool** returning result lists the engine records (today the Scout asks a model to *return events*
  from its own built-in search — opaque, no record of what was searched, and blocked on a paid key).
- A **discovery agent loop** with the tools above (Compose's loop exists, but its tools only edit one draft).
- **Goals** as data, a **planner** and **budgets**.
- **Source proposal + evaluation** path into the registry.
- **Run records** (queries, pages, costs, outcomes) — the agent's audit trail.
- **Rendered fetching** for JS sites the agent will meet (Cineplexx/BunkArt-type pages) — lane-independent, M2.
- A **discovery evaluation set**: for a fixed goal and window, a hand-checked list of real events, to measure recall
  (what share the agent found) next to precision (what share was real).

**3. Coexistence:** one intake (`observe`), three lanes, cheapest first. Research fills coverage gaps and discovers
sources; good sources graduate into monitoring/direct lanes so the same events are later found cheaply and reliably;
`check_known` stops the agent spending budget on what monitoring already has. Research also runs in `research(occurrence)`
mode to fill gaps in known events.

**4. Stays deterministic:** schema/zod validation; date sanity (end ≥ start, overnight handling, year resolution against
`retrieved_at`, timezone); "no evidence → no value"; URL normalization; dedup signals and thresholds; state transitions
(proposed/active, needs_review/verified); provenance writes; budgets and stop conditions; tool guards (SSRF, robots,
domain policy, rate limits); source evaluation metrics; permission enforcement; publishing/adapters.

**5. Provider independence:** two ports, both with real alternatives today —
- **`Reasoner`** (LLM with tool calling + structured output) via the Vercel AI SDK, model chosen by config; the project
  already has `AI_GATEWAY_API_KEY`, so OpenAI / Anthropic / Google models are switchable by model string.
- **`SearchProvider`** — `search(query, opts) → [{url, title, snippet, date?}]`. Implementations can be a standalone
  search API (e.g. Brave, Tavily, Exa, Bing/Google programmable search) or a model-native search tool wrapped to return
  the same shape. Preferring a standalone search API keeps the engine owning the evidence regardless of which model reasons.
Every observation and run records `{provider, model, version}`; the golden and discovery evaluation sets decide switches
by measurement, not preference.

---

## 6. Changes to the Phase 0 plan

| Phase 0 item | Change |
|---|---|
| §1 tables | **+ `engine.runs`** moves from deferred to *build now* (research audit: goal, lane, queries, pages fetched, tokens/cost, outcome counts). `sources` gains `status` (`proposed`/`active`/`paused`/`rejected`), `discovered_by_run`, `evaluation` jsonb. `observations` gains `run_id` and `lead` (query + snippet that led there). **+ `engine.goals`**: *design now, build later* — v1 goals live in config (`integrations/albago/goals.ts`); a table only when goals must be edited at runtime or per customer. |
| §3 contract | **+ `DiscoveryGoalV1`**; API adds `engine.discover(goal)`, `engine.research(occurrenceId)`, `engine.sources.evaluate/promote/reject`. |
| §5 ports | `Extractor` → **`Reasoner`** (tool-capable LLM); **+ `SearchProvider`**. Still four external ports (store, fetcher, reasoner, search) + geocoder. |
| §10 sources | The 10 recommended sources become the **seed registry** for lanes B/C, not the limit of discovery. |
| §11 sequence | After step 10 (`observe`), insert: **10a** search provider + `web_search` tool; **10b** discovery agent v1 with the tools in §2 + budgets + runs; **10c** source proposal/evaluation. |
| M1 experiment | Run **both** for Tirana, next 14 days: (A) goal "all event types in Tirana, 14 days" through the research lane, (B/C) the 10 seed sources. Measure per lane: events found, verified %, unique finds the other lane missed, cost per verified event, review minutes. This tells us what AI discovery adds and what it costs. |

### New decisions
| # | Decision | Recommendation |
|---|---|---|
| D10 | Search provider for v1 (paid; the Scout is currently blocked on exactly this) | A standalone search API behind `SearchProvider`; model-native search kept as a fallback implementation |
| D11 | Proposed sources need human approval before monitoring (v1) | Approve |
| D12 | Default research budget per goal run (e.g. 20 searches, 60 fetches, fixed token cap) | Approve a starting cap; tune from `runs` data |

---

## 7. Location vs relevance (community / cultural / topic discovery)

**Generic capability:** AI-driven event discovery by **geography + topic/community/cultural relevance**.
**AlbaGo's first configuration:** Albanian and Albanian-relevant events **worldwide**.

### 7.1 Two separate dimensions
| Dimension | Question | Nature | Stored where |
|---|---|---|---|
| **Location** | Where does it physically happen? | **Fact** about the event | `occurrences` (venue, locality, country_code, coords) |
| **Relevance** | Why does it matter to audience X? | **Assessment** against a goal's criteria | per criteria, with evidence (below) |

An event in Berlin with an Albanian performer, Albanian-language promotion and a diaspora audience is located in DE and
*relevant* under AlbaGo's criteria. The same occurrence can be irrelevant under a Croatian customer's criteria — one
canonical event, different relevance verdicts. This keeps "truth vs customer preference" intact.

### 7.2 Relevance facts (engine, neutral) vs relevance verdict (per criteria)
- **Facts the engine extracts and keeps on the occurrence, with provenance:** `performers`, `organizer_name`,
  `promotion_languages` (languages the event is advertised in), `audience_statements` (e.g. "for the Albanian community in
  Zurich", stated by the source), `cultural_occasion` (e.g. a national-day celebration, as stated). These are ordinary
  contract fields — neutral, useful to any customer.
- **Verdict per criteria:** `occurrence.relevance = { [criteria_id]: { verdict: 'relevant'|'possible'|'not_relevant',
  signals: [{kind, value, strength, observation_id}], assessed_by: 'rules'|'ai'|'human', at } }`.

```ts
RelevanceCriteriaV1 = {
  id: 'albanian',                                  // consumer-chosen id
  description: 'Albanian or Albanian-diaspora relevant',
  location_implies: { country_codes: ['AL','XK'],  // location alone suffices here
                      localities?: [...] },         // e.g. Albanian-majority towns in MK, ME, RS
  signals: {                                        // what counts, with strength
    performer_affiliation: 'strong',               // performer known/evidenced as Albanian
    organizer_affiliation: 'strong',
    audience_statement: 'strong',                  // source explicitly targets the community
    promotion_language: { languages: ['sq'], strength: 'medium' },
    cultural_occasion: 'medium',
    community_venue: 'medium'                      // venue/org known as a community venue
  },
  rule: 'one strong OR two medium',                 // deterministic combination
}
```
**Who does what:** the AI *extracts and explains* signals from evidence (who the performer is, what language the poster is
in, who it's aimed at, and researches an unknown performer when needed). **Code combines them** with the criteria's rule into
the verdict. `possible` goes to human review with the signals shown; the reviewer's decision is stored as a correction like
any other field.

### 7.3 Worldwide goals fan out progressively
A goal like "Albanian-related events worldwide, next 30 days" is too broad for one search. `expansion` tells the planner
which dimensions to iterate, and the planner orders them by expected yield (learned from `runs`):

```ts
SearchDimensionsV1 = {
  places?:        [{ country, cities? }],         // diaspora hubs: DE (Berlin, Munich, Stuttgart…), CH (Zurich…), AT, IT, UK, US, SE…
  entities?:      { performers?: string[], organizers?: string[], institutions?: string[] },  // seed lists
  platforms?:     string[],                        // ticketing/community platforms worth searching within
  query_languages?: string[],                      // ['sq','de','en','it']
  learn: true                                      // add discovered sources/entities to the registry for future runs
}
```
Each step is a narrower sub-goal the same agent runs: *places* ("Albanian concert Zurich November"), *entities* ("<artist>
tour dates 2026"), *platforms* (search a ticketing site for Albanian artists), then *known sources* (monitoring lane). The
agent can also add newly found performers/organizers/sources as it goes.

### 7.4 Learning over time (assets)
- **Sources** that repeatedly yield relevant verified events → proposed → (approved) monitored. A diaspora promoter's
  page found once becomes a cheap monitored source.
- **Entities** (performers, organizers, promoters, community institutions) with **affiliations + evidence** — e.g.
  "performer X — affiliation: albanian — evidence: 3 verified events, source pages". This is what makes the
  `performer_affiliation` signal strong without re-researching every time, and it powers entity-dimension searches.
  Neutral: an entity can hold any number of affiliations, so the same table serves a Turkish- or Croatian-diaspora customer.

### 7.5 Where things live
| Piece | Engine (generic) | AlbaGo configuration (`integrations/albago/`) |
|---|---|---|
| Location facts, relevance facts | ✓ | |
| Relevance criteria format + rule evaluation | ✓ | |
| Criteria `albanian` (signals, `AL`/`XK` + Albanian-majority localities) | | ✓ `relevance.ts` |
| Goal "Albanian events worldwide, 30 days" + diaspora hubs, seed artists/organizers, query languages | | ✓ `goals.ts` |
| Delivery policy: deliver if located in AL/XK **or** verdict `relevant` under `albanian` | | ✓ `policy.ts` |
| Learned sources & entities with affiliations | ✓ (stored neutrally) | |
A future "Turkish diaspora in Germany" or "tech conferences worldwide" customer = a new criteria + goal object; no engine change.

### 7.6 Changes this adds to Phase 0
| Item | Change |
|---|---|
| Contract v1 | + `promotion_languages`, `audience_statements`, `cultural_occasion` on the occurrence; + `RelevanceCriteriaV1`, `SearchDimensionsV1`; goal geography may be `worldwide` |
| `engine.occurrences` | + `relevance` jsonb (verdicts keyed by criteria id) |
| `engine.entities` | **Design now, build in M1 only as a minimal table** (`id, kind, name, aliases, affiliations jsonb, evidence jsonb`) — needed for performer-based relevance and searches; otherwise seed lists in AlbaGo config |
| Extraction prompts | Extract performers (today they are extracted then discarded), promotion language, audience statements — as facts, never as a relevance verdict |
| M1 experiment | Add **one diaspora goal** next to Tirana: "Albanian-relevant events in DE/CH/AT, next 30 days" — tests worldwide fan-out, relevance signals and entity learning |

### New decisions
| # | Decision | Recommendation |
|---|---|---|
| D13 | Relevance as per-criteria verdicts from AI-extracted signals + deterministic rule; `possible` → human | Approve |
| D14 | `engine.entities` (performers/organizers/institutions with affiliations) built minimally in M1 | Approve |
| D15 | AlbaGo delivery rule: located in AL/XK (+ Albanian-majority localities) **or** relevance verdict `relevant` | Approve |
| D16 | Second M1 goal: Albanian-relevant events in DE/CH/AT, 30 days | Approve |
