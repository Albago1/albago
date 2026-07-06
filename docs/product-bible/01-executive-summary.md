# 1. Executive Summary

## What AlbaGo currently is

A technically excellent, visually distinctive (flame-red / ink-black / Instrument Serif "cinematic" brand) event platform with two personalities sharing one codebase:

1. **A discovery platform** for nightlife, music, culture, food, and sports events in Albania and the Balkans — Airbnb/Fever-grade UI, filterable events list, MapLibre map, venue pages, save buttons, an 8-step community submission wizard, and a full organizer pipeline (onboarding → draft → review → publish, with three verification tiers and RPC-enforced state machine).
2. **The digital home of the 2026 Albanian civic movement** — /protests with live countdowns, /movements pages, the Pankartat protest-photo wall (upload, vote, report, moderate), /volunteer signups, and a genuinely sophisticated share system (branded Story/Square/Facebook posters, QR codes, 15/30-second Reel video export, admin batch-ZIP for social teams).

The engineering is ahead of the business. Security (4-layer RLS model), SEO (JSON-LD, dynamic sitemap, OG images), moderation (rate limits, reports, admin queue), and trust surfaces (about/faq/press/legal) are all built to a standard most seed-stage startups never reach. What doesn't exist: users, supply, analytics, revenue, and a decided identity.

## What AlbaGo could become

**The operating system for a nation and its diaspora.** Not "Eventbrite for Albania" — that's a feature, not a company. The end-state:

- **Phase 1 (now):** The place Albanians worldwide check what's happening — protests today, concerts tomorrow. The civic moment is the beachhead; it created real traffic, real emotion, and real distribution (diaspora WhatsApp/Telegram groups already share AlbaGo posters).
- **Phase 2:** The community infrastructure for Albanians abroad — every Albanian association in Munich, London, NYC, Zurich runs its events, members, and communication through AlbaGo. Diaspora communities are starving for this; Facebook Groups is where they currently rot.
- **Phase 3:** The general local-discovery + ticketing platform for Albania and the Balkans — tourists, locals, venues, ticket sales — with the diaspora graph as the unfair distribution advantage no incumbent has.
- **Phase 4:** The playbook repeated for other diaspora nations (Kosovo is free; then Balkan neighbors; then any high-diaspora country). "AlbaGo for X" is a repeatable model.

## Biggest strengths

1. **The civic wedge is real and rare.** 84 events, a photo wall people emotionally contribute to, and a moment in history. Most platforms would pay millions for this kind of authentic launch energy. It gives AlbaGo something Eventbrite can never buy: *meaning*.
2. **Diaspora-first is an unowned market.** No global player models "a people and its diaspora" as one graph. The share-poster system, bilingual captions, and city list (Tirana next to Berlin next to Online) already point at it half-consciously.
3. **Engineering quality.** State-machine event lifecycle, RLS as final boundary, permanent slugs, audit-trail submissions, rate limits — this foundation can carry ticketing and payments without a rewrite.
4. **Brand.** The cinematic flame identity is distinctive, emotional, and consistent — most event sites look like SaaS dashboards; AlbaGo looks like a movie.
5. **Founder velocity.** The commit history shows a shipping cadence (5 approved feature commits in one day) that most funded teams don't match.

## Biggest weaknesses

1. **No supply.** The marketplace has one side, and even that side (civic) is a single movement. Non-civic events are near zero; venues table is essentially empty. Every discovery feature is a beautiful shop window on an empty store.
2. **No measurement.** Zero view tracking. Nobody knows how many people looked at any event, what converts, where users drop. Product decisions are being made on aesthetics and instinct.
3. **English-first UI for an Albanian audience.** 10 of 73 components use `t()`. The AL toggle produces a half-translated site. For the stated core user, this reads as "not for us."
4. **Identity split.** "Nightlife platform" and "revolution hub" confuse each other on the homepage and nav. A clubber lands on protest banners; an activist lands between cocktail listings. Neither feels fully served.
5. **No retention mechanism.** No follows, no notifications (beyond saved-event-changed emails), no reason to return except memory. Traffic spikes with protests, then evaporates.
6. **Bus factor of one**, no tests, no CI, secrets loose in the repo root (`ID_Resend.txt`, still there today).

## Biggest opportunities

1. **Own the diaspora before anyone realizes it's a market.** ~1.5–2M Albanians abroad; every one has a phone, homesickness, and a community group chat. Winner-take-most network effects apply per-community.
2. **Organizer analytics as the supply magnet.** "We help your event succeed" (views, saves, shares, per-city breakdowns) beats "we list your event." The Sparkline components already exist; the tracking table doesn't.
3. **Ticketing/RSVP as the eventual revenue engine** — but only after supply. The schema already reserves for it (Phase 7E: event_tickets, ticket_purchases, Stripe Connect).
4. **The civic → community pipeline.** Every protest attendee is a future community-event attendee. Every protest organizer is a future community organizer. Nobody else can convert this funnel because nobody else has the civic side.
5. **Tourism upside.** Albania's tourism is booming (10M+ visitors/yr). "What's on tonight in Saranda" in English/German/Italian is an SEO goldmine with almost no local competition.

## Biggest risks

1. **The movement fades and takes the traffic with it.** If AlbaGo's only demand engine is protest news, the platform's fate is chained to a news cycle it doesn't control. **Mitigation:** convert civic users to community/event users *now*, while they're here.
2. **Political capture / perception of partisanship.** Being "the revolution's platform" is powerful and dangerous. One partisan misstep and half the market is gone, plus possible legal/political pressure. **Mitigation:** platform-neutral framing ("civic infrastructure, all peaceful movements welcome"), scrupulous moderation records, civic never monetized.
3. **Marketplace cold-start death.** The classic: visitors find nothing → don't return → organizers see no visitors → don't post. **Mitigation:** manual supply seeding (concierge onboarding of 20 real organizers), aggregation/import of public events, one city at a time (Tirana only until it's dense).
4. **Solo-founder fragility.** No tests, no CI, no monitoring, secrets in the tree. One bad deploy during a protest weekend = trust destroyed at the worst moment.
5. **Facebook inertia.** Albanian event life runs on Instagram stories and Facebook events. The competitor isn't Eventbrite — it's *good enough, already installed*. AlbaGo must be 10x on something specific (diaspora reach + beautiful shareables + one-place-for-everything), not 1.2x on everything.
6. **Premature internationalization.** Five countries before one dense city is how platforms die politely. (See §09 for the honest sequencing.)

## The three decisions that matter most (CPO calls)

1. **Declare the identity: "AlbaGo — çfarë po ndodh" (what's happening) for Albanians everywhere.** Civic and cultural are both *what's happening* — unify under discovery-of-what-matters, with clear mode separation in nav (see §12). Stop being embarrassed that protests and parties share a platform; that IS the platform — life of a people.
2. **Freeze net-new surfaces; open the supply war.** Next 90 days = organizer acquisition (20 real organizers, 100 real events in Tirana + 3 diaspora cities), i18n sweep, and analytics plumbing. Nothing else.
3. **Instrument everything this week.** `event_views` table + save/share tracking. Every future section of this bible assumes measurement exists.
