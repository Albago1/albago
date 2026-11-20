# Phase 47 — Ticket allocations ("Sitzplätze auf Anfrage")

Kabayel vs Hysa (28.11.2026). The seller has tickets **without seat numbers yet**: a
count per block, a price, and the exact seats given later. The seat system (phase 43)
only knows individual seats, so these need their own stock type.

## 1. The new stock (from the seller, 2026-11-20)

| Allocation | Area | Rows | Tickets | Price | Note |
|---|---|---|---|---|---|
| Block 14 / 17 | Nord-Tribüne Unterrang | 1–5 | 20 | €150 | |
| Block 200 | Innenraum | 2 | 3 | €200 | |
| Block 213 | Innenraum | not known yet | 7 | €300 | |
| VIP · Block 226 / 228 | Innenraum | not known yet | 10 | €1,000 | VIP benefits to be confirmed |

## 2. Honest rule

No invented seat numbers anywhere. Buyers see "Exact seats confirmed before the
transfer" (sq/de/en). The map highlights these blocks as "tickets on request", never as
pickable seats.

## 3. Data (one migration, applied only after a yes)

- `seat_allocations`: id, event_id, label, area, blocks text[], rows_label (nullable),
  quantity, price_cents, note (nullable), active, sort_order, created_at.
  RLS: admin all; no public select (served through `seat_sale_public`).
- `seat_reservations.allocation_id` (nullable FK). Allocation orders have an empty
  `seats` array until the seller assigns them.
- `seat_allocation_free(allocation)` = quantity − tickets on held / paid / transfer_sent /
  delivered orders. Computed, never stored.
- `seat_reserve_allocation(event, allocation, quantity, buyer…)`: locks the allocation
  row FOR UPDATE, checks `free ≥ quantity`, `max_per_order`, the existing buyer guard
  (`seat_guard_reserve`: cap, rate limit, details), creates a held reservation with the
  normal 48 h hold. Errors: sold_out, sales_closed, bad_quantity, …
- `seat_sale_public` gains `allocations: [{id, label, area, blocks, rows, price_cents,
  available, note}]` (active only, available ≥ 0).
- `seat_admin_update` gains action `assign_seats` (seats jsonb) for allocation orders.
- Grants: the reserve RPC for `authenticated` only; helpers revoked from anon +
  authenticated (default-grants trap).

## 4. Buyer side

- Seat card on the event page: a "More tickets · seats on request" list under the
  stadium picture — label, rows, available, price, note, quantity stepper, Reserve.
- Full-screen map: the allocation blocks get a hatched outline + tooltip; tapping one
  opens its card in the bottom sheet (no seat picking).
- Checkout, payment box (bank QR / PayPal), 48 h hold, My seats: unchanged; the order
  shows "Seats: confirmed before transfer" until assigned.

## 5. Seller side (console)

- Stock tab → "Allocations": add / edit quantity, price, rows, note; pause / resume.
- Orders: allocation orders get "Assign seats" (block · row · seat lines) → saved on the
  order and shown to the buyer; logged in the Activity tab.

## 6. Open questions

1. Same flow as the other tickets: reserve → pay by bank QR / PayPal within 48 h →
   tickets transferred via Eventim?
2. Can groups be promised to sit together? If not known: "together where possible".
3. Max tickets per order: keep the sale's current limit?
