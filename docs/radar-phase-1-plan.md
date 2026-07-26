# RADAR-1 — Event Intelligence System, Phase 1

Internal admin tool: paste one public event URL → a structured, reviewable
candidate → approve into the existing moderation queue. Never crawls the open
internet, never auto-publishes, never downloads social video.

## Decision: reuse the existing engine, add the missing intelligence layer

AlbaGo already had ~80% of this built as **Lens** + **Crawl**:

- `lib/ai/urlReader.ts` — SSRF-guarded fetch + JSON-LD/OG/visible-text extraction
  into a validated `PosterReading` (never invents; empty when unstated).
- `lib/ssrfGuard.ts` — http(s)-only, private-IP rejection, per-redirect re-validation.
- `lib/lens/resolve.ts` — city/venue/coordinate resolution + duplicate detection.
- `lib/crawl/toSubmission.ts` — maps a reading+resolution to an `event_submissions` row.
- `/admin/queue` — the approve → publish moderation surface.

So Phase 1 did **not** rebuild extraction or a second event system. It adds only
the genuinely missing pieces the spec demands and wires them to the proven path.

### Genuine gaps closed
1. A **single-URL focused surface** (Crawl is batch/queue-oriented).
2. **Transparent confidence** — a deterministic high/medium/low derived from
   observable completeness + resolution + dedup + timing, *not* the model's opaque
   number (spec §8). See `lib/radar/assess.ts`.
3. Explicit **warnings + missing-fields**, persisted and shown.
4. **Source-evidence** persistence (source URL, normalized URL, source name,
   image, parser version, warnings, raw reading) — impossible in the frozen
   `event_submissions` table.
5. **Source-URL dedup** + idempotent retry (a unique `normalized_url`).
6. A **candidate lifecycle** with `processing → needs_review → approved | rejected
   | failed` and retry.

## Why a new table (`event_import_candidates`)

`event_submissions` is frozen (schema rule #8) and has nowhere for import
evidence, warnings, the raw reading, or the failed/processing states. The new
table is a staging **inbox**, not a parallel event system: on approval it writes
a normal `pending` event_submissions row via the crawler's own
`crawlReadingToSubmission`, so approved candidates flow through the existing
Queue → publish pipeline unchanged.

## Files

Created
- `docs/seeds/radar-1-event-import-candidates.sql` — migration (table + unique
  index + admin RLS).
- `lib/radar/normalizeUrl.ts` — dedup-key canonicalization (SSRF via shared guard).
- `lib/radar/assess.ts` — transparent confidence + warnings + missing fields (pure).
- `lib/radar/candidate.ts` — candidate types + DB-row builder (pure).
- `lib/radar/service.ts` — orchestration (import/retry/save/approve/reject/delete).
- `lib/admin/apiAuth.ts` — shared admin route guard.
- `app/api/admin/event-radar/route.ts` — POST import.
- `app/api/admin/event-radar/[id]/route.ts` — POST approve/reject/retry/save, DELETE.
- `app/admin/event-radar/page.tsx` + `EventRadarClient.tsx` + `badges.tsx` — list/import.
- `app/admin/event-radar/[id]/page.tsx` + `CandidateReviewClient.tsx` — review/edit.
- `scripts/radar-test.mjs` (+ `radar-register.mjs`, `_radar-alias-loader.mjs`) — tests.

Modified
- `components/admin/AdminRail.tsx` — added the “Event Radar” nav item.

## Security
Admin session re-checked in every route (`isRequestAdmin`); SSRF via `safeFetch`
(private-IP + redirect re-validation); response size/time bounds inherited from
the Lens reader; service-role writes only behind the admin guard; RLS admin-only
policy as defence-in-depth; patch fields whitelisted; no secrets client-side;
`decided_by`/`imported_by` audit stamps.

## Known limitations / next phase
- Editing text does not re-resolve city/venue/coords — use **Retry** to re-read.
- Media stored as a reviewable reference URL only (no upload) — by design.
- Manual real-source testing needs `GOOGLE_GENERATIVE_AI_API_KEY` + network at
  runtime; the automated suite mocks nothing external and stays offline.
- Next: poster/OG image upload on approval, reason-chip UX, and (later) the
  scheduled discovery the Crawl track already anticipates.

## Env
Runtime import needs `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SUPABASE_URL`,
`NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `GOOGLE_GENERATIVE_AI_API_KEY` (all already
used by Lens/Crawl). No new env vars.

## Gates
`node --import ./scripts/radar-register.mjs scripts/radar-test.mjs` → 28/28 pass ·
`tsc --noEmit` → clean · `eslint` → clean · `next build` → success (4 new routes).
