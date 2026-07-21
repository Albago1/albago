# Phase 33 — E-Ticketing v1 (free tickets, DICE-grade), TIX-1 + TIX-2

**Status:** planned, approved scope = free ticketing only (no Stripe, no money, no terminals). Paid tiers snap in later via PAY-2/3 without schema changes — that is the whole point of building on the PAY order schema now.

**Contract docs (read before building):** `docs/master-plan/02-ticketing.md` (TIX — schema, QR design, door mode, decision log) and `docs/master-plan/01-payments.md` (PAY — orders schema, correctness rules). This plan is the execution order for TIX-1 + TIX-2 against the current codebase. Where this plan and the track docs conflict, the track docs win.

**Anchor:** DICE. The ticket is a fan artifact (feels like a poster, not a receipt), the QR is forgery-proof and rotation-capable, the door runs from any phone, and zero oversells under concurrency — by construction, not by hope.

---

## 0. What "integrated with the current system" means concretely

| Existing piece | How ticketing plugs in |
|---|---|
| `events.ticket_url` / `price_from_cents` (external ticket links) | Native tiers **supersede** the external link in the action panel when tiers exist; external link remains the fallback for events ticketed elsewhere. Never show both CTAs. |
| Event page sticky action panel (`app/events/[slug]/page.tsx` ~line 750) | The tier picker renders here, replacing the static Tickets/Price row. Respects existing `hasEnded`, `listing_status = cancelled/postponed` guards — no claims on ended/cancelled events. |
| `is_civic` events | NEVER get tiers (schema-level guard, both directions per TIX decision log). Civic keeps the existing volunteer/attendance vocabulary. The tier picker never renders on civic pages. |
| Organizer dashboard (`app/organizer/OrganizerDashboardClient.tsx`) | New **Tickets** area per event: tier editor + live counters + attendee list + door-mode link. Linear-grade density like the admin queue. |
| `/dashboard` (user) | New **My Tickets** section + route `/dashboard/tickets`. Bottom-nav Profile already leads to dashboard. |
| Resend email layer | New ticket-confirmation template (QR PNGs embedded, .ics attach), same POST-to-`www.albago.org` rule. |
| `trackInteraction` | New analytics actions: `ticket_view_tiers`, `ticket_claim`, `ticket_claim_blocked`, `door_scan` (with result), all with city/country/slug meta. |
| Studio | Later tie-in (not this phase): "Free entry" badge on posters when a free tier exists. Noted so nobody builds it prematurely. |
| `/scan` route | Taken by Lens (poster scanner). Door mode lives at `/organizer/events/[id]/door` per track doc — no collision. |
| Route guards | Door mode + tier editor: server component verifies the signed-in user owns the event's organizer row (or is admin) — same pattern as `/organizer` guards. `noindex` on door + My Tickets. |
| i18n | Every string ×4 (en/de/es/sq), natively phrased. Estimate ~55 new keys (`tix_*`). Time-prominence law applies to every ticket surface. |

**User P0 (one item, zero cost):** add `TICKET_QR_SECRET` to Vercel env (I generate a 32-byte value; plain-language steps at build time). Nothing else — no accounts, no money.

---

## 1. Stage A — Schema + RPCs (SQL pasted in chat, user runs in Supabase)

One SQL block, authored at build time in the style of `docs/seeds/phase-*.sql`, saved as `docs/seeds/phase-33-ticketing.sql`. Per the seeds-drift rule: before writing it, verify deployed signatures of anything touched (`events`, `organizers`, `profiles`, `is_admin()`).

Tables (contract in TIX §2 / PAY §3 — free-relevant subset now, paid columns included so PAY needs zero migrations):

- `ticket_tiers` — full contract incl. `price_cents` (CHECK ≥ 0), `visibility`, `fee_mode`, windows. v1 UI only creates `price_cents = 0` tiers; the **civic guard trigger** (no paid tiers on civic events, no `is_civic` flip on events with paid tiers) ships NOW.
- `orders` + `order_items` — full PAY contract (status enum incl. `awaiting_door`, `idempotency_key`, `expires_at`). v1 only ever creates `provider='free', status='paid'` rows.
- `tickets` — one row per admission: `serial` (`ALB-XXXX-XXXX`, unambiguous alphabet, no 0/O/1/I), `qr_version`, `status`, `payment_due_at_door`, `checked_in_at`.
- `ticket_scans` — append-only audit, insert only via `check_in_ticket`.
- Deferred to their phases (schema reserved, not created): `waitlist_entries`, `promo_codes`, `ticket_transfers`, `webhook_events`, `ledger_entries`, `payouts`.

