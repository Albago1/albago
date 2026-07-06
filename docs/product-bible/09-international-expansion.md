# 9. International Expansion — Germany, Italy, UK, USA, Japan

## The honest frame first

"Launching in Germany" does not mean competing with Eventbrite DE for German users. It means **serving Albanians in Germany** — a community of ~300–500k with zero dedicated infrastructure — and only later, if ever, widening. Four of the five requested countries are diaspora plays with the same playbook; Japan is the exception that proves the rule (below). The expansion asset is that **AlbaGo doesn't expand to countries; it expands to cities where Albanians already are** — and the civic movement has already generated organic usage in Berlin, London, and New York solidarity protests. Expansion is formalizing traction that exists.

## The repeatable city playbook (write once, run everywhere)

1. **Pre-seed:** identify the city's Albanian institutions (association, student club, church/mosque, 2–3 promoters who book Albanian artists). Warm intros via the civic network.
2. **Concierge:** onboard 1 association + 2 organizers; seed 10 events and the "Albanian-owned places" starter map.
3. **Ignite:** one anchor moment — an Albanian artist's concert, Flag Day (Nov 28), or a solidarity event — with the full share-pack treatment into the city's WhatsApp/Telegram groups.
4. **Sustain:** city digest email, protest/community alerts, empty-category waitlists, local landing page (`/london` — "Albanian events in London") for SEO.
5. **Measure:** city health dashboard (events/week, WAU, notify reach). A city is "lit" at ~10 events/month and one self-sustaining community page.

## Country-by-country

### Germany (first priority)
- **Why first:** largest continental diaspora (plus deep Kosovar-Albanian population), dense in Munich/Stuttgart/Frankfurt/Berlin/Hamburg, strong associations, proven civic energy (Berlin protest was a hand-built page — `edi-rama-berlin-2026`).
- **Product changes:** German as a full UI language (de keys exist partially in placard categories; make it a first-class locale); bilingual event pages (sq organizer text + de auto-translation for second-gen youth whose German is stronger than Albanian); Impressum + GDPR posture (German users check; a proper Impressum page is cheap credibility); date/time formats (24h, DD.MM.); city pages for the big five.
- **Non-product:** relationship with the association federation; German data-protection sensibilities argue for the public no-tracking civic pledge (§10) being prominent.

### Italy (second)
- **Why:** second-largest diaspora (~450k), geographically closest, ferry-linked, huge Albania-tourism overlap (Italians are the #1 tourist group — the tourist persona and diaspora persona both live here).
- **Product changes:** Italian locale (also serves tourists browsing Riviera events — double duty); Milan/Rome/Bari city pages; "back home" trip mode matters most here (August migration to Albania is a national ritual — the single best seasonal campaign AlbaGo will ever have: *"Kthehu në shtëpi — August in Albania"* with the full events calendar of the coast).

### UK (third)
- **Why:** ~150k+, London-concentrated (simplest single-city launch), young, high-income, extremely active in the solidarity protests; Albanian artists tour London regularly.
- **Product changes:** minimal — English UI already exists. GBP price display; London landing page; UK date formats. The real work is BD with London promoters of Albanian concerts.
- **Watch-out:** UK media narrative around Albanian migration is hostile; brand tone should be confident and cultural, never defensive.

### USA (fourth)
- **Why:** old, established diaspora (NYC/Boston/Detroit/Chicago), institution-rich (churches, federations), wealthier, but geographically scattered and second/third-generation (English-first, identity-hungry).
- **Product changes:** timezone correctness end-to-end (already solved once — `lib/timezone.ts` with per-slug US overrides exists because of US protest events; audit it before scaling); 12-hour time display; multi-city "USA" view (state-level browse); English-first content with cultural framing ("connect with your roots") rather than language framing.
- **Note:** US is where "follow Albanian artists → get tour alerts" is most valuable (artists tour US cities in bursts).

### Japan (the honest answer)
- **Why it's on the list:** presumably as the "pure foreign market" test.
- **CPO verdict: do not launch Japan as a diaspora play — there is no meaningful Albanian diaspora there (hundreds of people).** Japan would be a *general-market local-discovery* launch: new supply, new demand, new language, new culture, zero unfair advantage — the exact "another event platform" trap this bible warns against, in the world's most operationally demanding market (keitai-culture UX expectations, LINE-centric sharing, cash-heavy payments, formal business culture for venue partnerships).
- **If forced:** treat it as the template test for "AlbaGo-for-X white-label" (year 3+) — e.g., serving *another* diaspora in Japan or licensing the platform — not as an AlbaGo consumer launch. The features it would demand (ja locale, LINE share integration, PayPay, vertical text niceties) serve nothing else on the roadmap.
- **Better fifth market with the same energy:** Switzerland (~250k Albanians, richest diaspora per capita) or Greece (~500k). The playbook prints there.

## Cross-cutting product requirements for any expansion

1. **Locale architecture:** move from the current `en/al/es` set to proper BCP-47 (`sq`, `en`, `de`, `it`) with per-locale routing (`/de/...`) for SEO; translation coverage enforcement (build-time key parity check) so the "half-translated site" failure mode can't recur.
2. **Multi-currency price display** (display strings today — fine; becomes real at ticketing).
3. **Timezone discipline** (mostly solved; make `cities.timezone` non-null and stop deriving).
4. **Legal:** GDPR (done-ish: consent banner, privacy page), UK GDPR, US state privacy laws (CCPA) at scale; Impressum for DE; terms per jurisdiction eventually.
5. **The dual-city model (§3.8)** is the expansion feature: every diaspora launch doubles as engagement for the home market ("back home" rail views).
6. **Ops:** protest-day traffic is global and simultaneous (diaspora solidarity events) — monitoring/Sentry before scaling is non-negotiable.

## Sequencing verdict

Tirana density first (nothing exports from an empty home base — the diaspora user's "back home" rail must be full to be magical). Then: **DE (Munich) → IT (Milan) → UK (London) → US (NYC)**, one city per quarter, each gated on the previous city being "lit." Japan: replaced by Switzerland/Greece in practice; revisit only as a white-label question.
