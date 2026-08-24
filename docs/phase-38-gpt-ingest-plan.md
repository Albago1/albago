# Phase 38 — GPT Ingest API (the ChatGPT → AlbaGo bridge)

**Goal:** a ChatGPT agent finds events (text, details, poster image), and submits
them into AlbaGo by itself — structured, deduplicated, location-correct, with the
picture re-hosted on our own storage. Nothing publishes without a human.

**Status:** built 2026-08-24. Pending: the SQL apply, the `INGEST_API_KEY` env
var, and the Custom GPT wiring (see `docs/gpt-ingest-instructions.md`).

**Two deviations from the plan as approved**, both toward robustness:

1. `source_url` is **optional**, not required. An event the agent found somewhere
   unlinkable still lands — under a synthetic `agent:<title>|<date>|<venue>`
   dedup key, permanently marked `source_unverified`. Refusing it outright would
   have lost real events; flagging it loses nothing.
2. The shared image helper lives at `lib/media/remoteImage.ts`, not
   `lib/ingest/adoptImage.ts` — it is now used by the admin adopt route too, so
   it doesn't belong under `ingest/`.

---

## 1. Why this is small

The ingestion pipeline already exists and is already ChatGPT-shaped. From
`lib/radar/service.ts`:

> Import a block of PASTED text (e.g. an events list copied out of ChatGPT…)
> into the ONE candidate queue.

What Phase 38 adds is not a second event system. It is:

1. a **door** ChatGPT can knock on (token-authenticated HTTP endpoint),
2. a **contract** so ChatGPT sends structured fields instead of prose,
3. **image adoption** so the poster becomes ours, not a hotlink,
4. **verification** so ChatGPT's claims are checked against the real source page,
5. an **OpenAPI schema** so a Custom GPT Action can call it.

Everything downstream — resolution, assessment, dedup, review UI, approval into
`event_submissions`, publish — is untouched and already built.

---

## 2. The governing rule

**ChatGPT is a reporter, not an authority.** Every value it sends is treated as a
claim to be verified, never as truth. Concretely:

| ChatGPT sends | What AlbaGo does with it |
|---|---|
| `suggested_location_slug` | **Ignored for resolution.** Stored as evidence only. The slug always comes from `resolvePoster` (Nominatim + our `places`/`cities`). |
| `lat` / `lng` | Ignored. Coordinates come from a matched venue or a geocode inside the 30 km sanity ring. |
| `city`, `country`, `venue_name` | Used as *input* to resolution, not as the result. |
| `title`, `date`, `time`, `price`, `description` | Kept — but re-checked against the source page when the page is readable (§5). |
| `image_url` | Fetched SSRF-guarded, type/size validated, re-uploaded to our `event-covers` bucket. |
| Anything absent | Stays absent. Never filled with a guess — this is the standing extraction rule (`lib/ai/posterReader.ts`, `lib/radar/assess.ts`). |

This is what makes the location bug structurally impossible: a wrong slug from
ChatGPT cannot reach the database, because its slug is never read.

---

## 3. Endpoint

```
POST https://www.albago.org/api/ingest/events
Authorization: Bearer <INGEST_API_KEY>
Content-Type: application/json
```

Request:

```jsonc
{
  "verify_source": true,          // default true — see §5
  "events": [                     // 1..25 per call
    {
      "source_url": "https://…",  // REQUIRED — where the agent found it
      "image_url":  "https://…",  // optional poster / photo
      "title": "…",
      "description": "…",
      "category": "nightlife|music|sports|culture|food|civic|",
      "is_civic": false,
      "date": "2026-09-12",       // ISO
      "time": "21:00",            // 24h
      "end_time": "",
      "venue_name": "…",
      "address": "…",
      "city": "Tirana",
      "country": "Albania",
      "price": "1000 Lekë",
      "language": "sq",
      "tags": ["techno"],
      "artists": ["…"],
      "organizer_name": "…",
      "organizer_website": "https://…",
      "recurrence": "none",
      "recurrence_until": "",
      "recurrence_days_of_week": [],
      "suggested_location_slug": "tirana",  // accepted, ignored, stored as evidence
      "notes_for_admin": "…"                // optional free text from the agent
    }
  ]
}
```

Response — one entry per submitted event, in order:

```jsonc
{
  "ok": true,
  "summary": { "received": 3, "imported": 2, "duplicate": 1, "rejected": 0, "errors": 0 },
  "results": [
    {
      "title": "…",
      "outcome": "imported",         // imported | duplicate | not_event | invalid | error
      "candidate_id": "uuid",
      "review_url": "https://www.albago.org/admin/event-radar/<uuid>",
      "confidence": "high",          // high | medium | low  (transparent, from assess.ts)
      "missing_fields": ["price"],
      "warnings": [
        { "code": "venue_unmatched", "message": "Venue name could not be linked to a known place." }
      ],
      "resolved": {
        "city_slug": "tirana",       // the REAL slug — the agent should trust this, not its own
        "city_label": "Tirana",
        "country": "Albania",
        "venue": { "status": "matched", "name": "Kinema Millennium" },
        "coordinates": "set"
      },
      "source_check": {              // §5
        "status": "verified",        // verified | unreadable | skipped
        "conflicts": [ { "field": "time", "agent": "21:00", "page": "22:00", "used": "22:00" } ]
      },
      "image": { "status": "adopted", "url": "https://…supabase…/event-covers/gpt/…jpg" },
      "duplicate": { "status": "none", "existing_title": null, "existing_slug": null }
    }
  ]
}
```

The response is the correction loop. The agent is instructed (§7) to read
`warnings` + `missing_fields` and either fix and resubmit, or report the gap to
the human — never to silently invent the missing value.

---

## 4. Where the events land

