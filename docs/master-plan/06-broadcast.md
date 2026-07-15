# BC — Broadcast: the social distribution engine

**Status:** ARCHITECTURE PROPOSED (user request 2026-07-15). Admin-only for the entire buildout: developed, tested, and deployed on the production domain, but visible and usable exclusively by `profiles.role = 'admin'`. No public surface, no organizer surface, until the user decides otherwise.

**One sentence:** turn every AlbaGo event into scheduled, branded, multi-platform social posts — bulk-generated from the existing Studio templates and published automatically to AlbaGo's own channels — so one admin can run the output of a five-person social team.

Product-bible anchor: §06 Growth Loop #1 ("Event → branded poster/story/reel → shared → tap-through → save → share again"). This track builds the *machine half* of that loop: AlbaGo posting as itself, instantly and in bulk. The *user half* (organic reshares) already shipped as the Share Studio.

---

## 1. The honest platform map (what "instant share" really means per network)

This is the part every "world-class" plan must get right, because the platforms are not equal and pretending otherwise produces vaporware.

| Platform | Real capability | Cost | Review needed? | Verdict |
|---|---|---|---|---|
| **Telegram** | Bot API: post photos, videos, albums, buttons to a channel, instantly, no limits that matter | Free | None | **Tier 1 — first ship.** Perfect fit for the protest/diaspora audience |
| **Instagram** | Graph API Content Publishing: feed images (JPEG), carousels, **Reels**, **Stories** — on a Professional (Business/Creator) account linked to a Facebook Page, via a Meta developer app | Free | **Not for us**: in Development Mode the app can publish to accounts that have a role on the app (our own). App Review is only needed to serve *other people's* accounts | **Tier 1 — the centerpiece.** Limit: 50 API posts per 24h per IG account |
| **Facebook Page** | Pages API: post links, photos, videos to our own Page through the same Meta app | Free | Same as IG — own Page works in dev mode | **Tier 1** — same pipeline as IG, nearly free to add |
| **X / Twitter** | API v2 free tier: ~500 writes/month, OAuth on our own account | Free | None (free tier) | **Tier 2** — worth it for civic reach; budget ~16 posts/day max |
| **TikTok** | Content Posting API: unaudited apps can only push to the account's **drafts** (user finishes in-app). Full auto-publish needs an audit | Free | Audit for auto-publish | **Tier 3** — "push to drafts" is still a real workflow win; do later |
| **WhatsApp** | No public API for Channels; Business Cloud API is for 1:1 messaging, not broadcast feeds | — | — | **Out of scope for auto-post.** The share-links in the Studio remain the WhatsApp story |

Two structural consequences:

1. **The Meta app runs in Development Mode forever (for this phase).** Because the system is admin-only and posts only to AlbaGo's own IG + FB Page, we never need Meta App Review. The user adds their own Meta account to the app; that's the entire permission story. This is the single biggest simplification in the whole architecture.
2. **Images must be hosted at a public URL** for IG publishing (the API fetches them). Supabase Storage public bucket covers this with zero new infrastructure.

## 2. Architecture — four layers

```
┌─────────────────────────────────────────────────────────────┐
│  /admin/broadcast  (Composer · Calendar · Queue · Accounts)  │  UI layer
├─────────────────────────────────────────────────────────────┤
│  Asset Engine — Studio templates rendered in bulk            │  Asset layer
│  (client-side batch render → JPEG/MP4 → Storage bucket)      │
├─────────────────────────────────────────────────────────────┤
│  Queue — social_posts rows (draft→queued→publishing→         │  Data layer
│  published/failed), social_accounts (tokens), scheduling     │
├─────────────────────────────────────────────────────────────┤
│  Publisher — per-platform adapters behind one interface,     │  Delivery layer
│  driven by a cron tick + a "publish now" admin action        │
└─────────────────────────────────────────────────────────────┘
```

### 2.1 Data layer (all tables deny-all RLS; access only via `is_admin()` SECURITY DEFINER RPCs)

