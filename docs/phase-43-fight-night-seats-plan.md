# Phase 43 — Fight Night: Kabayel vs Hysa (28 Nëntor 2026)

Status: **Stages A–E BUILT (selling machinery), payment NOT connected.** Plan written 2026-10-06; on 2026-10-06 the user said "make everything ready to sell, payment method last — Stripe needs a registered business first". SQL not applied yet. Section 8 has what was built and how to go live.

## 1. The event

- WBC World Heavyweight title: Agit Kabayel (27-0) vs Nelson Hysa (25-0, Albanian, Shkodër). Sat 28 Nov 2026, Merkur Spiel-Arena, Düsseldorf. Doors 17:00, start 18:00 (per venue page).
- Promoter Queensberry, primary seller Eventim, TV = DAZN pay-per-view in Germany.
- 28 Nov is Albanian Independence / Flag Day. Presale sold 25,000 in 24h, ~35,000 total, capacity raised to 40,000.
- Reported face values (articles, approximate): Innenraum €650, Unterrang €450, Mittelrang €350, Oberrang €250, VIP €1,750. **Confirm real face values from the order.**

## 2. The stock (37 seats, all `Einzelticket`, status "cannot be shared or downloaded yet", no names printed)

| Cat | Area | Seats | Contiguous groups |
|---|---|---|---|
| 4 | Innenraum 204, row 1 | 4 | s14–17 (4) |
| 6 | Nord-Tribüne Unterrang | 13 | B12 R18 s14–17 (4) · B18 R17 s5–6 (2) · B20A R9 s7–10 (4) · B20B R10 s7–9 (3) |
| 8 | Nord-Tribüne Oberrang | 20 | B114 R22 s7–13 (7) · B114 R23 s10–12 (3) · B115 R20 s4–5 (2) · B125 R20 s1–5 (5) · B125 R20 s15–17 (3) |

Estimated face value ≈ 4×650 + 13×450 + 20×250 = **€13,450 = the money at risk** if the tickets were ever cancelled.

## 3. Gate 0 — what decides everything (no code; do first)

1. Read the **Veranstalterbedingungen** on the Eventim order confirmation. Eventim's generic template says: commercial resale prohibited; transfer to a companion only at face value + proportionate fees; violations can cancel the ticket without refund; personalised tickets need ID at the door; companions of a multi-ticket buyer may only enter with the buyer. The generic template is NOT confirmed for this event.
2. Ask Eventim support + Queensberry in writing: when are the tickets released; will they be transferable (app link) or re-personalisable; fee and deadline.
3. Ask Queensberry / Team Hysa for written permission or an allocation, pitched as "official Albanian fan partner" (they get the diaspora; AlbaGo gets a legal lane).
4. Steuerberater: repeated sales of bought stock for profit = trade (gewerblich), income tax + VAT.

**Rule:** no payment is taken for seats until 1 or 3 is answered in writing. Until then AlbaGo takes *reservation requests only* (no money).

## 4. Product — "Seats" desk on the event page

- **Seat-level inventory.** Each seat is its own row; buyer picks category → group size → AlbaGo assigns seats.
- **Orphan-proof assignment.** Sell from the ends of a run inward and never leave a single stranded seat (7-run: sell 2,3,4,5 or all 7, never 6 unless it's the last of that run).
- **Delivery tracker for the buyer:** Reserved → Paid → Awaiting release → Transfer sent → In your Eventim app → Confirmed (buyer taps "I got it").
- **Delivery guarantee:** automatic full refund if not transferred by a stated deadline (proposed 21 Nov). Collect buyer's name + Eventim account email at checkout so the transfer is one tap on release day.
- **Seller console** (admin only): queue of transfers to do, copy-email buttons, mark-transferred, CSV, refund.
- **Seat + night bundle:** every buyer automatically gets a free pass to the AlbaGo after-party event via the shipped Phase 33 QR + door mode. Extras are priced separately and honestly; the seat itself is never marked up inside a bundle (that would be circumvention of the face-value rule).
- **Hub:** "28 Nëntor" page — the fight, watch parties in diaspora cities (Phase 33 free tickets + door scanner), Düsseldorf/NRW after-parties, partner-listed fan buses. This is the part with no resale risk and the reach AlbaGo actually wants.

## 5. Stages (each its own commit, stage-and-confirm)

- **A — Fight event + hub (free, no schema).** Create the event (category `sports`; Düsseldorf is not in the hardcoded `lib/locations.ts` fallback, add it), hub content ×4 languages, Eventim primary link via existing `ticket_url`.
- **B — Reserve-interest list.** Request form (name, email, category, group size) into a small table with RLS; admin view. No money. Doubles as demand/price test.
- **C — Seat desk + manual payment.** `seat_stock` (event_id, cat, area, block, row, seat, face_value_cents, status available/held/sold/transferred, order link) + seat orders reusing the Phase 33 `orders` pattern. SQL pasted in chat per usual. Payment by SEPA transfer with reference code, confirmed manually.
- **D — Stripe checkout** via PAY-1 once Gate A (entity + Stripe) is done. Hosted Checkout, webhook-only fulfilment, as in `docs/master-plan/01-payments.md`.
- **E — Delivery tracker + refund automation + seller console.**
- **F — Watch-party kit:** organizer template + door mode for bars.

## 6. Out of scope / refused by design

- Pricing above face value is the seller's decision and risk: the admin console shows a warning on any category priced above its face value (Eventim's standard terms allow cancelling such tickets), but does not block it.
- No attempts to disguise bulk ownership from Eventim.
- Civic/protest content: none (removed in Phase 41).

