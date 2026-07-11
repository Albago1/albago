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

### LENS-2 — resolution layer
- [ ] Venue matching: extracted venue/city fuzzy-matched against `places` +
      city list → prefill `location_slug`, `lat/lng` (reuse mapSearch fold()).
- [ ] Duplicate detection: same title+date+city against events/submissions →
      "already on AlbaGo" with a link instead of a duplicate draft.
- [ ] Geocode fallback for address strings (Nominatim, as in map search).

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
