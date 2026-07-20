# 07 — AlbaGo Crawl (CRAWL)

Goal: **the catalog fills itself.** A supervised agent that, on a schedule,
reads a curated list of venue / promoter / ticketing / listing web pages,
extracts each event with the existing Lens engine, resolves and de-duplicates
it, and drops new finds into the **existing moderation queue as pending** — an
admin approves, exactly as with a human submission. It is the autonomous,
push-side counterpart to Lens (which is pull-side: a human points a camera or
pastes a link). Same brain, different trigger.

This is the direct answer to the product bible's #1 problem — thin catalog —
and it is deliberately built to be **impossible to turn into a garbage
firehose**: Crawl never publishes. It only proposes. The moderation queue stays
the single source of truth for what goes live.

## Non-negotiables (inherited from Lens + the handoff protocol)

- **Never publishes directly.** Every find lands as `event_submissions.status =
  'pending'` and is reviewed by a human. Same single-path trust model as Lens.
- **Never invents.** Reuses the Lens extraction contract verbatim (empty field
  beats a wrong guess). A wrong resolution is worse than none.
- **Legal by construction.** Reads only public web pages that expose their own
  content (OpenGraph, schema.org/Event JSON-LD, visible text) — the same thing
  `lib/ai/urlReader.ts` already reads. No hostile scraping of login-walled
  social platforms. Social media arrives later via *opt-in organizer
  connections* (CRAWL-4), never scraping.
- **Free tier only.** Reuses the existing Gemini key and Nominatim courtesy
  limits. No paid scraping providers.
- **Polite.** Sequential fetches with a per-host delay and a descriptive UA,
  honoring the same manners Lens already shows Nominatim.

## Architecture — one thin layer over Lens

```
curated source URL
      │
      ▼
readEventFromUrl(url)        ← lib/ai/urlReader.ts   (REUSED, unchanged)
      │  { reading, imageUrl }
      ▼
resolvePoster(reading)       ← lib/lens/resolve.ts   (REUSED, unchanged)
      │  { city, venue, geocode, duplicate }
      ▼
classify outcome ────────────► duplicate.live      → skip (already on AlbaGo)
      │                        duplicate.in_review → skip (already pending)
      │                        !is_event / low conf → skip (not an event)
      ▼
crawlReadingToSubmission()   ← lib/crawl/toSubmission.ts  (NEW, ~1 file)
      │  event_submissions payload, submitted_by_user_id = NULL
      ▼
service-client insert → event_submissions (pending) → EXISTING admin queue
```

The only genuinely new code is the orchestration (`lib/crawl/*`) and one
admin-gated route. Extraction, resolution, and dedup are all reused.

## Stages (each shippable alone; stage-and-confirm between them)

### CRAWL-1 — the pipeline + admin trigger (THIS BUILD)

Prove the whole chain end-to-end with **zero schema** and a human at the wheel.

- [x] `lib/crawl/sources.ts` — the curated source registry as a checked-in
      config (migrates to a DB table in CRAWL-2). Each source: `url`, `label`,
      optional `city`/`country` hints, `kind`, `enabled`. Ships with disabled
      template entries — nothing runs until the user curates real URLs.
- [x] `lib/crawl/toSubmission.ts` — maps a `PosterReading` + `LensResolution`
      into the exact frozen `event_submissions` payload, sourcing city/venue/
      coords from the resolution, `submitted_by_user_id: null`, `status:
      'pending'`, `place_id: null` (venue linking stays an approval-time act,
      same decision as Lens). Translation packs (`title_i18n`/`description_i18n`)
      left null here — added at write-time in CRAWL-3.
- [x] `lib/crawl/crawl.ts` — `crawlUrl(url, { dryRun })` runs the chain above
      and returns a typed outcome; `crawlSources(sources, opts)` iterates
      enabled sources sequentially with a polite delay. `dryRun` (default)
      classifies and returns the would-be payload **without writing**; live mode
      inserts pending rows via the service client. Min-confidence gate 0.35.
- [x] `lib/crawl/discover.ts` (CRAWL-1.5) — event-link **discovery** from a
      listing/index page: fetch the page, pull same-host, event-looking links
      (event-ish path/word in en+sq+de+es+it, a date in the URL, or a
      schema.org Event/ItemList `url`), skip social/nav/legal links, dedupe,
      cap at 15. This is the "search over a page of events" mode — point it at a
      venue's "upcoming" page and it reads every event linked there. Falls back
      to a single-page read when a listing exposes no individual links.
- [x] `lib/crawl/site.ts` (CRAWL-1.6) — **site mode**: give it just a domain
      and it finds the event pages itself by reading the site's own sitemap
      (located via robots.txt, then conventional `/sitemap.xml` locations),
      handling a sitemap index (bounded fan-out to child sitemaps, event-ish
      ones first) and falling back to homepage link discovery when no sitemap is
      usable. Same-host, capped, SSRF-guarded — it reads the site's published
      index, never spiders the open web. The shared keep-rule (`filterEventUrl`)
      is factored out of `discover.ts` so listing + site modes classify URLs
      identically.
- [x] `POST /api/admin/crawl` — auth = admin session **or** `CRAWL_SECRET`
      bearer token (so a headless driver / future cron can call it). Body `{
      dryRun?, sourceUrls?, listingUrls?, siteUrls?, maxEventsPerListing? }`.
      `sourceUrls` = single event pages; `listingUrls` = discover + crawl every
      event on a page; `siteUrls` = discover a whole site from its domain; all
      omitted → the enabled registry. Returns a structured report (per-event
      outcome, `discoveredFrom`, counts). No user-facing strings → no i18n.
