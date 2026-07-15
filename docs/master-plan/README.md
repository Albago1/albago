# Master Plan — Payments · E-Ticketing · Native Apps

**Status:** APPROVED DIRECTION (user request 2026-07-10). Execution is staged; each phase still follows the repo's plan → approve → build → verify → commit loop.

This directory is the single source of truth for the commerce + apps buildout. Any session — Fable, Opus, Sonnet, or any future model — must read `00-handoff-protocol.md` **first**, then the track doc for whatever it is building. Do not improvise around these docs; update them when reality changes (append to the Decision Log, tick the checklists).

## The three tracks

| Track | Doc | What it delivers | Modeled on |
|---|---|---|---|
| **TIX** — E-Ticketing | `02-ticketing.md` | Tiers, orders, QR tickets, door scanning, refunds, waitlists, transfers | DICE, Eventbrite (machinery), RA (restraint) |
| **PAY** — Payments | `01-payments.md` | Provider-agnostic money layer, Stripe first, organizer ledger + payouts | Stripe-native platforms; Shopify's ledger discipline |
| **APP** — Store Apps | `03-apps.md` | PWA hardening → Capacitor store shells → native gate | Instagram (nav), DICE app (tickets in pocket) |
| **BC** — Broadcast | `06-broadcast.md` | Admin-only social distribution engine: bulk asset generation from the Studio, scheduling queue, auto-publish to Telegram/IG/FB/X | Buffer/Later machinery at €0, cinematic brand assets no scheduler has |

## Why this order (the one big insight)

**Ticketing ships first, WITHOUT payments.** A "free ticket" is an order with `total_cents = 0` — it exercises the entire machine (tiers, inventory locking, orders, QR issuance, email delivery, door scanning, My Tickets) with zero payment dependencies, zero legal prerequisites, zero cost. This is how the platform gets real ticketing muscle while the catalog is still protest/free-event heavy — and it makes the paid flip a **configuration change, not a rebuild**.

Payments is built in parallel **entirely in Stripe test mode** (free, no card, no bank, no entity needed to develop). Going live is then a paperwork event (entity + bank + Stripe KYC), not an engineering event.

Apps start as a **PWA hardening pass** (free, benefits everyone immediately) and become store apps via Capacitor shells the day store accounts exist ($25 Google one-time, $99/yr Apple — the only unavoidable money in this entire plan).

## Combined sequence

```
NOW (zero money, zero legal prerequisites)
├─ TIX-1  Schema + free-ticket claim flow (RSVP-grade, QR issued)
├─ TIX-2  My Tickets + ticket email + door scanner
├─ PAY-1  Provider abstraction + Stripe TEST mode checkout E2E
├─ APP-1  PWA hardening (manifest, SW, install, web push)
│
GATE A: user completes Legal/Bank P0 checklist (README §User P0s)
├─ PAY-2  Stripe LIVE, 3 hand-picked pilot organizers, diaspora cities first
├─ TIX-3  Paid tiers public, fees engine, refunds
├─ PAY-3  Organizer ledger + payout runs (manual SEPA first)
│
GATE B: user pays store accounts
├─ APP-2  Capacitor shells → Play Store + App Store
├─ TIX-4  Wallet passes, transfers, waitlist, promo codes, QR rotation
│
GATE C: product-bible M19 data gate
└─ APP-3  Native (Expo) evaluation — only if PWA/shell metrics demand it
```

Product-bible alignment: §10 ranks ticketing #1 (3–5% + payment costs, civic free forever, free events free forever); §13 places paid-ticketing v1 at ~M13 with 10 hand-picked organizers and gates native apps at M19. This plan makes everything **ready earlier** without violating the sequencing gates — building in test mode and shipping free tickets is supply-side muscle, not premature monetization.

## Non-negotiable product laws (inherited, apply to every track)

1. **Civic surfaces are never monetized.** No fees, no promoted slots, no data. Ever. (§10 pledge — it is the moat.)
2. **Free events are free to list forever** — and with TIX-1, free *ticketing* is free forever too (fee = 0 on zero-price orders). Say it loudly in the UI.
3. **Money is integers.** `*_cents int` + `currency char(3)`. Display strings never computed from. The legacy `events.price` text column stays display-only.
4. **No cached aggregates** (schema-reference principle #4): sold counts, availability, balances — always computed via SQL functions from source tables.
5. **i18n ×4 parity** (en/sq/de/es) on every new surface, natively written.
6. **Cinematic brand everywhere** — a ticket is a fan artifact (DICE lesson), not a receipt. Flame red, ink black, Instrument Serif kickers, TIME PROMINENT (standing user rule).
7. **Free tier only** until the user says otherwise: Supabase free, Vercel hobby, Resend free, Stripe (per-transaction, no fixed cost). Any tool with a monthly fee is rejected at design time.

## User P0 checklist (manual actions only the user can do)

These are the ONLY blockers between "built in test mode" and "live". Track status here.

- [ ] **Legal entity** — confirm what exists today (Einzelunternehmen/Gewerbe in Germany? Nothing yet?). Stripe live needs a legal entity + address. Germany assumed from context (haqua-berlin.de) — **confirm with user before PAY-2**.
- [ ] **Agent-model legal check** — collecting ticket money on organizers' behalf can count as regulated payment services in Germany (ZAG/PSD2); the plan relies on the commercial-agent exemption (organizer is the named seller, AlbaGo their agent). One question for the accountant/lawyer during entity setup, before PAY-2. (Added 2026-07-12; see 01-payments §2.)
- [ ] **Bank account** for the entity (any EU IBAN works for Stripe DE).
- [ ] **Stripe account activation** (KYC: ID + entity + bank). Free. ~1–3 days.
- [ ] **Fee decision**: platform fee % (recommend launch at 3% + Stripe costs passed through; bible range 3–5%) and absorb-vs-pass default.
- [ ] **Terms of Service + Refund Policy pages** updated for ticket sales (draft provided in PAY-2; user reviews).
- [ ] **Google Play developer account** — $25 one-time.
- [ ] **Apple Developer Program** — $99/year.
- [ ] Existing standing P0s remain (Resend key rotation, Search Console, OAuth verification, Sentry DSN).

## Decision Log

| Date | Decision | Why |
|---|---|---|
| 2026-07-10 | Free-tickets-first sequencing (TIX before PAY-live) | Exercises full machine with zero prerequisites; matches no-money constraint |
| 2026-07-10 | Stripe as first provider, behind an abstraction | Test mode = build now free; best API; Connect for diaspora organizers later. Stripe does NOT serve Albania → platform-as-merchant + ledger payouts (see 01-payments §2) |
| 2026-07-10 | Capacitor shells over React Native rewrite for store debut | Reuses the entire Next.js product; native rewrite deferred to bible M19 gate |
| 2026-07-10 | QR = server-signed HMAC token, not raw IDs | Offline-verifiable at the door, forgery-proof, rotation-capable (DICE pattern) |
