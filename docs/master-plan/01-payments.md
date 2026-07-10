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

## 3. Database schema (paste-ready SQL is written at build time; this is the contract)

All amounts `int` cents. All tables RLS'd per repo patterns. No cached aggregates — balances and availability are SQL functions.

```
payment_providers    (enum-ish: 'stripe' | 'cash_at_door' | 'free')  — provider column values

orders
  id uuid PK, user_id FK profiles (nullable: guest checkout later, NOT v1),
  event_id FK events, organizer_id FK organizers (denormalized at order time),
  status text CHECK IN ('pending','paid','cancelled','expired','refunded','partially_refunded'),
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
  — every webhook inserts here FIRST (ON CONFLICT DO NOTHING → already handled)

ledger_entries        (double-entry style; the auditable truth of who is owed what)
  id uuid PK, organizer_id FK, order_id FK nullable, payout_id FK nullable,
  kind text CHECK IN ('sale','refund','adjustment','payout'),
  amount_cents int  (+credit organizer / −debit), currency char(3),
  memo text, created_at
  — organizer_balance(organizer_id) = SUM(amount_cents); SQL function, never a column

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
- `cash_at_door` = order marked `pending` with door-payment flag; ticket issued as `valid` with `payment_due_at_door = true` shown at scan time (door staff collects). Simple, honest, matches home-market culture.
- Env: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PUBLISHABLE_KEY`, `PLATFORM_FEE_BPS` (default 300 = 3%), all test-mode values until Gate A.

## 5. The purchase pipeline (correctness rules)

1. **Reserve:** `create_order(tier_id, qty, …)` RPC — locks the tier row `FOR UPDATE`, computes availability (capacity − issued − active pending holds), inserts `orders(status='pending', expires_at = now()+10min)` + items. Overselling is impossible by construction, not by hope.
2. **Checkout:** API route creates the Stripe Checkout Session (`client_reference_id = order.id`, `metadata.order_id`, `expires_at` aligned to the hold). Redirect.
3. **Fulfill on webhook, never on redirect.** `checkout.session.completed` → insert into `webhook_events` (dedup) → mark order `paid` → issue tickets (TIX doc) → write `ledger_entries(kind='sale')` → send ticket email. The success page only POLLS order status; it never fulfills (users close tabs; webhooks don't).
4. **Expire:** pg_cron or Vercel cron sweep: `pending` orders past `expires_at` → `expired` (holds evaporate because availability counts only non-expired pendings). Stripe session auto-expires in parallel.
5. **Reconcile:** daily sweep compares Stripe sessions/payment_intents vs orders; mismatches → admin alert list. (Vercel Hobby cron = daily granularity, 2 jobs max — acceptable; expiry can also run lazily inside `create_order`.)
6. **Refunds:** v1 = admin/organizer-initiated full refund via RPC → provider.refund() → webhook `charge.refunded` confirms → order `refunded`, tickets `void`, ledger `refund` entry. Partial + attendee self-serve windows = PAY-4. Event cancellation = bulk refund job over paid orders.

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
- [ ] Ledger integrity check script (sum of entries per order = order totals).

### PAY-4 — Upgrades (post-traction, pick by data)
- Stripe Connect Express onboarding for supported-country organizers (Model B), destination charges + `application_fee_amount`; Payment Element embedded checkout; attendee self-serve refund windows; partial refunds; promo-code interaction; multi-currency display (ALL alongside EUR); local Balkan PSP investigation (POK / bank gateways) behind the same interface if home-market card volume justifies it.

## Decision Log (append here)

| Date | Decision | Why |
|---|---|---|
| 2026-07-10 | Hybrid ledger-first money model | Stripe absent in AL/XK; SEPA now reaches both; identical UX for all organizers |
| 2026-07-10 | Hosted Stripe Checkout, not custom card UI | PCI SAQ-A, wallets for free, zero maintenance — what the best small platforms actually do |
| 2026-07-10 | Fulfillment only via webhook + dedup table | The only correct pattern; redirect fulfillment loses/dupes orders |
| 2026-07-10 | Civic paid-tiers blocked at schema level | Bible pledge is structural, not cosmetic |