Into the **existing** `event_import_candidates` table → visible at
`/admin/event-radar` → one-click approve → normal `event_submissions` row →
existing Queue → publish. No new queue, no new review UI, no schema change.

Provenance without a migration:
- `parser_version: 'gpt-ingest-1'` marks agent-submitted rows.
- `source_name` = host of `source_url` (e.g. "tirana-events.al"), so the queue
  reads naturally.
- `normalized_url` = the normalized `source_url` → **the existing URL dedup and
  idempotency guarantees apply for free**. The same event submitted twice
  returns `duplicate` with the original candidate id.

**Prerequisite:** `docs/seeds/radar-1-event-import-candidates.sql` must be applied
to the live database. Per project memory it may never have been run. The SQL is
idempotent (`CREATE TABLE IF NOT EXISTS`) and will be handed over inline.

---

## 5. Source verification (`verify_source`, default `true`)

The strongest anti-mistake mechanism available: don't trust the reporter when the
primary source is readable.

1. AlbaGo fetches `source_url` itself via the SSRF-guarded reader
   (`readEventFromUrl`, JSON-LD first, then LLM extraction).
2. **If the page reads:** the page's values win on conflict. Every disagreement is
   recorded in `source_check.conflicts` and shown to the admin. The agent's values
   fill only the gaps the page left empty.
3. **If the page does not read** (JS-only, login-walled, blocked — the known
   constraint from the Discovery Agent work): the agent's values stand, and the
   candidate gets a `source_unverified` warning, which caps confidence at medium.
4. `verify_source: false` skips step 1 — for events the agent gathered from a
   place with no linkable page. Always yields `source_unverified`.

Cost note: verification is one fetch + one LLM extraction per event. That is the
same cost Event Radar already pays per URL import.

---

## 6. Image handling

`lib/ingest/adoptImage.ts`, extracted from the logic already proven in
`app/api/admin/event-radar/[id]/adopt-image/route.ts`:

- fetch via `safeFetch` (SSRF-guarded, 10s timeout),
- accept only `image/jpeg|png|webp|avif` by **served content-type**, not extension,
- reject empty, reject > 8 MB (matches the browser upload cap),
- upload via the **service-role** client to `event-covers/gpt/<candidate>-<rand>.<ext>`,
- store the public URL as the candidate's `image_url`.

Failure is never fatal: on any failure the candidate keeps the remote URL with
`image.status: "hotlinked"`, or no image at all with `"none"`. An event without a
picture is fine; a broken pipeline is not.

Fallback source: when the agent sends no `image_url` but the page reads, the
page's `og:image` is adopted instead — the same picture the source shows.

---

## 7. The GPT side

Two deliverables, both written to `docs/`:

1. **`docs/gpt-ingest-instructions.md`** — the full system prompt for the Custom
   GPT. Contains the AlbaGo map/geocoding explanation (MapLibre + OpenFreeMap
   tiles, OSM Nominatim resolution, the exact slugify rule), the never-invent
   rule, the JSON field contract, image-sourcing rules (direct image file URL, not
   a page URL; no Instagram CDN links that expire), and the response-handling
   loop.
2. **`GET /api/ingest/openapi`** — the OpenAPI 3.1 schema served from the app
   itself, so it always matches the deployed host and the live field list. Pasted
   once into the GPT builder's Action config.

Auth in the GPT builder: API Key → `Bearer` → the `INGEST_API_KEY` value.

---

## 8. Security

- `INGEST_API_KEY`: new env var, separate from `CRON_SECRET` (different blast
  radius). **Fails closed** — no key configured means every call is rejected, same
  posture as `lib/cron/auth.ts`.
- Timing-safe comparison of the bearer token.
- Rate limit: max 25 events per request; reject bodies > 256 KB.
- Every outbound fetch (source page, image) goes through the existing SSRF guard.
- The endpoint can only ever create `needs_review` candidates. It cannot publish,
  cannot approve, cannot write to `events`, and cannot read user data.
- The key is a submit-only credential: leaking it lets someone spam the admin
  review queue, nothing worse. Rotating it is an env-var change.

---

## 9. Files

| File | Purpose |
|---|---|
| `lib/ingest/auth.ts` | Bearer check, fail-closed, timing-safe. |
| `lib/ingest/schema.ts` | Ingest payload types + coercion to `PosterReading` via `coercePosterReading`, per-item validation errors. |
| `lib/media/remoteImage.ts` | Shared fetch/validate + service-role adoption. |
| `lib/ingest/service.ts` | Orchestration: coerce → keepable gate → verify source → merge → resolve → assess → adopt image → upsert candidate. |
| `app/api/ingest/events/route.ts` | The endpoint. |
| `app/api/ingest/openapi/route.ts` | The Action schema. |
| `docs/gpt-ingest-instructions.md` | The GPT system prompt. |
| `scripts/ingest-test.mjs` | Scripted end-to-end test (mirrors `scripts/radar-test.mjs`). |
| `app/api/admin/event-radar/[id]/adopt-image/route.ts` | Refactored to call the shared helper. |

No migration. No new table. No change to the review UI, the queue, or publishing.

---

## 10. Stages

- **38a — Door.** `auth.ts`, `schema.ts`, `service.ts` (no verification, no image),
  `route.ts`. Result: ChatGPT-shaped JSON creates real candidates. Testable with curl.
- **38b — Images.** `adoptImage.ts` + refactor of the existing adopt route.
- **38c — Verification.** `verify_source` merge + conflict reporting + the
  `source_unverified` warning code.
- **38d — GPT side.** OpenAPI route + the instruction document.
- **38e — Test + commit.** `scripts/ingest-test.mjs`, then the SQL hand-off and
  the Vercel env var.

Each stage is independently shippable; 38a alone already replaces copy/paste.