- [x] **CRAWL-1.7 huge-list batching.** `crawlSources` runs within a wall-clock
      budget (45s under the 60s maxDuration) and returns `report.remaining`
      (grouped by mode) with every input it didn't reach — so a list of ANY
      size continues across calls instead of timing out. `scripts/crawl-batch.mjs`
      is the driver: reads a file of domains/URLs (one per line, `#` comments),
      classifies each (bare domain → site mode, path → listing mode), chunks it,
      loops each request on `remaining` to completion, and writes an aggregated
      results JSON. Auth via `CRAWL_SECRET` (user sets this env var). This is the
      "give it a huge list and let it go through them" path.
- [x] **CRAWL-1.8 admin UI** (`/admin/crawl`, `app/admin/crawl/{page,CrawlClient}.tsx`
      + rail link in `components/admin/AdminRail.tsx`). Paste a list of
      domains/pages, "Dry run" → results table (event, city, outcome badge),
      then tick "Send finds to the queue" and run again to insert pending rows.
      Uses the admin session (same-origin fetch carries the cookie), so **no
      CRAWL_SECRET needed from the browser** — the token is only for the headless
      script. Client loops on `report.remaining`, so the UI drives huge lists
      too. Matches the existing admin pattern (layout guard + sibling Client,
      plain-English strings like the rest of admin — no i18n).
- **DoD:** dry-run against a handful of real Albanian venue/ticketing URLs
  returns correct per-URL outcomes (would_submit / duplicate_live /
  duplicate_in_review / not_an_event / unreadable); flipping `dryRun:false` for
  one good URL creates one `pending` row visible in `/admin/queue`, correctly
  attributed with a null submitter; `tsc`/`eslint`/`build` clean.

### CRAWL-2 — durable sources + schedule (spec-only until CRAWL-1 verified)

- [ ] `crawl_sources` table (SQL delivered in chat): the registry moves to the
      DB so it is editable without a deploy; admin UI at `/admin/crawl` to add /
      toggle / test sources. `crawl_runs` sibling table logs each run
      (started_at, counts, per-source status) for observability.
- [ ] Vercel Cron (`vercel.json` `crons`) hits the route nightly with a
      `CRON_SECRET` bearer check (in addition to the admin guard, so cron can
      call it unattended). Small batch per run to stay inside free Gemini quota.
- [ ] Rejected-dedup: a lightweight `crawl_seen` key (source URL + resolved
      date + title hash) so a source that keeps advertising an event an admin
      already **rejected** is not re-proposed every night. (Live/pending dedup
      is already handled for free by `resolvePoster`.)

### CRAWL-3 — enrichment at write-time

- [ ] Reuse `resolveAndTranslate` so inserted rows carry the 4-language
      `title_i18n`/`description_i18n` packs (ties into LENS-3).
- [ ] Offer the page's `og:image` as the event banner when it is a real event
      graphic (quality-gated), Studio artwork fallback otherwise.

### CRAWL-4 — the social wedge (legal path only)

- [ ] "Connect your Instagram / Facebook" for verified organizers via the
      **official Graph API** (accounts they own/manage) → auto-import their
      events. This is a *sellable organizer feature*, not scraping, and reuses
      the whole pipeline below the fetch step. No public-account scraping —
      ever; it is a ToS + legal dead end and a trust risk.

## Decision Log

| Date | Decision | Why |
|---|---|---|
| 2026-07-20 | Crawl feeds `event_submissions` as pending via the service client with `submitted_by_user_id = NULL`; never publishes | Keeps the single-path trust model from Lens; frozen-table rule (#8) forbids new columns, and null-submitter rows are already admin-only readable by existing RLS |
| 2026-07-20 | Reuse `readEventFromUrl` + `resolvePoster` unchanged; Crawl is orchestration only | The extraction/resolution/dedup brain is already built and tested; a parallel implementation would drift from the Lens contract |
| 2026-07-20 | CRAWL-1 ships dry-run as the default; live insert requires explicit `dryRun:false` | Stage-and-confirm: the user reviews exactly what the agent *would* submit before any row is written; pending rows are fully reversible via the existing reject flow |
| 2026-07-20 | Source registry starts as a checked-in config, moves to a DB table in CRAWL-2 | Zero schema for the first slice; the DB table + admin UI is only worth building once the pipeline is proven against real pages |
| 2026-07-20 | No public social-media scraping, ever; social arrives via opt-in organizer Graph-API connections (CRAWL-4) | Scraping IG/FB/TikTok is a ToS + legal liability and an anti-bot arms race; the moat is the Albanian resolution layer + trust pipeline, not a rogue scraper |
| 2026-07-20 | Live/pending dedup relies on the existing `resolvePoster` duplicate stage; only *rejected*-dedup needs new state (CRAWL-2) | Stage D already flags published + pending matches for free; the only gap is not re-proposing admin-rejected events, which needs a small seen-key table |
| 2026-07-20 | Huge lists handled by a time-budgeted call + `remaining` + a driver script, NOT a DB job queue (yet) | Zero-schema, stateless-resumable: the leftover list IS the state, passed back each call. A durable `crawl_sources`/`crawl_runs` queue is CRAWL-2 once volume justifies it |
| 2026-07-20 | Route accepts a `CRAWL_SECRET` bearer token in addition to the admin session | A headless batch driver (and future Vercel Cron) can't carry a browser cookie; a shared secret is the standard machine-auth path and sets up CRAWL-2 cron. User sets the env var (added to P0s) |
| 2026-07-20 | Driver classifies a bare domain as site mode, a path'd URL as listing mode | Matches how a human thinks about a source list; listing mode already falls back to a single-page read, so a plain event URL sent as listing still works |
