# Phase 39 — The Scout: autonomous daily event search

**Goal:** AlbaGo searches the web for events by itself, every night, and files
each find as a draft for one-click human approval. No chat window, no person
triggering it, no source list to maintain.

**Status:** built 2026-08-24.

---

## 1. Why this exists

Phase 38 gave a ChatGPT Custom GPT a door into the review queue. It works, but a
Custom GPT only acts while somebody is chatting with it — there is no daily
heartbeat. The requirement was "find events once a day by itself, I only confirm".

So the asking moves server-side. Same destination, same guarantees, no dependence
on anyone opening an app.

## 2. Provider

**OpenAI by default**, via `openai.tools.webSearch({})`. Selectable with
`SCOUT_PROVIDER=openai|google`; with neither set it picks OpenAI when
`OPENAI_API_KEY` exists, else Google.

Model ladder: `AI_SCOUT_MODEL` first if pinned, else `gpt-5.4-mini` → `gpt-5.4`
(Google: `gemini-flash-latest` → `gemini-flash-lite-latest`). Mini is the right
shape here — the work is searching and reading, not reasoning, and a nightly job
is cost-sensitive.

**Why not Gemini, which was the original choice.** It shipped on Gemini because
the SDK was already installed and the key already existed. The first real run
returned nothing; the cause was a free-tier quota error on Google Search
**grounding specifically** — a plain Gemini call on the same key still worked.
Two lessons are baked in here:

1. Grounding carries its own quota, separate from generation. "The key works"
   does not mean "search works".
2. The Scout now has its own provider and its own key, so a nightly run can never
   exhaust the quota Lens, translations and the compose assistant depend on.
   Those stay on Gemini.

Neither provider can combine web search with a response schema, so the JSON shape
is stated in the prompt and parsed with the shared `parseModelJson`, exactly as
every other reader in this codebase does.

**Dependency note:** installing `@ai-sdk/openai` pulled a second copy of
`@ai-sdk/provider-utils` (5.0.29 nested, 5.0.11 at root), which made the two
providers' tool types refuse to unify. `overrides` in package.json pins one copy.
If a future install resurrects the nested copy, that type error is the symptom.

## 3. Shape

```
cron 03:00 ─▶ runScout()
                 │  for each brief (city + window)
                 ├─▶ searchEventsForBrief()   grounded search → raw event JSON
                 └─▶ ingestEvents()           ← the entire Phase 38 pipeline
                                                verify source · resolve city ·
                                                assess · adopt image · queue
```

`ingestEvents` is reused unchanged, which means the Scout inherits every
guarantee already tested: the model's location guess is discarded, the source
page overrules the model on conflicts, unreadable sources are flagged
`source_unverified`, duplicates collapse on the normalized URL, pictures are
re-hosted, and **nothing is ever published without a human**.

## 4. The beat

A "brief" is one city + one date window. Defaults: Tirana, Durrës, Prishtina,
21 days ahead. Override with `SCOUT_CITIES="Tirana:Albania, Vlorë:Albania"` —
no deploy, no migration, no table. Malformed entries are skipped rather than
throwing, because a typo in an env var must never kill the nightly run.

Caps: 10 events per brief, 90-day maximum window, 240s soft budget per run with
unreached briefs returned in `remaining`.

## 5. Surfaces

| Path | Purpose |
|---|---|
| `GET /api/cron/scout` | Nightly at 03:00 (`vercel.json`). Auth: `CRON_SECRET`. |
| `POST /api/admin/scout/run` | "Search now" — optional `{city, country, days}`. |
| `/admin/event-radar` | New **Search the web for events** panel driving the above. |

Scheduled at 03:00, an hour before the existing discovery crawl at 04:00, so the
two never overlap. They are complementary: discovery re-crawls *known* sites, the
Scout goes looking on sites nobody has registered.

## 6. Files

`lib/scout/brief.ts` (pure), `lib/scout/search.ts`, `lib/scout/service.ts`,
`app/api/cron/scout/route.ts`, `app/api/admin/scout/run/route.ts`,
`vercel.json`, the Event Radar panel, `scripts/scout-test.mjs` (26 assertions).

No migration. No new table.

## 7. Prerequisites to actually run

1. `event_import_candidates` table applied (shared with Phases 37/38 — still the
   outstanding blocker).
2. `CRON_SECRET` set in Vercel, or the cron route rejects its own scheduler.
3. `GOOGLE_GENERATIVE_AI_API_KEY` — already present (Lens uses it).

## 8. Known limits

- Grounded search returns what Google indexes. Instagram/Facebook events stay
  invisible; that gap is structural, not a bug to fix here.
- A search model will confidently propose events that don't exist. The defence is
  verification, not trust: a find whose page we cannot read arrives flagged and
  capped at medium confidence, and a human still approves it.
- Cost scales with cities × events: one grounded search per city, one extraction
  per event found. Keep the beat small until the yield per city is known.
