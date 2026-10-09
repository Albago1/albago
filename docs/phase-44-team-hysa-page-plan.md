# Phase 44 — Team Hysa landing page (`/hysa`)

Supporter landing page for **Nelson Hysa vs Agit Kabayel** (WBC world heavyweight
title, 28 Nov 2026, Merkur Spiel-Arena Düsseldorf). AlbaGo is the discovery and
supporter interface; the ticket purchase stays in the **official Nelson Hysa
ticket channel**:
`https://www.ticket-onlineshop.com/ols/nelson-hysa/de/tickets/channel/shop/areaplan/venue/event/696488`.

## 1. Findings (2026-10-10)

| Question | Finding |
|---|---|
| Framework | Next.js 16 App Router, Supabase, Tailwind v4, Vercel. Client i18n (localStorage) for the app; first-party analytics via `trackInteraction` → `/api/track` → `interactions`. |
| Official API / documented endpoints | None public. |
| Server-side fetch of the shop | `403 Forbidden` (Akamai bot protection). The shop also runs a Queue-it waiting room (enqueue tokens) and robots.txt disallows `/shop`. Fetching inventory server-side would mean bypassing access controls → **not done**. |
| Embed / iframe | No documented embed. Not verified further (opening the shop from the dev browser was not permitted in this environment); a queue-protected checkout is not a supported embed in any case. |
| Deep link | The channel's area-plan URL above is public and stable → **used for every CTA**. |
| Verified facts | Kabayel 27-0 (19 KO), WBC champion since June 2026; Hysa 25-0 (23 KO), Shkodër, "The Albanian Eagle"; DAZN; Queensberry ("Bad Blood"). Start time is NOT officially published (sources conflict) → not shown. |
| Category ↔ area | From real tickets bought through the Hysa channel: CAT 4 = Innenraum (floor), CAT 6 = Nord-Tribüne Unterrang, CAT 8 = Nord-Tribüne Oberrang. Prices not verified → not shown. |
| Analytics DB | `interactions.type` has a CHECK list that is missing `lens_*` and `ticket_*` (those inserts currently fail). Needs one migration. |

→ **Option D** from the brief: official deep links + honest "availability is checked in the official system", with the data architecture ready for an official feed.

## 2. Architecture

- **Routes:** `/hysa` (Albanian, default), `/hysa/de`, `/hysa/en` — one optional catch-all
  `app/hysa/[[...lang]]/page.tsx`, statically generated, `hreflang` alternates, canonical
  per language, SportsEvent JSON-LD (no price/offer claims), OG image from `/api/og/hysa`.
- **Content:** `lib/hysa/event.ts` (facts + sources + official URL) and `lib/hysa/copy.ts`
  (sq/de/en copy). Server-rendered; small client islands only (countdown, share,
  tracking, sticky CTA, availability status).
- **Availability:** `GET /api/events/kabayel-hysa/availability` returns the normalized
  shape from the brief. Source = an **official JSON feed** if `HYSA_AVAILABILITY_FEED_URL`
  is ever configured (5 s timeout, 60 s cache, stale flag + timestamp); otherwise
  `status: "not_configured"`. The UI never calls anything "live" unless the feed is live.
- **Map:** AlbaGo's own stadium drawing with the Nord-Tribüne highlighted (no copied
  artwork) + "Open the live seat map" CTA to the official channel.
- **Analytics:** new types `page_view, ticket_category_view, ticket_category_click,
  official_shop_click, seat_map_click, language_changed, share_whatsapp,
  share_facebook, share_copy_link, group_ticket_click`; `metadata` carries
  `campaign: 'hysa'`, `lang`, `category`, `utm_content`. Admin dashboard at `/admin/hysa`:
  unique visitors, languages, ticket clicks, CTR, categories, sources, daily trend.
- **Mobile:** bottom nav hidden on `/hysa*`; sticky "🎟️ SHIKO BILETAT" bar instead.

## 3. SQL (apply after a one-line yes)

Recreate `interactions_type_check` with every type the app sends (existing values kept so
old rows stay valid) + the new Hysa types.

## 4. Open questions for the user

1. Confirm the Nord-Tribüne / Innenraum mapping is right for the whole Hysa channel.
2. Official prices per category (with a check date) if they should be shown.
3. Whether `/hysa` should mention AlbaGo's own seat sale (currently: no — different message).