## 7. Open questions for the user

1. Was it one order or several? Which Eventim account?
2. Real face value per category?
3. Gewerbe / Stripe status?
4. Which sales channel first: friends & community lists, or public on AlbaGo?
5. Appetite for contacting Queensberry / Hysa's camp.

## 8. What was built (2026-10-06)

**Database** — `docs/seeds/phase-43-seat-sales.sql` (idempotent, one transaction). Tables `seat_sales` (one per event; mode draft / waitlist / live / closed), `seat_categories` (price per Eventim category; no price = hidden), `seat_stock` (one row per physical seat), `seat_reservations` (held → paid → transfer_sent → delivered; cancelled / expired / refunded), `seat_waitlist`. "Free seat" is computed (`seat_free_stock`), never stored. Every mutation takes the `seat_sales` row lock, so two buyers can never get the same seat.

**Seat picking** — `seat_pick`: a group always sits side by side; exact-fit run first, then the smallest run that leaves ≥2 seats, a lonely leftover seat only as last resort. Tested on the real 37 seats: `npm i --no-save @electric-sql/pglite@0.3 && node scripts/seat-sql-test.mjs` → 53/53.

**Buyer** — seat panel on the event page (`components/seats/SeatSalePanel.tsx`, wins over native tiers and the external ticket link): categories with price, seats left, biggest group still together, optional face value; reserve (sign-in required) with name + Eventim account email; waitlist before launch or when sold out. `/dashboard/seats` tracker: progress bar, seats, reference, hold expiry, cancel hold, "I got my tickets". Emails at each step (best-effort, Resend). ×4 languages (75 `seat_*` keys).

**Seller** — `/admin/seats` (rail entry "Seats"): turn on seat sales for any upcoming event → console with Orders (filters, search, transfer queue, mark paid with method + reference, extend hold, cancel, transfer sent, delivered, refund with "return seats to stock", private notes, CSV), manual sales (WhatsApp / in person, same seat rules, links to the buyer's account by email), Stock & prices (paste the Eventim seat list → parsed, per-category label / face value / price with above-face-value warning, seat map where a click keeps a seat back), Settings (mode, delivery date, hold hours, max per buyer, seller name, note), Waitlist (copy all emails, CSV).

**Stadium map** — simplified Merkur Spiel-Arena map in the seat panel (`components/seats/StadiumMap.tsx`, layout data `lib/seats/venueMaps.ts`). AlbaGo's own drawing; block positions follow the official Queensberry / Nelson Hysa channel plan for this fight (Nord-Tribüne = left side; 12–19 lower straight, 20A/20B top-left corner, 117–125 upper straight, 113–116 bottom-left corner, floor 201–237 around the ring). Blocks with stock are coloured by category, sold-out dashed; the block the seats come from glows and a row strip shows the exact seat numbers. Default = best available (`lib/seats/pick.ts`, a tested mirror of `seat_pick`); tapping a block sends it to `seat_reserve(…, p_area, p_block)` so the server picks inside that block. Map chosen automatically from the event's venue text (`venueMapFor`). Note: the official shop lists the start as 16:00 (venue page said doors 17:00 / start 18:00) — check before publishing the event.

**Payment seam** — none built on purpose. Today: the buyer gets a hold + "payment details follow by email"; the seller collects any way and clicks "Mark paid". Later Stripe: a checkout route + webhook that calls `seat_admin_update(…, 'mark_paid', 'stripe', …)` — no schema change.

### Go-live checklist (user)
1. Run `docs/seeds/phase-43-seat-sales.sql` in the Supabase SQL editor (expect one row of zeros).
2. Create the fight event in the admin wizard (category Sports, Düsseldorf).
3. `/admin/seats` → search the event → "Sell seats".
4. Stock & prices → paste the Eventim ticket list → set label / face value / price per category.
5. Settings → delivery date, hold hours, "Sold by", note → stay in **Draft** and test one reservation end to end.
6. Optional Vercel env `SEAT_SALES_NOTIFY_EMAIL` = where "new reservation" pings go.
7. Switch to **Waitlist** to collect demand now; **Live** once the payment method is decided.
