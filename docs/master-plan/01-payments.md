# 01 — Payments Track (PAY)

Goal: a provider-agnostic money layer that can be developed to completion **today at zero cost** (Stripe test mode), flipped live with paperwork only, and that survives the awkward geographic reality of this platform: **Stripe does not operate in Albania**, but AlbaGo's organizers live in Albania, Kosovo, AND the diaspora (DE/CH/AT/…).

## 1. Ground truths the architecture must respect

1. **Stripe availability:** platform account must be in a supported country (Germany assumed — the user's context suggests Berlin; CONFIRM before PAY-2). Organizers in Germany/Austria/Switzerland/etc. can hold Stripe Connect accounts; organizers in Albania/Kosovo **cannot**.
2. **SEPA reaches Albania & Kosovo now** (both admitted to SEPA in 2024–2025). Euro payouts to AL/XK bank accounts are cheap ordinary transfers. This is what makes the platform-ledger payout model viable.
3. **Albania is cash-at-door culture** (bible §10): paid card ticketing starts with diaspora-city events; at home, "reserve free / pay at door" must be a first-class mode, not a hack.
4. **No money today:** everything in PAY-1 uses Stripe **test mode** — free forever, no card, no bank, no entity. Live mode is gated on the User P0 checklist.
5. **Platform fee model (bible §10 #1):** 3–5% + payment costs, vs Eventbrite's ~7–10%. Free events: zero fees, loudly. Civic: never monetized at all — paid tiers are DISABLED for `is_civic` events at the schema level (CHECK/RPC guard), not just hidden in UI.

## 2. Money flow model (the core decision)

**Hybrid: "platform-as-merchant + internal ledger" first, Stripe Connect destination charges as an upgrade path.**

- **Model A — Platform merchant (PAY-1..3, default for everyone):** AlbaGo's Stripe account is the merchant. Buyer pays AlbaGo; the sale is recorded in an internal double-entry ledger crediting the organizer's balance (gross − platform fee − payment costs). Organizers get paid via **payout runs** (manual SEPA transfers first, semi-automated later). This is exactly how early-stage ticketing platforms operate in Stripe-unsupported markets, and it works identically for ALL organizers regardless of country.
- **Model B — Stripe Connect Express (PAY-4+, optional upgrade):** organizers in Stripe-supported countries onboard to Connect Express; charges become destination charges with `application_fee_amount`; Stripe handles their payouts + KYC. `organizers.stripe_account_id` (already reserved in schema) stores it. Albania/Kosovo organizers simply stay on Model A. The orders/ledger schema is identical for both — only the charge creation differs.

Why not Connect-only: it would exclude the home market entirely. Why not ledger-only forever: Connect removes payout labor + shifts KYC/liability to Stripe where possible. The abstraction (§4) keeps both behind one interface.

**Seller of record:** the organizer is the seller of the ticket; AlbaGo is the facilitator/agent collecting on their behalf. Receipts name the organizer. Platform revenue = the fee only (that's what the platform invoices/VATs — flag for an accountant at PAY-2; do not build tax logic beyond clean records).

**Gate A legal check (added 2026-07-12):** collecting buyer money on organizers' behalf can constitute regulated payment services in Germany (ZAG/PSD2). Platforms in this exact shape rely on the commercial-agent exemption — which is why the agent framing above must be real, not decorative: organizer named as seller on the receipt, agency stated in the ToS. One question for the accountant/lawyer during entity setup, before any live charge. Tracked on the README User P0 checklist.

## 3. Database schema (paste-ready SQL is written at build time; this is the contract)

All amounts `int` cents. All tables RLS'd per repo patterns. No cached aggregates — balances and availability are SQL functions.

```
payment_providers    (enum-ish: 'stripe' | 'cash_at_door' | 'free')  — provider column values

orders
  id uuid PK, user_id FK profiles (nullable: guest checkout later, NOT v1),
  event_id FK events, organizer_id FK organizers (denormalized at order time),
  status text CHECK IN ('pending','awaiting_door','paid','cancelled','expired','refunded','partially_refunded'),
  provider text, provider_session_id text, provider_payment_intent text,
  subtotal_cents int, fee_cents int (platform fee), payment_cents int (pass-through est.),
  total_cents int, currency char(3) DEFAULT 'EUR',
  contact_email text, idempotency_key text UNIQUE,
  created_at, paid_at, expires_at (pending orders expire = hold release)

order_items
  id uuid PK, order_id FK CASCADE, tier_id FK ticket_tiers,
  quantity int CHECK > 0, unit_price_cents int, unit_fee_cents int

webhook_events
  id text PK (provider event id — natural dedup), provider text,
  type text, payload jsonb, processed_at, error text
  — dedup on SUCCESS, not on receipt (fixed 2026-07-12): INSERT with processed_at NULL,
    claim the row FOR UPDATE (skip only if processed_at IS NOT NULL), run fulfillment in
    the SAME transaction, stamp processed_at last. Receipt-time "ON CONFLICT → already
    handled" is a trap: a crash after insert makes Stripe's retry a no-op — buyer paid,
    order never fulfilled, and nothing ever retries it.

ledger_entries        (double-entry style; the auditable truth of who is owed what)
  id uuid PK, organizer_id FK, order_id FK nullable, payout_id FK nullable,
  kind text CHECK IN ('sale','refund','adjustment','payout'),
  amount_cents int  (+credit organizer / −debit), currency char(3),
  memo text, created_at
  — organizer_balance(organizer_id) = SUM(amount_cents); SQL function, never a column
  — CHECK (currency = 'EUR') until multi-currency is real: SUM across mixed currencies
    is silent corruption, so the constraint makes the single-currency assumption explicit

payouts
  id uuid PK, organizer_id FK, amount_cents int, currency char(3),
  method text ('sepa_manual' | 'stripe_connect'), reference text,
  status text CHECK IN ('pending','sent','failed'), created_by FK, created_at, sent_at

organizer_payout_profiles
  organizer_id PK FK, legal_name text, iban text, bank_country char(2),
  payout_currency char(3) DEFAULT 'EUR', notes text
  — RLS: owner read/write, admin read. IBAN is sensitive: column-level care, never public.
```

RLS sketch: `orders`/`order_items` readable by the buyer (`user_id = auth.uid()`), the event's organizer, and admin; INSERT only via SECURITY DEFINER RPC (`create_order`) — clients never write orders directly. `ledger_entries`/`payouts`: organizer reads own, admin all, writes only via RPCs/webhook service role.

## 4. Provider abstraction (`lib/payments/`)

```ts
// lib/payments/types.ts
export type CheckoutSession = { url: string; providerSessionId: string }
export interface PaymentProvider {
  id: 'stripe' | 'cash_at_door' | 'free'
  createCheckout(order: OrderDraft): Promise<CheckoutSession> // 'free' fulfills instantly
  handleWebhook(req: Request): Promise<WebhookResult>          // verify sig, normalize event
  refund(order: Order, amountCents?: number): Promise<RefundResult>
}
```

- `lib/payments/stripe.ts` implements it with **Stripe Checkout (hosted)** — PCI SAQ-A, Apple Pay/Google Pay/cards for free, no card UI to build or maintain. Payment Element embedding is a later polish, not v1.
- `lib/payments/free.ts` fulfills zero-total orders instantly (TIX v0 uses only this).
- `cash_at_door` = order status **`awaiting_door`**, NOT `pending` (fixed 2026-07-12); tickets issued `valid` with `payment_due_at_door = true` shown at scan time (door staff collects; check-in settles the order to `paid`). It must not be `pending` for two reasons: its tickets already exist, so counting it as a pending hold too would double-decrement availability; and the expiry sweep would kill a door reservation after 30 minutes while its tickets stayed `valid` — orphaned state. A door reservation lives until the event. Simple, honest, matches home-market culture.
- Env: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PUBLISHABLE_KEY`, `PLATFORM_FEE_BPS` (default 300 = 3%), all test-mode values until Gate A.

## 5. The purchase pipeline (correctness rules)

1. **Reserve:** `create_order(tier_id, qty, …)` RPC — locks the tier row `FOR UPDATE` (multi-tier orders lock rows in a consistent order, by tier id, or two mixed-tier orders can deadlock), computes availability (capacity − issued − active pending holds), inserts `orders(status='pending', expires_at = now()+30min)` + items. The hold is 30 minutes because Stripe Checkout **refuses `expires_at` values under 30 minutes** (fixed 2026-07-12 — the original 10-minute hold was impossible to align: inventory would have released while the buyer could still legally pay). Overselling is impossible by construction, not by hope.
2. **Checkout:** API route creates the Stripe Checkout Session (`client_reference_id = order.id`, `metadata.order_id`, `expires_at` aligned to the hold). Redirect.
3. **Fulfill on webhook, never on redirect — and in ONE transaction.** `checkout.session.completed` → claim the `webhook_events` row (§3 dedup rule) → then in a single DB transaction: order `paid` + issue tickets (TIX doc) + `ledger_entries(kind='sale')` + stamp `processed_at`. Never split mark-paid from issue-tickets: in that gap the order is no longer a pending hold and its tickets don't exist yet, so `tier_available` counts neither and a concurrent `create_order` oversells. The ticket email sends after commit (retryable, never inside the transaction). The success page only POLLS order status; it never fulfills (users close tabs; webhooks don't).
4. **Late-payment race (added 2026-07-12):** a completed-checkout webhook can arrive for an order already `expired` (payment at minute 29 + sweep timing, webhook retries, clock skew). Inside the same fulfillment transaction, re-lock the tier(s) and recompute availability: capacity still there → revive the order (`expired`→`paid`) and fulfill normally; capacity gone (someone else bought the released inventory) → `provider.refund()` immediately, mark the order `refunded`, email the buyer in plain language. Fulfilling an expired order without the re-check is the oversell; dropping the webhook without refunding is keeping someone's money.
5. **Expire:** pg_cron or Vercel cron sweep: `pending` orders past `expires_at` → `expired` (holds evaporate because availability counts only non-expired pendings; the status flip is bookkeeping, correctness comes from the timestamp). `awaiting_door` orders are NEVER swept. Stripe session auto-expires in parallel.
6. **Reconcile:** daily sweep compares Stripe sessions/payment_intents vs orders; mismatches → admin alert list. (Vercel Hobby cron = daily granularity, 2 jobs max — acceptable; expiry can also run lazily inside `create_order`.)
7. **Refunds:** v1 = admin/organizer-initiated full refund via RPC → provider.refund() → webhook `charge.refunded` confirms → order `refunded`, tickets `void`, ledger `refund` entry. Ledger rule for v1 (added 2026-07-12): reverse the sale in full — the buyer gets everything back including the platform fee (v1 is full-refund only; returning our cents beats explaining why we kept them), and the organizer is debited exactly the net previously credited. A refund landing after a payout can push a balance **negative** — that is a legal ledger state; payout runs net it and never pay a balance ≤ 0. Partial + attendee self-serve windows = PAY-4. Event cancellation = bulk refund job over paid orders. Free/`awaiting_door` orders have no provider webhook — their refund/void path completes synchronously in the RPC.

## 6. Fees engine

- `platform_fee_bps` global default (300), overridable per organizer (pilot deals) and forced to 0 where `total=0` or event `is_civic`.
- `fee_mode` per event: `'absorb'` (organizer nets price − fee) or `'pass'` (buyer sees price + fee line). Default `'pass'`, organizer chooses in the tier editor. Fee line is ALWAYS itemized at checkout — transparent, anti-Eventbrite positioning (bible §10 guardrail).
- Payment processing cost (Stripe ~1.5%+€0.25 EEA cards) recorded on the order at webhook time from the balance transaction when available; ledger credits organizer with gross − platform fee − actual payment cost (Model A).

## 7. Phases

### PAY-1 — Abstraction + Stripe test mode E2E (no gates, start anytime)
- [ ] SQL: orders, order_items, webhook_events + RPCs (`create_order`, `expire_orders`) — pasted in chat.
- [ ] `lib/payments/` abstraction + stripe.ts (test keys) + free.ts.
- [ ] Webhook route `/api/webhooks/stripe` with signature verify + dedup + fulfillment.
- [ ] Checkout flow wired to a hidden test event; full E2E with Stripe test cards (4242…), including webhook fulfillment, expiry sweep, and duplicate-webhook replay test.
- [ ] Refund RPC + flow in test mode.
- **DoD:** a test purchase issues tickets end-to-end on production infra with test keys; replayed webhooks are no-ops; expired holds release inventory.

### PAY-2 — Go live (Gate A: entity + bank + Stripe KYC done)
- [ ] Swap env to live keys (Vercel env), re-run E2E with a real €1 self-purchase, refund it.
- [ ] ToS + Refund Policy pages (drafts written for user review; plain language ×4).
- [ ] 3 hand-picked pilot organizers, diaspora-city events first (bible M13 shape). Fee: 3% launch.
- [ ] Receipts/confirmation email shows organizer as seller + fee line.

### PAY-3 — Ledger + payouts
- [ ] SQL: ledger_entries, payouts, organizer_payout_profiles + `organizer_balance()`.
- [ ] Organizer dashboard: Balance card (computed), sales list, payout history.
- [ ] Admin: payout run screen — list balances > €25, mark-paid with SEPA reference (manual transfers by user; the screen produces a copy-paste transfer list).
- [ ] Ledger integrity check script (sum of entries per order = order totals; AND period totals of `sale`/`refund` entries reconcile against Stripe balance-transaction totals — the ledger is single-leg per organizer, so without an external tie-out it can drift from the actual money silently).

### PAY-4 — Upgrades (post-traction, pick by data)
- Stripe Connect Express onboarding for supported-country organizers (Model B), destination charges + `application_fee_amount`; Payment Element embedded checkout; attendee self-serve refund windows; partial refunds; promo-code interaction; multi-currency display (ALL alongside EUR); local Balkan PSP investigation (POK / bank gateways) behind the same interface if home-market card volume justifies it.

## Decision Log (append here)

| Date | Decision | Why |
|---|---|---|
| 2026-07-10 | Hybrid ledger-first money model | Stripe absent in AL/XK; SEPA now reaches both; identical UX for all organizers |
| 2026-07-10 | Hosted Stripe Checkout, not custom card UI | PCI SAQ-A, wallets for free, zero maintenance — what the best small platforms actually do |
| 2026-07-10 | Fulfillment only via webhook + dedup table | The only correct pattern; redirect fulfillment loses/dupes orders |
| 2026-07-10 | Civic paid-tiers blocked at schema level | Bible pledge is structural, not cosmetic |
| 2026-07-12 | Webhook dedup keyed on processed SUCCESS; fulfillment is one DB transaction | Receipt-time dedup + split fulfillment = paid orders without tickets and oversell windows under crash/retry |
| 2026-07-12 | Hold = 30 min; late webhooks re-check capacity, revive or auto-refund | Stripe Checkout expiry minimum is 30 min — the 10-min hold was unimplementable; expired-then-paid otherwise oversells or strands money |
| 2026-07-12 | `awaiting_door` order status for cash-at-door | `pending` + issued tickets double-counted availability and the sweep would orphan valid tickets |
| 2026-07-12 | Refunds reverse the sale in full (fee returned); negative balances legal, netted at payout | Simplest honest v1; refund-after-payout is inevitable and must not break the ledger |
| 2026-07-12 | ZAG/PSD2 commercial-agent check added to Gate A | Platform-as-merchant collecting for third parties can be regulated payment services in DE; cheaper as one lawyer question than as a surprise |