Functions/RPCs (all SECURITY DEFINER, all in this seed):

- `tier_available(tier_id)` — `capacity − COUNT(tickets valid/checked_in) − live pending holds` (holds = `orders.status='pending' AND expires_at > now()`; always zero in v1 but the formula ships correct). Used by UI, RPCs, sold-out badges. **Never a stored count.**
- `claim_free_tickets(p_tier_id, p_quantity)` — the v1 purchase pipeline in ONE transaction: lock tier `FOR UPDATE` → checks: tier active/public/window open, event published + not civic-guard-violating + not ended/cancelled, `p_quantity ≤ max_per_order`, availability ≥ quantity, **per-user-per-event cap** (existing valid tickets + this claim ≤ `max_per_order` — repeat-order drain guard from the decision log) → insert order (`provider='free'`, `status='paid'`, totals 0) + items + tickets with serials → return ticket ids + serials. Oversell impossible under concurrency by the row lock.
- `check_in_ticket(p_ticket_id, p_expected_event_id)` — atomic `UPDATE … WHERE id=$1 AND status='valid' RETURNING`; loser of a race reads the row → `duplicate` verdict with `checked_in_at`. Verifies ticket belongs to `p_expected_event_id` (else `wrong_event`). Caller must be the event's organizer or admin. Every attempt (any verdict) appends to `ticket_scans`.
- `void_ticket(p_ticket_id)` — organizer/admin; sets `void`, audit row.
- `organizer_save_tier(...)` / `organizer_set_tier_status(...)` — tier CRUD via RPC (writes never direct), enforcing `price_cents = 0` until PAY unlocks paid (explicit guard + error message).
- `door_snapshot(p_event_id)` — organizer/admin; returns `{ticket_id → qr_version, status}` for the event (the §3 offline snapshot; small, one event's worth).

RLS per the (already-corrected) track spec: tiers anon-readable ONLY `public` visibility on published events; tickets readable by owner + event organizer + admin; scans readable by organizer/admin; all writes via the RPCs above.

**DoD (Stage A):** SQL runs clean in Supabase; a scripted REST test (service role, local script) claims tickets from two parallel requests against a capacity-1 tier and exactly one succeeds.

---

## 2. Stage B — QR token layer (server-side, no DB)

`lib/tickets/qrToken.ts` (server-only) per TIX §3, no deviations:

- Token: `ALBGO1.<ticket_id b64url>.<qr_version>.<HMAC-SHA256(k_event, ticket_id||'.'||qr_version) 16B b64url>`
- `k_event = HMAC(TICKET_QR_SECRET, 'evt:'||event_id)` — master never leaves the server; door mode gets only its event's `k_event`.
- `signTicketToken(ticket, eventId)` + `verifyTicketToken(raw, kEvent)` → `{ticketId, qrVersion}` or a typed failure (`bad_signature` | `malformed`). Node `crypto`, timing-safe compare.
- Unit-style script test (`scripts/` or inline verify step): sign → verify roundtrip, tamper → fail, other-event key → fail.

---

## 3. Stage C — Attendee claim flow (event page)

- Server: event page query joins public tiers + availability; passes to a new `components/event/TierPicker.tsx` (client).
- UI in the action panel: tier rows (name, **Free**, availability state: normal / "Selling fast" under 15% / "Sold out"), quantity stepper capped at `max_per_order`, one flame CTA **"Get tickets — free"**. Signed-out tap → `/sign-in?next=/events/<slug>`.
- Claim: `POST /api/tickets/claim` → auth + `claim_free_tickets` RPC → success state IN the panel (ticket count + serials + "View in My Tickets" link), loud and celebratory but on-brand. Errors in plain language ×4 (sold out just now, cap reached, window closed).
- External `ticket_url` continues to render when the event has no native tiers.
- **DoD:** claim on prod with a test event from a phone; second account claims; capacity math verified via the availability function; blocked states (ended/cancelled/civic) verified.

---

## 4. Stage D — My Tickets (`/dashboard/tickets`)

- Server component: owner's tickets grouped upcoming/past, joined with event art.
- **Ticket card = poster, not receipt:** event art ladder (banner → graded backdrop feel via CSS scrim → Ink-style brand backdrop when no photo), flame time kicker (TIME PROMINENT), venue line, tier name, serial, status pill (valid / checked-in / void).
- QR rendered server-side from the signed token (`qrcode` npm, already a dep) — never the bare ticket id. Tap → fullscreen white sheet, max contrast, `navigator.wakeLock` where available.
- Entry points: `/dashboard` card + direct route. `noindex`.
- **DoD:** ticket renders with QR on a phone; fullscreen mode readable at arm's length in the dark (the actual door condition).

---

## 5. Stage E — Ticket email

- Resend template `TicketConfirmationEmail`: subject `Your ticket — {event} · {FRI 11 JUL · 21:00}`, QR PNG per ticket embedded (server-generated data), event art header, .ics attachment (start/end/venue/geo), deep link to My Tickets. Sent AFTER the claim transaction commits (retry-safe, never inside it).
- **DoD:** claim → email arrives with scannable QR (scan it with door mode in Stage G) and a working .ics on iPhone + Google Calendar.

---

## 6. Stage F — Organizer: tiers + sales (dashboard "Tickets")

- Per-event Tickets panel in the organizer dashboard: create/edit free tiers (name, capacity, max/order, window, pause), live `issued / capacity` counters (computed), attendee list (name/email/serial/status), CSV export, and the **Open door mode** button. Price input rendered but locked with "Paid tickets arrive with payments" note — the honest upgrade path, visible.
- Admin: attendee/scan visibility via existing admin patterns + `void_ticket`. (Kill-switch = tier pause; bulk refund tooling waits for PAY.)
- **DoD:** organizer test account creates a tier, sees claims arrive, exports CSV, voids one ticket.

---

## 7. Stage G — Door mode (`/organizer/events/[id]/door`) — TIX-2, the crown jewel

- Server guard: organizer owns event (or admin). Fetches `k_event` + snapshot server-side into the page.
- Fullscreen dark UI: camera viewfinder (`BarcodeDetector` where available, `@zxing/browser` fallback — new dep, dynamic import), torch toggle, live `checked-in / issued` header.
- Scan → verify signature locally (offline-capable) → `check_in_ticket` → full-screen verdict: **GREEN** + name/tier (auto-return 1.2s), **RED** + reason (duplicate shows "already in at 21:43", void, wrong event, forged), vibration patterns per verdict. AMBER (`payment_due_at_door`) ships with PAY — the verdict slot is built now.
- Manual fallback: serial/name/email search → tap to check in (organizer-auth'd; serial alone is not a bearer credential).
- Offline v1 scope, honest per decision log: signature verdicts work offline against the at-open snapshot (re-synced ~30s); check-ins queue and settle "first scan wins" when back online. The known two-offline-devices window is accepted and documented on the surface itself (small footnote in door settings).
- **DoD:** the phase's headline test — user scans a real ticket from a second phone's screen with their phone camera: GREEN; rescans: RED duplicate with timestamp; a voided ticket: RED void; a forged/edited token: RED invalid. Counters correct.

---

## 8. Verification bar (whole phase)

Per handoff protocol: `tsc` clean, eslint clean on touched files, `next build` clean, and the scripted concurrency claim test + real-phone door test. Every stage lands as its own commit (stage-and-confirm — smallest shippable piece, verdict, next). i18n parity check ×4 after Stages C–G. Summary to user always states what remains humanly unverified.

## 9. Explicit non-goals of this phase (so scope cannot creep)

Stripe/live money (PAY-2/3) · cash-at-door mode (needs PAY vocabulary) · waitlists, promo codes, transfers, timed QR reveal, name-on-ticket, Wallet passes (TIX-4) · guest checkout · per-tier analytics dashboards · Studio "free entry" badge. All designed-for, none built now.

## 10. Suggested build order across sessions

1. **Session 1:** Stage A SQL (paste → user runs) + Stage B token lib + concurrency script. _Nothing user-visible yet — correctness core first._
2. **Session 2:** Stage C claim flow + Stage D My Tickets (the attendee loop closes).
3. **Session 3:** Stage E email + Stage F organizer panel.
4. **Session 4:** Stage G door mode + full E2E with two phones.
