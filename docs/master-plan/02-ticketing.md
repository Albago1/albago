# 02 — E-Ticketing Track (TIX)

Goal: DICE-grade ticketing — the ticket as a fan artifact, forgery-proof QR at the door, zero oversells under concurrency, and a door experience an organizer can run from any phone. Ships FIRST with free tickets (no payment deps), then paid tiers snap in via the PAY track.

## 1. Product shape (what the best do, distilled)

- **DICE:** mobile-first ticket in the app, QR revealed/rotated to kill touting, waiting lists that actually work, fan-first refund flow. ← primary anchor.
- **Eventbrite:** organizer self-serve machinery (tiers, windows, promo codes, door app). ← machinery anchor, NOT the UX (their fee opacity and clutter are the anti-pattern; bible is explicitly anti-Eventbrite on fees).
- **RA:** restraint + editorial dignity. Tickets never cheapen the page.
- **AlbaGo twist:** civic events get ATTENDANCE tools, never tickets ("I'm going" counts, capacity heads-up) — the ticket machine powers free RSVP there with zero commerce vocabulary.

## 2. Schema (contract; SQL authored at build time, pasted in chat)

Extends the PAY schema (orders/order_items live there). Supersedes the old `event_tickets`/`ticket_purchases` name sketch in schema-reference Future Reserved.

```
ticket_tiers
  id uuid PK, event_id FK events CASCADE,
  name text, description text,
  price_cents int CHECK >= 0, currency char(3) DEFAULT 'EUR',
  capacity int CHECK > 0, max_per_order int DEFAULT 6,
  sales_start timestamptz, sales_end timestamptz,        -- null = open with event lifetime
  visibility text CHECK IN ('public','hidden','unlock_code'),
  fee_mode text CHECK IN ('absorb','pass') DEFAULT 'pass',
  status text CHECK IN ('active','paused','sold_out_manual','archived'),
  sort_order int, created_at
  -- GUARD: trigger/RPC rejects price_cents > 0 when the event is_civic, AND rejects
  -- flipping is_civic on an event that has paid tiers (bible pledge, both directions)

tickets                    (ONE ROW PER ADMISSION — the atomic unit)
  id uuid PK, order_item_id FK, event_id FK (denorm for O(1) door scans),
  tier_id FK, owner_user_id FK profiles,
  serial text UNIQUE,                 -- human code 'ALB-7F3K-92QX' (door fallback / support)
  attendee_name text,                 -- optional name-on-ticket (anti-tout, phase 4)
  status text CHECK IN ('valid','checked_in','void','refunded'),
  qr_version int DEFAULT 1,           -- bump = all previously rendered QRs die (rotation/transfer)
  payment_due_at_door bool DEFAULT false,
  checked_in_at timestamptz, created_at

ticket_scans               (append-only audit of every scan attempt)
  id uuid PK, ticket_id FK nullable (unparseable scans keep raw), event_id FK,
  scanned_by FK profiles, result text CHECK IN
    ('ok','duplicate','void','refunded','wrong_event','bad_signature','not_found'),
  raw text, scanned_at, device_note text

waitlist_entries           (phase 4)
  id, event_id FK, tier_id FK nullable, user_id FK, status ('waiting','offered','converted','expired'),
  offered_at, offer_expires_at, UNIQUE(event_id, user_id)

promo_codes / promo_redemptions   (phase 4)
  code UNIQUE per event, kind ('percent','amount','unlock'), value int, max_redemptions,
  window timestamps; redemptions UNIQUE(code_id, order_id)

ticket_transfers           (phase 4 — in-platform only, the anti-tout stance)
  id, ticket_id FK, from_user FK, to_email text, status ('pending','accepted','cancelled'),
  token uuid, created_at, accepted_at
  -- accept = owner_user_id swap + qr_version bump (old QR dead instantly)
```