```
social_accounts
  id uuid pk
  platform text check in ('telegram','instagram','facebook','x','tiktok')
  label text                      -- "AlbaGo main IG"
  handle text                     -- @albago.al
  credentials jsonb               -- tokens/chat ids; see §5 security
  meta jsonb                      -- ig_user_id, page_id, expires_at…
  status text check in ('connected','expiring','error','disabled')
  created_at, updated_at

social_posts
  id uuid pk
  event_id uuid references events(id) on delete set null
  account_id uuid references social_accounts(id)
  kind text check in ('image','carousel','story','reel','link','text')
  caption text                    -- final caption incl. link + UTM
  asset_urls text[]               -- public Storage URLs (JPEG/MP4)
  scheduled_at timestamptz        -- null = manual/publish-now
  status text check in ('draft','queued','publishing','published','failed','cancelled')
  external_id text                -- platform post id after publish
  external_url text               -- permalink for the queue UI
  error text
  attempts int default 0          -- retry ceiling 3, exponential backoff
  campaign_id uuid null           -- groups a bulk run
  created_at, published_at

social_campaigns                  -- one bulk action = one campaign
  id uuid pk
  name text                       -- "Weekend push Jul 18–20"
  created_by uuid
  created_at
```

No cached aggregates (law #4): queue counts and per-day published tallies are SQL functions over `social_posts`.

### 2.2 Asset layer — reuse the Studio, don't rebuild it

The Share Studio already renders pixel-perfect Story (1080×1920), Square (1080×1080) and FB/OG (1200×630) artifacts, records 15s/30s reels, and generates AI poster backdrops + AI captions ×4 languages. That IS the asset engine — it just currently renders one event at a time into the admin's browser.

**Bulk mode = a loop around what exists:** `/admin/broadcast/composer` multi-selects events, then renders each event's chosen formats **in the admin's browser** (hidden DOM, exactly like the Studio does today), converts to JPEG (IG requires JPEG), uploads to a `social-assets` public bucket, and writes `social_posts` drafts. Reels record the same way the Studio recorder does — sequentially, with a progress bar.

Why client-side rendering is the *right* call and not a compromise:
- The templates are React components; they render identically to what shipped — zero drift between preview and post.
- Server-side rendering (satori/@vercel/og) can't run the reel recorder at all, chokes on the custom fonts/blur stack, and burns Vercel free-tier compute. The admin's browser is a free, always-correct render farm.
- The system is admin-only: there is always a human at the wheel when assets are generated. Publishing (the part that must run unattended) needs no rendering.

AI captions: the existing `/api/ai-caption` pack (en/sq/de/es) prefills every post's caption; the composer lets the admin pick language per account (e.g., sq for Telegram channel, en for X).

### 2.3 Delivery layer — one interface, five adapters

```ts
// lib/social/publisher.ts
export interface SocialAdapter {
  platform: Platform
  publish(post: SocialPost, account: SocialAccount): Promise<{ externalId: string; url?: string }>
  verify(account: SocialAccount): Promise<AccountHealth>   // token/permission check
}
```

- `adapters/telegram.ts` — `sendPhoto`/`sendVideo`/`sendMediaGroup` to the channel with an inline "Open on AlbaGo →" button. ~40 lines. Rock solid.
- `adapters/instagram.ts` — two-step Graph API: `POST /{ig_user_id}/media` (image_url / video_url + caption, `media_type=STORIES|REELS` when applicable) → poll container status → `POST /{ig_user_id}/media_publish`. Handles the 50/24h budget: the queue **refuses to schedule** an IG account past its daily budget rather than failing at publish time.
- `adapters/facebook.ts` — `POST /{page_id}/photos|feed` with the page token.
- `adapters/x.ts` — `POST /2/tweets` (+ media upload v1.1). Monthly budget (~500) enforced in the scheduler the same way as IG's daily one.
- `adapters/tiktok.ts` — Tier 3, drafts only.

**The tick.** Publishing must run unattended. Free-tier reality: Vercel Hobby cron is limited (low frequency), so the scheduler tick is a **Supabase `pg_cron` job every 5 minutes** calling `https://www.albago.org/api/broadcast/tick` with a shared secret header. The tick route: claim due posts with `FOR UPDATE SKIP LOCKED` (status queued, scheduled_at <= now, attempts < 3) → set `publishing` → call adapter → `published` or `failed` with error + backoff. Idempotent, safe to double-fire. A "Publish now" button in the queue calls the same code path directly.

### 2.4 UI layer — `/admin/broadcast` (inside the existing admin layout = already admin-gated)

Four tabs, Linear-grade density like the rest of `/admin`:

1. **Composer** — pick events (same filters as the events admin), pick formats (Story / Square / Reel / Link), pick accounts, captions prefilled (AI pack, per-language), schedule mode: *now* / *pick times* / **auto-drip** ("spread across golden hours: 12:00, 18:00, 20:30 local, max N/day/account"). One click = one campaign.
2. **Calendar** — week grid of scheduled posts per account; drag to reschedule (v2), click to edit/cancel.
3. **Queue** — live status list (queued → publishing → published/failed), permalink out to the real post, error surface, one-click retry, per-day budget meters (IG 50/day, X 500/mo).
4. **Accounts** — connect/health screen: Telegram (paste bot token + channel), Meta (paste app credentials once; OAuth dance grabs the long-lived token; shows expiry + one-click refresh), X (paste keys). Shows `verify()` health per account.

## 3. Phases (smallest shippable first, per handoff protocol §2)

| Phase | Ships | Why first/next |
|---|---|---|
| **BC-1** | Tables + RPCs + `/admin/broadcast` shell + **Telegram adapter** end-to-end (compose one event → post lands in channel with photo, caption, button) + tick worker | Whole architecture proven on the platform with zero external approvals. Same-day win |
| **BC-2** | **Meta connection** (Accounts tab OAuth, token store, refresh) + IG feed image + IG Story + FB Page post, single event | The centerpiece; still one event at a time to keep the slice small |
| **BC-3** | **Bulk composer**: multi-select → batch client render → Storage upload → campaign drafts → auto-drip scheduler + Calendar + Queue | This is the "bulkpost on IG" the user asked for |
| **BC-4** | **Reels pipeline** (batch-record via Studio recorder → IG Reels + FB video) + X adapter | Video = the reach format; X = civic amplification |
| **BC-5** | **Insights loop**: UTM on every posted link (`utm_source=<platform>&utm_campaign=<id>`), click dashboard from existing `trackInteraction`, IG/FB impressions via Graph API, "best hour" suggestions from our own data | Closes the loop; makes the drip scheduler smart |

Each phase: SQL pasted in chat first → user runs + confirms → build → tsc/eslint/build clean → real post on a real channel as E2E → commit/push → plain-language "check this" list.

## 4. What only the user can do (BC User P0 checklist)

- [ ] **Telegram (5 min, before BC-1):** create bot via @BotFather → get token; create the AlbaGo channel; add the bot as channel admin (post rights).
- [ ] **Meta (30 min, before BC-2):** Instagram account → Professional (Business); create/link a Facebook Page; create a Meta developer app (type Business, free); add own account as app admin. The Accounts tab walks through the token step.
- [ ] **X (10 min, before BC-4):** developer account (free tier), create app, generate keys.
- [ ] Decide channel identity: post as **AlbaGo** in Albanian, English, or mixed per platform (recommend: Telegram sq, IG sq+en caption, X en).

## 5. Security & privacy (admin-only is a feature, not a mode)

- Every route lives under `/admin` (server-guarded by the existing admin layout) or `/api/broadcast/*` with an `is_admin()` check; the tick route additionally requires the `BROADCAST_TICK_SECRET` header.
- All tables: RLS enabled, **no policies** (deny-all); every read/write via SECURITY DEFINER RPCs gated on `is_admin()` — `admin_set_studio_access` pattern.
- Tokens in `social_accounts.credentials` are **AES-GCM encrypted at the application layer** with `SOCIAL_CRED_KEY` from env before insert; decrypted only inside server code. They never appear in client props, logs, or error messages. (Supabase Vault noted as an upgrade path.)
- The public can never see, reach, or infer the system: no links, no sitemap entries, `robots` noindex inherited from `/admin`.
- Nothing here touches civic-surface monetization laws — Broadcast promotes events; it never charges for placement (§10 pledge).

## 6. Explicitly deferred (Decision Log candidates)

- Organizer-facing Broadcast (organizers connecting their own IG) — needs Meta App Review + token vault hardening; only after the admin system proves value.
- TikTok auto-publish audit, YouTube Shorts, WhatsApp anything.
- Server-side rendering farm (only if the admin-browser render loop becomes the bottleneck).
- Paid scheduling tools (Buffer/Later et al.) — permanently out; this system *is* the replacement, at €0.

## Decision Log

| Date | Decision | Why |
|---|---|---|
| 2026-07-15 | Meta app stays in Development Mode; own accounts only | Admin-only scope makes App Review unnecessary — biggest simplification available |
| 2026-07-15 | Assets rendered client-side in the admin browser, published server-side | Reuses shipped Studio pixel-for-pixel; recorder can't run server-side; free tier stays free |
| 2026-07-15 | pg_cron → tick endpoint (5 min) over Vercel cron | Vercel Hobby cron too infrequent; pg_cron is free and already in the stack |
| 2026-07-15 | Telegram before Instagram | Zero-approval platform proves the full pipeline in one phase; audience fit (protest/diaspora) |
| 2026-07-15 | Platform budgets enforced at schedule time, not publish time | A queue that accepts doomed posts is a queue that lies |
