# 05 — AlbaGo Lens (LENS)

Goal: **point your camera at any street poster and it becomes a live event.**
The breakthrough feature no major platform has (approved by the user
2026-07-11: "I love it, let's build it"). It is simultaneously a supply
engine (fills the thin catalog — the bible's #1 problem), a technical moat
(multimodal extraction → entity resolution → dedup → translation), and the
poetic inverse of the Poster Studio: AlbaGo makes posters AND reads them.

Constraints honored: free Gemini multimodal only (existing key/patterns from
`lib/ai/`), submissions flow through the EXISTING wizard + moderation queue —
Lens never publishes directly.

## Stages (each shippable alone; stage-and-confirm between them)

### LENS-1 — the magic moment (scan → read → prefilled submission)
*Shipped 2026-07-11. E2E verified locally: synthetic Albanian poster ("E SHTUNE, 22 GUSHT", ora 22:00, 1500 leke, 3 artists) extracted 100% correct in 1.3–2.1s incl. year rollover to a real Saturday; app-icon negative test correctly rejected (is_event false). User phone verdict pending.*
- [x] `lib/ai/posterReader.ts` — Gemini flash-lite multimodal extraction with a
      strict JSON contract: title, description (poster text only, never
      invented), category (existing six), date/time (resolved to ISO using
      today's date; no-year dates roll forward), venue/address/city/country,
      price as printed, language, tags, artists, organizer, civic flag,
      per-reading confidence. Server-side validation/coercion of every field.
- [x] `POST /api/lens` — image upload (client downscales to ≤1600px JPEG),
      per-IP rate limit, 422 when the photo isn't an event poster.
- [x] `/scan` — camera-first page: take photo / pick from gallery → scanning
      state → extracted-fields card (time bold flame per the time-prominence
      law) → "Continue" writes the wizard's localStorage draft
      (`albago:event-draft:v1`) and routes to `/submit-event`. Wizard,
      auth gate, and moderation queue all reused untouched.
- [x] Entry CTA on `/submit-event` ("Have a poster? Scan it"). i18n ×4 (17 keys).
- **DoD:** photo of a real poster → ≥80% of wizard fields correct → submitted
  through the normal queue.

### LENS-2 — resolution layer (spec written 2026-07-12; build-ready)

Turns the raw text reading into RESOLVED entities: a real city slug, a linked
venue with coordinates, and a duplicate check — so the wizard opens with the
Where step already done. Governing rule, inherited from the extraction
contract: **a wrong resolution is worse than none.** Auto-apply only on
strong evidence; medium evidence becomes a one-tap suggestion; weak evidence
stays empty. Never hard-block the user on any of it.

#### Where it runs

Inside `POST /api/lens`, server-side, AFTER a successful reading — one round
trip, no client changes to the upload flow. The route gains a `resolvePoster
(reading)` step (new `lib/lens/resolve.ts`) whose entire body is
try/caught: **resolution failure NEVER fails the scan** — on any error the
response carries the LENS-1 reading with `resolution: null` and the flow
degrades to exactly today's behavior. DB reads use the same server client the
route already has (places and published events are public-read anyway;
the submissions check is deliberately boolean-only, see Stage D).

Latency budget: the two DB candidate queries run in parallel (~50ms);
Nominatim fires only as fallback with a 2s AbortSignal. Typical added cost
≤300ms on a 1.3–2.1s scan; worst case ≤2.5s. Nominatim calls send the
descriptive User-Agent the usage policy requires and are throttled through a
module-level 1-req/s gate (same courtesy the map search shows).

#### Response contract (additive to the LENS-1 payload)

```
resolution: {
  city:  { status: 'matched'|'remote'|'inherited'|'none',
           slug, label, country, region?, center? }          // center = [lng,lat]
  venue: { status: 'matched'|'suggested'|'none',
           place?: { id, name, slug, address, lat, lng, city, location_slug } }
  geocode: { status: 'address'|'none', lat?, lng?, formatted? }
  duplicate: { status: 'live'|'in_review'|'none',
               event?: { slug, title, date } }               // slug/title ONLY for status 'live'
}
```

#### Stage A — city resolution

1. **Local match:** fold `reading.city` with `foldText()` (lib/mapSearch —
   the index-preserving per-char fold) and compare against the city list
   (DB `cities` + hardcoded fallback, same source as `useLocations`). Exact
   folded equality on label or slug → `matched` ("Tirana"/"Tiranë"/"tirane"
   all collapse). No fuzzy tiers here: city names are short, fuzzy city
   matching invents geography.
2. **Venue inheritance:** if Stage B finds a strong venue match first pass
   (run B against country-wide candidates when the city is unknown), inherit
   `city`/`location_slug` from the place row → `inherited`.
3. **Remote fallback:** Nominatim search with `reading.city + reading.country`;
   take the top hit that carries a real place field (city/town/village/
   municipality) → `remote` with a synthetic slug via `slugifyCityName` —
   identical to how the map search and `upsert_city_from_event` already mint
   slugs, so approval-time city upsert keeps working unchanged. **Impl note
   (2026-07-12): NO client-side country-agreement re-check.** The country is
   already in the query so Nominatim biases correctly; requesting results in
   the poster's language returns localized country names ("Shqipëria" not
   "Albania") that can't be compared across languages to the reading's
   country and produced false negatives for valid cities (Vlorë rejected).
   Matches the existing `searchRemoteCities` behavior, which has no gate.
4. Nothing readable → `none`; the wizard's WhereStep does its normal job.

#### Stage B — venue matching against `places`

- **Candidate pool:** places with `location_slug` = resolved city (fall back
  to `country` when city unresolved), `status='active'`, capped at 500 —
  select id, name, slug, address, lat, lng, city, location_slug only.
- **Normalization before scoring:** fold both names; strip leading/trailing
  venue-type noise words from a fixed list (en+sq: club, bar, pub, lounge,
  teatri, teatër, kinema, pallati, stadiumi, arena, kafe, restorant …);
  require the surviving core ≥3 chars, else score the unstripped names
  (stripping "Club" from "Club 21" must not leave "21" matching everything).
- **Deterministic tiers, not a single opaque score:**
  - `matched` (auto-apply): folded normalized names EQUAL, or one name's
    token set ⊆ the other's AND the contained name has ≥2 tokens or one
    distinctive token ≥5 chars ("Folie" ⊂ "Folie Terrace" links; "21" ⊂
    anything does not).
  - `suggested` (one-tap chip, never auto-applied): token-set Jaccard ≥ 0.5,
    or `matchScore()` word-boundary hits on every token of the shorter name.
  - **Tie demotion:** if the top two candidates both qualify as `matched`,
    demote to `suggested` with the top candidate — two plausible venues
    means the machine does not actually know.
- **Apply semantics (client, `readingToDraftPatch` extension):** a `matched`
  place prefills `venue_name` (canonical DB name), `address`, `lat`, `lng`,
  `city`, `location_slug`, `country` in the draft. `EventDraft` has no
  `place_id` on purpose — actual place linking happens at approval exactly
  as it does for every other submission today; zero wizard/schema changes,
  the LENS-1 handoff decision stands.

#### Stage C — address geocode fallback

Only when venue is NOT matched and `reading.address` is non-empty: Nominatim
structured query (street=address, city=resolved city, country). Accept the
hit ONLY if it lands within ~30km of the resolved city's center — geocoding
a hand-painted poster address without that sanity ring produces confident
garbage on another continent. Accepted → prefill `lat/lng/address`
(`geocode.status='address'`); rejected/timeout → `none`.

#### Stage D — duplicate detection

- **Candidates:** events with `status='published'` AND same `date` (exact —
  the reader already resolves dates to ISO) AND same `location_slug`
  (country match when city unresolved); plus `event_submissions` with
  `status='pending'` on the same key. Both result sets are tiny by
  construction.
- **Title comparison in TS** on the candidate set (no pg_trgm dependency):
  folded token sets; duplicate when Jaccard ≥ 0.6 OR one title's token set
  contains the other's. Runs identically for both tables.
- **Disclosure rule:** a published hit returns `{status:'live', event:{slug,
  title,date}}` → the result card shows an "Already on AlbaGo" panel linking
  the live page. A pending-submission hit returns `{status:'in_review'}` and
  NOTHING ELSE — submissions are not public; the scanner learns only that
  the event is already in the queue, never whose submission or what it says.
- **Never block:** the panel sits above the Continue button; Continue keeps
  working (the match could be wrong, or a genuinely different edition). The
  moderation queue stays the final dedup authority — this stage exists to
  save honest scanners the wasted submission, not to gate them.

#### Surfaces + tracking

- Result card venue row states: matched (check + canonical "Folie Terrace ·
  Tiranë"), suggested ("Did you mean …?" chip → tap applies the place and
  flips to matched), none (raw extracted text as today). City row shows the
  resolved label. Duplicate panel per Stage D. ~10 new `lens_*` i18n keys ×4.
- New track types `lens_resolved` (payload: which stages hit) and
  `lens_dup_shown` — added in BOTH `lib/track.ts` AND `/api/track`
  ALLOWED_TYPES (known gotcha: miss one and events drop silently).

#### Build order (stage-and-confirm within the phase)

- [x] **LENS-2a — SHIPPED 2026-07-12.** `lib/lens/resolve.ts` Stages A+B+C +
      fail-open route wiring + result-card matched/suggested states + draft
      prefill (`resolvedDraftPatch`) + `lens_resolved` track type (lib/track
      AND /api/track) + 3 i18n keys ×4 (lens_venue_matched/suggest). 30
      scripted pure-logic tests pass (accent/stem city match, noise-word
      normalization, match tiers incl. "21"⊄ demotion, tie demotion, geocode
      ring). Live probe against real data confirmed: city resolves off the
      real `cities` table (Tiranë→tirane, Prishtinë→prishtina), remote
      fallback resolves Vlorë, geocode respects the 30km ring, fail-open
      holds on every case. **FINDING: the `places` table is currently EMPTY
      in production** — venue matching correctly returns `none` today and
      becomes valuable only as venues are seeded; nothing breaks meanwhile
      (empty candidate pool → `none`, tested). USER VERIFY: scan a real
      poster for an event in a known city → wizard opens with city prefilled.
- [x] **LENS-2b — SHIPPED 2026-07-13.** Stage D duplicate detection in
      `lib/lens/resolve.ts` (`titlesMatch` pure logic + `detectDuplicate`) +
      `duplicate` added to the response contract + result-card panels
      (live = flame "Already on AlbaGo" with event link; in_review = neutral
      "Already in review", no details) + `lens_dup_shown` track type (lib/track
      AND /api/track) + 6 i18n keys ×4. Candidates keyed on exact date +
      location_slug (country when city unresolved). Published-event hits use
      the anon client and return slug/title/date; pending `event_submissions`
      hits use the SERVICE client (RLS blocks anon reads) and return
      boolean-only — titles compared server-side, never sent. Self-degrades to
      `none` on any error so a dedup failure can't wipe city/venue resolution.
      10 scripted `titlesMatch` tests pass (reworded/abbrev/accent flag; shared
      generic word or single-word overlap do not). tsc/eslint/build clean.
      USER VERIFY: scan a poster for an event already live → "Already on
      AlbaGo" link appears above Continue; Continue still works.
- **DoD:** a real poster for an event at a known AlbaGo venue opens the
  wizard with venue, coordinates, and city prefilled; scanning a poster of
  an event already live shows the "Already on AlbaGo" link; tsc/eslint/build
  clean; all scripted tests pass.

### LENS-3 — enrichment
- [ ] Auto-translate title/description ×4 at submission (ties into the
      multi-language descriptions idea B19).
- [ ] Poster photo itself offered as event image when quality allows;
      Studio artwork fallback otherwise.

### LENS-4 — the Facebook wedge
- [ ] Paste an FB/IG event URL → same extraction engine parses it into a
      draft (bible C26/E7). The organizer migration tool.

### LENS-5 — the loop
- [ ] "Street scout" attribution: scans that go live credit the scanner on
      the event page; badges per city. TikTok-able ("scan your city").

## Decision Log

| Date | Decision | Why |
|---|---|---|
| 2026-07-11 | Lens feeds the existing wizard/queue, never publishes directly | Moderation + trust rules stay single-path; Lens is an input method, not a bypass |
| 2026-07-11 | Handoff = write `albago:event-draft:v1` localStorage, route to `/submit-event` (step 1, not review) | Zero wizard changes; location still needs the WhereStep geocoder until LENS-2, so landing on review would show an incomplete draft |
| 2026-07-11 | Scanning allowed signed-out (rate-limited per IP) | Mirrors the submit flow's own "start now, sign in later" gate; the gate still enforces auth at submit time |
| 2026-07-11 | Poster photo NOT used as event media in LENS-1 | A phone shot of a lamppost is poor hero material; LENS-3 decides quality-gated usage |
| 2026-07-11 | Client downscales to ≤1600px JPEG before upload | Free-tier token/byte budget; text stays readable at that size |
| 2026-07-12 | Resolution runs server-side inside /api/lens; failure degrades to LENS-1, never fails the scan | One round trip; the magic moment must survive every resolver bug |
| 2026-07-12 | Deterministic match tiers (matched/suggested/none) + tie demotion, no opaque score threshold | Wrong auto-linked venue is worse than empty — mirrors the extraction no-invention rule; ties mean the machine doesn't know |
| 2026-07-12 | No place_id in the draft; matched venues prefill canonical fields only | Place linking stays an approval-time act; zero wizard/schema changes preserved |
| 2026-07-12 | Duplicate check warns and links, never blocks; pending-submission hits are boolean-only | Queue stays the dedup authority; submissions are not public and must not leak via the scanner |
| 2026-07-12 | Geocode fallback requires the hit within ~30km of the resolved city | Unconstrained geocoding of poster addresses produces confident garbage elsewhere on earth |
| 2026-07-12 | Dropped the client-side country-agreement gate on remote city fallback | Localized Nominatim country names ("Shqipëria") can't be compared across languages to the reading's country; caused valid-city false negatives. Country is already in the query so Nominatim biases correctly (matches existing searchRemoteCities) |
| 2026-07-13 | Pending-submission dedup uses the service client, returns boolean-only | `event_submissions` is not anon-readable (RLS) so the resolver's anon client can't see it; the service client can, but the response must never carry submission fields — titles are matched server-side and discarded, only `{status:'in_review'}` crosses |
| 2026-07-13 | Dedup keyed on exact date + location_slug, title match in TS (Jaccard ≥0.6 or subset) | Keeps candidate sets tiny (no pg_trgm dep); the reader already resolves dates to ISO so exact-date keying is safe; title only disambiguates within the tight date+location set |