**Availability is computed, never stored** (schema principle #4):
`tier_available(tier_id) = capacity − COUNT(tickets valid/checked_in) − SUM(pending non-expired order_items)` — one SQL function used by UI, `create_order` (inside its `FOR UPDATE` lock), and the sold-out badge.

Precision added 2026-07-12: "pending" means exactly `orders.status = 'pending' AND expires_at > now()`. `awaiting_door` orders are NOT holds — their tickets are already issued and counted in the first term; counting them again double-decrements. And `create_order` enforces a **per-user-per-event cap for free tiers** (existing valid tickets + live holds for that user ≤ `max_per_order`): `max_per_order` alone is defeated by placing six separate orders, and free inventory is the easiest thing on the internet to drain.

RLS: tiers anon-readable ONLY where the event is published AND `visibility = 'public'` — `hidden`/`unlock_code` rows must not be publicly selectable, or unlock codes are decorative (fixed 2026-07-12; "public-read" as originally written leaked them). Organizer/admin read all of their own; writes via RPC. `tickets` readable by owner + event organizer + admin; ALL mutations via SECURITY DEFINER RPCs (`issue_tickets`, `check_in_ticket`, `void_ticket`). `ticket_scans` insert via `check_in_ticket` only; organizer reads own event's scans.

## 3. QR design (forgery-proof, offline-verifiable, rotation-capable)

QR encodes a compact signed token, never a bare ID:

```
ALBGO1.<ticket_id_base64url>.<qr_version>.<HMAC-SHA256(k_event, ticket_id || '.' || qr_version) truncated 16B base64url>

k_event = HMAC-SHA256(TICKET_QR_SECRET, 'evt:' || event_id)   -- derived per event; master never leaves the server
```

- `TICKET_QR_SECRET` server env, used ONLY to derive per-event keys. Door mode receives `k_event` for its one event at open — never the master. (Fixed 2026-07-12: the original spec delivered the global secret to the organizer's browser session, which would let ANY organizer — or anyone with a door-staff link — forge valid tokens for every event on the platform. With per-event keys, the worst an organizer can forge is entry to their own door, which they can grant anyway by waving people in.) Bonus: a token from another event fails the signature against `k_event`, so the offline scanner gets a `wrong_event` verdict with no lookup at all.
- The HMAC message is delimiter-joined (`ticket_id || '.' || qr_version`), matching the token layout — undelimited concatenation is ambiguous by construction.
- Rotation = bump `qr_version` (transfer, suspected leak, or timed reveal). Honest scope (stated 2026-07-12): an offline scanner can only prove a token was *genuinely issued* — it cannot know the CURRENT version. Old renders die instantly for online scans; for offline, door mode pulls a snapshot at open (`{ticket_id → qr_version}` + void/refunded ids — one event's worth, tiny) and re-syncs every ~30s while open, so the stale window is seconds, not the night. DICE-style "QR reveals N hours before doors" is a phase-4 toggle per event (until reveal, My Tickets shows the poster + countdown, no QR).
- `serial` is the human fallback: door staff can type it if a screen is cracked. Serial lookup requires organizer auth; it is NOT a bearer credential by itself (door staff confirms name/order email on fallback).

## 4. Surfaces

### Attendee
- **Event page:** tier picker in the sticky action panel (replaces the static `price` string when tiers exist): name, price, fee line (pass mode), availability state ('Selling fast' <15% left, 'Sold out'), quantity stepper ≤ max_per_order. Free tier CTA: "Get ticket — free". Checkout → PAY pipeline (free path = instant).
- **My Tickets** (`/dashboard/tickets` + bottom-nav Profile section): upcoming/past, each ticket a cinematic card — event art (banner→AI poster ladder), flame time kicker (TIME PROMINENT rule), venue, serial, and the QR. Tapping QR = full-brightness fullscreen (`screen.brightness` unavailable on web — white bg + max contrast + wake-lock API). Offline-capable via PWA caching (APP track): the last-rendered tickets render with no signal — critical at venue doors.
- **Ticket email** (Resend): confirmation with embedded QR PNGs (generated server-side, `qrcode` npm, no external service), .ics calendar attach, deep link to My Tickets. Subject pattern: "Your ticket — {event} · {FRI 11 JUL · 21:00}".

### Organizer
- **Tier editor** in event wizard + organizer dashboard (new "Tickets" tab): CRUD tiers, windows, capacity, fee mode, pause. Live sales counter (computed), gross/net preview per tier.
- **Sales view:** orders list (buyer, qty, total, status), CSV export, totals strip. Linear-grade density like the admin queue.
- **Door mode** (`/organizer/events/[id]/door`): the crown jewel — see §5.

### Admin
- Refund tools, event-cancellation bulk refund, scan audit browser, fee override per organizer, kill-switch per event (pause all sales).

## 5. Door mode (the make-or-break surface)

Any staff phone, no install (PWA later wraps it natively):

- Fullscreen dark UI, camera viewfinder (`BarcodeDetector` API where available, `@zxing/browser` fallback), torch toggle.
- Scan → instant verdict screen: **GREEN full-screen flash + name/tier** (ok) / **RED + reason** (duplicate shows "already in at 21:43", void, wrong event, forged) / **AMBER "COLLECT €X"** for `payment_due_at_door` — then auto-return to viewfinder in 1.2s. Haptics via `navigator.vibrate`.
- Header: live counters `checked-in / issued` (computed).
- Manual fallback: search by serial/name/email → tap to check in.
- **Offline queue:** verdicts for authenticity work offline (signature + the at-open snapshot from §3); status settles when back online — queued check-ins sync with conflict rule "first scan wins, later ones flag duplicate". Known exposure (stated 2026-07-12): two devices BOTH offline can each flash GREEN for the same cloned QR inside the sync window; the ~30s re-sync shrinks that window to seconds — accepted for v1, written down so nobody sells offline door mode as airtight.
- **Atomic check-in (added 2026-07-12):** `check_in_ticket` is a single `UPDATE tickets SET status='checked_in', checked_in_at=now() WHERE id = $1 AND status = 'valid' RETURNING …` — two simultaneous online scans of the same ticket get exactly one GREEN; the loser reads the row and shows duplicate-with-timestamp. Checking in a `payment_due_at_door` ticket also settles its order `awaiting_door` → `paid` (the AMBER collect verdict).
- Staff access: organizer can open door mode; shareable door-staff link = short-lived signed token session scoped to ONE event's check-in RPC only (no dashboard access). Phase 3.

## 6. Phases

### TIX-1 — Schema + free tickets E2E (start anytime; pairs with PAY-1's free provider)
- [ ] SQL: ticket_tiers, tickets, ticket_scans + tier_available(), create_order (PAY-1, incl. per-user free-tier cap + consistent tier lock order), issue_tickets, check_in_ticket RPCs. Civic price guard (both directions).
- [ ] Tier editor v1 (organizer dashboard) — free tiers only surfaced.
- [ ] Event page tier picker (free claim flow), instant issuance, ticket email w/ QR.
- [ ] My Tickets v1.
- **DoD:** two accounts claim tickets to a test event; capacity decrements correctly under a scripted concurrent-claim test (no oversell); email QR arrives.

### TIX-2 — Door mode
- [ ] Scanner page + check_in_ticket RPC + scans audit + counters + manual fallback.
- [ ] Duplicate/void/wrong-event verdicts; vibrate; scripted test with real phone camera.
- **DoD:** user checks in a test ticket with their phone camera; second scan shows RED duplicate with timestamp.

### TIX-3 — Paid tiers (Gate A; pairs with PAY-2/3)
- [ ] Paid tier UI unlock, fee lines, Stripe checkout handoff, sold-out/selling-fast states, cash_at_door mode, refunds → tickets void.
- **DoD:** live €-ticket sold to a pilot event; refund voids the ticket; door mode shows void RED.

### TIX-4 — Fan-layer (post-traction, data-picked order)
- Waitlists (auto-offer on refund/void, 24h expiry) · promo/unlock codes · in-platform transfers w/ QR rotation · timed QR reveal · name-on-ticket · Google Wallet passes (free issuer API) → Apple Wallet passes (needs the $99 dev account — shared gate with APP-2) · per-tier analytics for organizers.

## Decision Log (append here)

| Date | Decision | Why |
|---|---|---|
| 2026-07-10 | One row per admission (`tickets`), not qty-on-order | Individual QR/void/transfer/check-in state; the only model that survives door reality |
| 2026-07-10 | Signed QR + qr_version rotation | Forgery-proof offline; transfers/leaks killable without reissuing orders |
| 2026-07-10 | Free tickets ship before any payment | Full machine exercised with zero prerequisites (master-plan insight) |
| 2026-07-10 | Civic = attendance vocabulary, never commerce | Bible pledge, structural guard in schema |
| 2026-07-12 | Per-event door keys derived from the master secret; master never leaves the server | Global secret in any organizer browser = platform-wide forgery; derivation also yields offline wrong_event detection |
| 2026-07-12 | Offline door verdicts = authenticity only; version/duplicate/void settle via at-open snapshot + ~30s re-sync | Honest about what an offline HMAC check can prove; old QRs do not die "instantly" offline |
| 2026-07-12 | Per-user free-tier claim cap in create_order | max_per_order alone is defeated by repeat orders; free inventory drains trivially |
| 2026-07-12 | Hidden/unlock tiers excluded from anon RLS read | Public-read tiers would leak unlock-code tiers, making them decorative |
