# 5. Feature Brainstorm — 312 ideas, scored

Scoring: **U** user value · **O** organizer value · **D** implementation difficulty (L = easy) · **Q** uniqueness · **S** scalability · **E** competitive edge. H/M/L. Ideas are deliberately unconstrained; sequencing lives in §13, not here.

## Top 25 overall (impact ÷ effort, strategy-weighted)

1. Event view/save/share tracking (`event_views`) — the measurement substrate (Analytics #1)
2. Follow organizers/communities/cities + notification fan-out (Social #1)
3. Dual-city home: "where I live" + "back home" rails (Discovery #4)
4. Albanian i18n completion — sq as first language (Mobile/Growth prerequisite)
5. Web-push notifications: new protest / followed-organizer event (Mobile #2)
6. "I'm going" RSVP-lite with guest count, civic-first rollout (Events #1)
7. iCal/Google Calendar add + subscribable city/community calendars (Events #3)
8. Organizer analytics dashboard: views, saves, shares over time (Organizers #1)
9. One-page 60-second event creation (Luma-style) alongside the wizard (Organizers #2)
10. Community pages: profile, members, events, photo wall (Communities #1)
11. Concierge venue seeding: 50 real Tirana venues with photos (Trust/supply op, not code)
12. Weekly digest email per city ("This week in Tirana / your saved cities") (Growth #2)
13. Follow Albanian artists → notified when they play your diaspora city (Social #3)
14. WhatsApp-native share flows: card + deep link everywhere (Sharing #1)
15. SSR /events + generated OG images for banner-less events (Discovery #16)
16. "Happening now / tonight near me" geolocated homepage default (Discovery #1)
17. Organizer share-pack auto-generation on publish (poster+story+reel+caption) (Sharing #3)
18. Event reminder emails/push: 24h + 2h before saved/RSVP'd events (Events #5)
19. Post-event photo walls for every event (Pankartat generalized) (Social #6)
20. Public organizer profiles with follower counts + next-event CTA (Organizers #4)
21. Protest alert subscriptions per city (Civic, inside Events group)
22. Search v2: typo-tolerant, Albanian/English synonyms, semantic ("live music tonight") (Discovery #7)
23. Trip mode for diaspora summer: date-range itinerary from events list (Discovery #12)
24. Venue claim flow + venue dashboards (Organizers #13)
25. Referral loop: "invite 3 friends, unlock founder badge" for communities (Growth #6)

---

## A. Discovery (26)

| # | Idea | U | O | D | Q | S | E |
|---|---|---|---|---|---|---|---|
| 1 | "Tonight near me" geolocated default view | H | H | L | M | H | M |
| 2 | Personalized feed: saved categories + followed entities first | H | H | M | M | H | M |
| 3 | Curated collections ("Riviera Nights", "Free this weekend") | H | M | L | M | M | M |
| 4 | Dual-city home for diaspora (residence + hometown rails) | H | M | M | H | H | H |
| 5 | "Surprise me" — one random great event for tonight | M | M | L | M | H | L |
| 6 | Trending events (velocity of views/saves) | H | H | M | M | H | M |
| 7 | Search v2: typo tolerance, sq/en synonyms, semantic intent | H | M | M | M | H | M |
| 8 | Saved searches with alerts ("techno in Tirana") | M | M | M | M | H | M |
| 9 | Category landing pages with SEO copy (/events/nightlife-tirana) | M | M | L | L | H | M |
| 10 | Date-first browse: full-week calendar grid view | M | M | M | L | H | L |
| 11 | Price filter incl. "Free only" | H | M | L | L | H | L |
| 12 | Trip mode: date-range planner for visits home | H | M | M | H | H | H |
| 13 | "Because you saved X" recommendation rows | M | M | M | L | H | L |
| 14 | Weekend digest page (/weekend) — shareable editorial URL | M | M | L | M | H | M |
| 15 | Nearby-city fallback when your city is empty | M | M | L | M | H | M |
| 16 | SSR events list + generated OG images for banner-less events | H | H | M | L | H | M |
| 17 | Landing pages per diaspora city ("Albanian events in London") | H | M | L | H | H | H |
| 18 | Festival/multi-day event grouping UI | M | H | M | M | H | M |
| 19 | Artist pages: events by performer | H | H | M | M | H | M |
| 20 | "Last chance" rail — events ending/selling soon | M | H | L | M | H | M |
| 21 | Audio/vibe previews on event cards (organizer-uploaded clip) | M | M | M | H | M | M |
| 22 | Recently viewed + continue-browsing memory | M | L | L | L | H | L |
| 23 | Editor's picks with human blurbs (founder-curated weekly) | H | H | L | M | L→M | M |
| 24 | Multi-city browse for touring events ("also in Prishtina") | M | H | M | M | H | M |
| 25 | Occasion search: "birthday", "first date", "with kids" | M | M | M | M | H | M |
| 26 | Live "what's busy right now" nightlife heat view | H | H | H | H | M | H |

## B. Events (26)

| # | Idea | U | O | D | Q | S | E |
|---|---|---|---|---|---|---|---|
| 1 | RSVP-lite "I'm going / Interested" + guest count | H | H | M | L | H | M |
| 2 | Guest list visibility (opt-in, friends-first) | H | H | M | M | H | M |
| 3 | Add-to-calendar (iCal/Google) on every event | H | H | L | L | H | M |
| 4 | Subscribable calendars: city, community, organizer feeds | H | H | M | H | H | H |
| 5 | Reminders: 24h/2h push+email for saved/going events | H | H | M | L | H | M |
| 6 | Waitlists for capacity events | M | H | M | M | H | M |
| 7 | Event updates feed ("venue changed") w/ notify — extend existing saved-changed email | H | H | L | M | H | M |
| 8 | Event Q&A (attendees ask, organizer answers) | M | H | M | M | H | M |
| 9 | Lineups: multiple artists with times per event | M | H | M | M | H | M |
| 10 | Ticket price tiers display (early bird/door) pre-ticketing | M | H | L | L | H | L |
| 11 | Post-event state: photos, recap, "next edition" CTA | H | H | M | H | H | H |
| 12 | Series pages: recurring event history + subscribe | M | H | M | M | H | M |
| 13 | Weather panel on outdoor events | M | M | L | M | H | L |
| 14 | "Bring friends" group RSVP (+3 guests) | M | H | L | M | H | M |
| 15 | Door info: dress code, age limit, entry rules | H | H | L | L | H | L |
| 16 | Live event mode: during-event page state (schedule, announcements) | M | H | H | H | M | M |
| 17 | Protest alert subscription per city (civic-critical) | H | H | M | H | H | H |
| 18 | Safety check-in for protests (aggregate-only, no individual tracking) | H | M | H | H | M | H |
| 19 | Multi-language event descriptions (sq + en + de side by side) | H | H | M | H | H | H |
| 20 | Duplicate-event detection at submission | M | H | M | M | H | L |
| 21 | Cancelled/postponed states with auto-notify (schema has states; wire UX) | H | H | L | L | H | M |
| 22 | Cross-post: organizer pushes one event to FB/IG via share pack | M | H | L | M | H | M |
| 23 | Accessibility info fields (wheelchair, parking, quiet room) | M | M | L | M | H | M |
| 24 | On-this-day / anniversary civic commemorations | M | L | L | H | M | H |
| 25 | Attendance verification ("was there" badge via geofenced check-in) | M | H | H | H | M | M |
| 26 | Private/unlisted events (link-only) — Partiful territory | M | H | M | M | H | M |

## C. Organizers (26)

| # | Idea | U | O | D | Q | S | E |
|---|---|---|---|---|---|---|---|
| 1 | Analytics: views/saves/shares/RSVPs over time, per event | M | H | M | L | H | M |
| 2 | One-page 60-second event creation (Luma bar) | M | H | M | L | H | M |
| 3 | Audience CRM: followers, RSVP history, export | M | H | M | M | H | H |
| 4 | Public organizer profiles: follower count, past events, next-event CTA | H | H | L | L | H | M |
| 5 | Auto-generated share pack on publish (poster/story/reel/caption) | M | H | L | H | H | H |
| 6 | Announcement blasts to followers (rate-limited) | H | H | M | M | H | M |
| 7 | Event duplication / templates ("same as last month") | L | H | L | L | H | L |
| 8 | Co-organizers & team roles | L | H | M | L | H | L |
| 9 | Demographic insights (age/city aggregates, privacy-safe) | L | H | M | M | H | M |
| 10 | Benchmarks: "your event vs category average in Tirana" | L | H | M | H | H | H |
| 11 | Best-time-to-post suggestions from platform data | L | M | M | M | H | M |
| 12 | Organizer academy: playbooks in Albanian (content, not code) | L | H | L | M | M | M |
| 13 | Venue claim flow + venue dashboard (owner_user_id reserved in schema) | M | H | M | M | H | M |
| 14 | Venue availability calendar → organizers find venues in-app | M | H | H | H | M | H |
| 15 | Door check-in app mode (guest list on phone, mark arrived) | M | H | M | M | H | M |
| 16 | Post-event report card (attendance, reach, growth, shareable) | L | H | M | M | H | M |
| 17 | Sponsor marketplace: businesses browse sponsorable events | L | H | H | H | M | H |
| 18 | Payout-ready profile (Stripe Connect onboarding, pre-ticketing) | L | H | M | L | H | L |
| 19 | Embeddable widgets: "Upcoming events" iframe for org websites | M | H | L | M | H | M |
| 20 | API access for power organizers/festivals | L | M | M | L | H | L |
| 21 | Volunteer management: recruit from /volunteer pool per event | M | H | M | H | M | H |
| 22 | Organizer verification fast-track w/ ID (paid tier candidate) | L | M | M | L | H | L |
| 23 | Collab events between organizers/communities (shared billing) | M | H | M | M | H | M |
| 24 | Feedback collection: post-event survey to attendees | M | H | M | L | H | M |
| 25 | Promo codes / guest-list passes (pre-ticketing utility) | M | H | M | L | H | L |
| 26 | Migration importer: paste FB event URL → prefilled AlbaGo event | M | H | M | H | H | H |

## D. Maps (24)

| # | Idea | U | O | D | Q | S | E |
|---|---|---|---|---|---|---|---|
| 1 | Marker clustering at low zoom | H | M | L | L | H | L |
| 2 | Civic vs venue vs event marker visual distinction | H | M | L | L | H | L |
| 3 | Time scrubber: map shows events at chosen hour/day | H | M | M | H | H | H |
| 4 | "Near me now" locate button + radius filter | H | M | L | L | H | L |
| 5 | Protest route/meeting-point drawing (polyline on civic events) | H | H | M | H | H | H |
| 6 | Heatmap of tonight's activity per neighborhood | M | M | M | H | H | M |
| 7 | Walking-distance isochrone ("what's within 15 min") | M | L | M | H | H | M |
| 8 | Offline map tiles for protest days (network congestion) | M | M | H | H | M | H |
| 9 | Diaspora world map: Albanian events across the globe | H | M | M | H | H | H |
| 10 | Venue detail bottom sheet with tonight's lineup | H | H | M | L | H | M |
| 11 | Directions handoff incl. public transport deep links | M | L | L | L | H | L |
| 12 | Saved places layer ("my spots") | M | L | M | L | H | L |
| 13 | City switch with map fly-to (exists; add country-level view) | M | L | L | L | H | L |
| 14 | Live friend beacons at events (opt-in, ephemeral) | M | M | H | H | M | M |
| 15 | AR view: point phone down street, see venue events (long-term) | M | M | H | H | M | M |
| 16 | Beach/coastline zones as first-class map areas (Riviera) | H | M | M | H | H | H |
| 17 | Map-drawn search area (draw a polygon, filter inside) | L | L | M | M | H | L |
| 18 | Street-closure/safety overlays on protest days | H | M | H | H | M | H |
| 19 | Multi-stop night planner: chain 3 events into a route | M | M | H | H | M | M |
| 20 | Light-mode map tile style swap (known gap) | M | L | L | L | H | L |
| 21 | Venue photos in map popups | M | M | L | L | H | L |
| 22 | Density-based "hot right now" pulsing markers | M | M | M | H | M | M |
| 23 | Tourist layer: landmarks + tonight's events combined view | M | M | M | M | H | M |
| 24 | Country picker persistence (?country= URL — known backlog item) | L | L | L | L | H | L |

## E. AI (24)

| # | Idea | U | O | D | Q | S | E |
|---|---|---|---|---|---|---|---|
| 1 | Natural-language search ("free live music near Blloku tonight") | H | M | M | M | H | M |
| 2 | AI concierge chat: "plan my Saturday in Tirana" | H | M | M | M | H | M |
| 3 | Auto-categorize + tag submitted events | M | H | L | L | H | L |
| 4 | Description writer for organizers (sq + en from bullet points) | M | H | L | L | H | M |
| 5 | Auto-translate every event sq↔en↔de↔it at publish | H | H | M | H | H | H |
| 6 | Poster→event: photo of a street poster becomes a draft event | H | H | M | H | H | H |
| 7 | FB/IG event URL → parsed AlbaGo draft (import agent) | M | H | M | H | H | H |
| 8 | Duplicate/scam event detection at moderation | M | H | M | M | H | M |
| 9 | Weekly AI-curated city digest (auto-editorial) | H | M | M | M | H | M |
| 10 | Personal taste model: "your kind of night" score per event | H | M | H | M | H | M |
| 11 | Attendance forecasting for organizers | L | H | H | H | H | H |
| 12 | Smart pricing suggestions (when ticketing exists) | L | H | H | M | H | M |
| 13 | AI banner generation for events without images (brand-consistent) | H | H | M | H | H | H |
| 14 | Auto-Reel: AI assembles event recap video from photo wall | H | H | H | H | M | H |
| 15 | Voice interface in Albanian ("çfarë ka sonte?") | M | L | H | H | M | H |
| 16 | Moderation copilot: flag policy violations w/ reasons for admin | M | M | M | L | H | L |
| 17 | Trend detection: rising artists/venues/categories per city | M | H | H | M | H | M |
| 18 | Semantic dedup of venues (fuzzy match on claim/import) | L | M | M | L | H | L |
| 19 | AI itinerary for tourists: multi-day plan from dates + vibe | H | M | M | M | H | M |
| 20 | Group decision bot: paste to WhatsApp group, friends vote on tonight's plan | H | M | H | H | M | H |
| 21 | Civic-safe summarizer: neutral protest summaries for press page | M | L | M | H | M | H |
| 22 | Photo quality scoring/enhancement on uploads | M | M | M | L | H | L |
| 23 | Alt-text + accessibility generation for all images | M | L | L | L | H | L |
| 24 | Organizer copilot: "why did attendance drop?" narrative insights | L | H | H | H | H | H |

## F. Social (24)

| # | Idea | U | O | D | Q | S | E |
|---|---|---|---|---|---|---|---|
| 1 | Follow organizers/communities/artists/cities | H | H | M | L | H | H |
| 2 | Friends on AlbaGo: contact-book match, follow friends | H | M | M | L | H | M |
| 3 | Follow Albanian artists → tour alerts in diaspora cities | H | H | M | H | H | H |
| 4 | "Friends going" on event cards | H | H | M | L | H | M |
| 5 | Activity feed: what people you follow saved/attended | M | M | M | L | H | L |
| 6 | Per-event photo walls (Pankartat pattern generalized) | H | H | M | H | H | H |
| 7 | Profile pages: attended history, badges, placards | M | L | M | L | H | L |
| 8 | Crews: small friend groups that plan together | H | M | H | M | H | M |
| 9 | Event group chat (ephemeral, pre/during event) | M | M | H | M | M | M |
| 10 | Reactions on events (🔥 counts, lighter than RSVP) | M | M | L | L | H | L |
| 11 | Attendance badges (5 concerts, 3 protests, founder era) | M | L | L | M | H | M |
| 12 | Solidarity check-in: diaspora marks "with you from Berlin" on protests | H | L | L | H | H | H |
| 13 | Placard of the week / community spotlights | M | L | L | M | H | M |
| 14 | Invite friends to event via WhatsApp with personal note | H | H | L | L | H | M |
| 15 | Shared saved-lists ("our summer trip list") | M | L | M | M | H | M |
| 16 | Comments on events (moderated, org can disable) | M | M | M | L | H | L |
| 17 | User-generated city tips on venue pages | M | M | M | M | H | M |
| 18 | Memories: "one year ago you were at X" resurfacing | M | L | L | M | H | M |
| 19 | Polls by organizers ("which date works?") | M | H | M | M | H | M |
| 20 | Diaspora pen-pal / newcomer buddy matching per city | M | L | H | H | M | H |
| 21 | Live attendance counter on protest pages (aggregate) | H | M | M | H | M | H |
| 22 | Story-style ephemeral updates from organizers | M | H | H | M | M | M |
| 23 | Leaderboards: top placard photographers, most active cities | M | L | L | M | H | M |
| 24 | Verified public figures (artists, activists) with profiles | M | M | M | M | H | M |

## G. Communities (24)

| # | Idea | U | O | D | Q | S | E |
|---|---|---|---|---|---|---|---|
| 1 | Community pages: profile, members, events, wall | H | H | M | H | H | H |
| 2 | Membership: join/approve, member directory (privacy-tiered) | H | H | M | M | H | H |
| 3 | Community announcement feed → push/email to members | H | H | M | M | H | H |
| 4 | Community calendars (subscribable, embeddable) | H | H | M | M | H | H |
| 5 | Diaspora association onboarding kit (concierge + templates) | H | H | L | H | M | H |
| 6 | Community photo/history archive (institutional memory) | M | H | M | H | H | H |
| 7 | Volunteer pools per community (extends /volunteer) | M | H | M | H | H | H |
| 8 | Community-to-community federation (Munich hosts, Stuttgart's invited) | M | H | M | H | H | H |
| 9 | Dues/donations collection (later; trust-sensitive) | M | H | H | M | H | M |
| 10 | Language-school / kids-program listings under communities | H | H | L | H | M | H |
| 11 | "New in town" flow: arrive in Munich → find your people in 5 min | H | M | M | H | H | H |
| 12 | Community roles: board, editors, event managers | M | H | M | L | H | M |
| 13 | Inter-community events calendar (national holidays sync) | H | H | L | H | H | H |
| 14 | Community verification (registered association badge) | M | H | L | M | H | M |
| 15 | Discussion spaces (threads, not chat — durable) | M | M | H | M | M | M |
| 16 | Movement pages generalized: any civic cause gets /movements tooling | H | M | M | H | H | H |
| 17 | Local business directory per community (Albanian-owned in Berlin) | H | M | M | H | H | H |
| 18 | Mutual-aid board (rides to protests, housing for newcomers) | M | L | M | H | M | H |
| 19 | Community stats: members, cities, growth (public pride metrics) | M | M | L | M | H | M |
| 20 | Church/mosque/cultural-org event feeds (institution accounts) | M | H | L | M | H | M |
| 21 | Youth wing / sub-groups within communities | M | M | M | M | H | M |
| 22 | Community merch/fundraiser event type | M | H | M | M | H | M |
| 23 | Sister-city cultural exchange programs | L | M | M | H | M | M |
| 24 | Annual community report auto-generated (year in review) | M | H | M | H | H | M |

## H. Trust & Safety (20)

| # | Idea | U | O | D | Q | S | E |
|---|---|---|---|---|---|---|---|
| 1 | Venue seeding op: 50 verified Tirana venues (manual, this month) | H | H | L | L | L | M |
| 2 | Event verification badge (organizer tier surfaced on cards) | H | H | L | L | H | M |
| 3 | Report event/organizer (extend existing report pattern) | M | M | L | L | H | L |
| 4 | Moderation transparency page (counts, response times) | M | M | L | H | H | H |
| 5 | Civic data promise: public no-tracking pledge for protest surfaces | H | L | L | H | H | H |
| 6 | 2FA for admin (long-standing backlog) | L | L | M | L | H | L |
| 7 | Sentry + uptime monitoring (operational trust) | M | M | L | L | H | L |
| 8 | Scam-pattern library: block known fraud event shapes | M | M | M | M | H | M |
| 9 | Refund/dispute policy framework (pre-ticketing prep) | M | H | L | L | H | L |
| 10 | Age-gating for 18+ events | M | H | L | L | H | L |
| 11 | Identity verification for organizers (opt-in, badge) | M | H | M | M | H | M |
| 12 | Content policy in Albanian + English, human-readable | M | M | L | L | H | L |
| 13 | Anti-brigading protection on votes/reports | M | L | M | M | H | L |
| 14 | Account deletion self-serve (currently mailto) | M | L | M | L | H | L |
| 15 | Photo consent guidance on walls (faces at protests — real risk) | H | M | L | H | H | H |
| 16 | Blur-faces tool on placard/protest photo upload | H | L | M | H | H | H |
| 17 | Emergency info panel per city (exists as SafetyPanel; keep current) | H | L | L | H | H | H |
| 18 | Organizer no-show/cancellation accountability score (internal) | M | M | M | M | H | M |
| 19 | Legal-aid resource links for protest organizers | M | M | L | H | M | H |
| 20 | Data-residency/GDPR posture doc for DE/IT/UK expansion | L | M | M | L | H | L |

## I. Analytics (20)

| # | Idea | U | O | D | Q | S | E |
|---|---|---|---|---|---|---|---|
| 1 | `event_views` table + view tracking on detail pages | M | H | L | L | H | M |
| 2 | Save/share/RSVP event-level counters | M | H | L | L | H | M |
| 3 | Search-query logging → demand intelligence ("what people want but can't find") | M | H | L | M | H | H |
| 4 | Supply-gap dashboard: searched-but-empty categories/cities | L | H | M | H | H | H |
| 5 | Organizer dashboard sparklines fed by real data (components exist) | L | H | L | L | H | M |
| 6 | City health metrics: events/week, DAU, save rate per city | L | M | M | M | H | M |
| 7 | Funnel tracking: view→save→RSVP→attend | M | H | M | L | H | M |
| 8 | Share-destination analytics (which platform converts) | L | H | L | M | H | M |
| 9 | Cohort retention (weekly actives by signup week) | L | L | M | L | H | L |
| 10 | Notification performance (open/click per type) | L | M | M | L | H | L |
| 11 | Public platform stats page (/about live counters exist; expand) | M | M | L | M | H | M |
| 12 | Venue foot-traffic proxy (directions clicks, page views) | L | H | L | M | H | M |
| 13 | Civic reach reports for movements (aggregate, shareable) | M | M | M | H | M | H |
| 14 | A/B testing harness for key flows | L | L | M | L | H | L |
| 15 | SEO performance dashboard (query → landing → conversion) | L | M | M | L | H | L |
| 16 | Category trend reports per city, quarterly, public (PR asset) | M | M | M | H | M | H |
| 17 | Organizer audience-growth chart (followers over time) | L | H | L | L | H | M |
| 18 | Real-time ops dashboard for protest days (traffic, errors) | L | L | M | M | M | M |
| 19 | Data export for organizers (CSV of their events' stats) | L | H | L | L | H | L |
| 20 | Anonymized public API of event density (city-partnership asset) | L | M | M | H | M | H |

## J. Sharing (20)

| # | Idea | U | O | D | Q | S | E |
|---|---|---|---|---|---|---|---|
| 1 | WhatsApp-first share: rich card + deep link on every surface | H | H | L | M | H | H |
| 2 | Telegram channel auto-post bot per city (civic + weekly digest) | H | M | M | H | H | H |
| 3 | Auto share-pack for organizers at publish (see C5) | M | H | L | H | H | H |
| 4 | Per-category poster visual variants (backlog item; fuchsia nightlife etc.) | M | H | L | M | H | M |
| 5 | Instagram Story deep-link stickers workflow | H | H | M | M | H | M |
| 6 | Personal invite cards ("Erisa invited you") with attribution | H | M | M | M | H | M |
| 7 | QR posters for print (A4 PDF export per event/venue) | M | H | L | M | H | M |
| 8 | Share-to-earn: unlock founder badge after N converted invites | M | M | M | M | H | M |
| 9 | Embeddable event cards for blogs/news sites | M | M | L | M | H | M |
| 10 | Reel export verification + per-event auto-reel (exists; verify/extend) | H | H | L | H | H | H |
| 11 | Countdown stickers/widgets for stories | M | M | M | M | H | M |
| 12 | "Send to a friend who needs a night out" playful flows | M | L | L | M | H | L |
| 13 | Group-chat poll link: friends vote between 3 events | H | M | M | H | M | H |
| 14 | Post-attendance share: "I was there" branded photo frame | M | M | L | M | H | M |
| 15 | Press embed kit: live-updating protest stats widget for media | M | L | M | H | M | H |
| 16 | Calendar-file share (.ics attachments in all emails) | M | M | L | L | H | L |
| 17 | Deep links that survive app-less phones (PWA + web fallback) | H | M | L | L | H | M |
| 18 | Share analytics surfaced to sharer ("your share got 12 taps") | M | M | M | H | H | M |
| 19 | Co-branded posters for verified communities (logo + AlbaGo) | M | H | L | M | H | M |
| 20 | Print-ready placard PDF from Pankartat photos (protest kit) | M | L | L | H | M | H |

## K. Mobile (20)

| # | Idea | U | O | D | Q | S | E |
|---|---|---|---|---|---|---|---|
| 1 | Web-push notifications (protest alerts, follows, reminders) | H | H | M | L | H | H |
| 2 | Smart install prompt (2nd visit, post-save moment) | M | M | L | L | H | L |
| 3 | Offline event pages (saved events cached) | M | L | M | M | H | M |
| 4 | Home-screen widgets via PWA (tonight's picks) | M | L | H | M | M | M |
| 5 | Native app (Expo/React Native) when push reliability demands | H | H | H | L | H | M |
| 6 | Location permission flow with clear value exchange | M | L | L | L | H | L |
| 7 | One-handed bottom-sheet navigation everywhere | M | L | M | L | H | L |
| 8 | Ticket/QR wallet (post-ticketing; Apple/Google Wallet passes) | H | H | M | L | H | M |
| 9 | Haptics + micro-interactions on save/RSVP | L | L | L | L | H | L |
| 10 | Data-saver mode (low-image variant for weak networks) | M | L | M | M | H | M |
| 11 | Share-sheet integration (native share targets) | M | M | L | L | H | L |
| 12 | Camera-first placard upload flow (one tap from wall) | M | L | L | M | H | M |
| 13 | SMS fallback notifications for feature-phone reach | M | L | M | H | M | M |
| 14 | Live Activities / dynamic island for event countdowns (native, later) | M | L | H | H | M | M |
| 15 | App shortcuts (long-press icon → Tonight / Protests / Map) — manifest has 3; maintain | L | L | L | L | H | L |
| 16 | Biometric quick-auth for return sessions | L | L | M | L | H | L |
| 17 | Background location "entering event area" check-in prompt (opt-in) | M | M | H | M | M | M |
| 18 | Progressive image loading + skeleton polish on 3G | M | L | L | L | H | L |
| 19 | Voice search in Albanian (mobile mic button) | M | L | H | H | M | H |
| 20 | Per-city app icon badges (unread events count) | L | L | H | M | M | L |

## L. Growth (20)

| # | Idea | U | O | D | Q | S | E |
|---|---|---|---|---|---|---|---|
| 1 | SEO city/category landing-page matrix (programmatic, sq/en/de/it) | H | M | M | M | H | H |
| 2 | Weekly city digest email ("This week in Tirana") | H | M | M | L | H | M |
| 3 | Concierge organizer onboarding: 20 real organizers, white-glove | H | H | L | M | L | H |
| 4 | FB event import tool for organizers (C26) as growth wedge | M | H | M | H | H | H |
| 5 | Diaspora WhatsApp/Telegram group partnerships (BD, not code) | H | M | L | H | M | H |
| 6 | Referral: founder badges, early-supporter identity | M | M | M | M | H | M |
| 7 | Campus ambassadors (University of Tirana + diaspora unions) | M | M | L | M | M | M |
| 8 | Artist partnerships: Albanian musicians premiere tour dates on AlbaGo | H | H | L | H | M | H |
| 9 | Press strategy: quarterly "state of Albanian events" data reports | M | M | L | H | M | H |
| 10 | Google Search Console + rich-results monitoring (submit sitemap — STILL PENDING) | M | M | L | L | H | L |
| 11 | Co-marketing with tourism boards (Riviera summer guides) | M | M | L | M | M | M |
| 12 | Empty-state conversion: "no events in your city? bring AlbaGo" waitlist per city | M | M | L | M | H | M |
| 13 | Organizer case studies in Albanian (social proof content) | L | H | L | M | M | M |
| 14 | Event-page CTAs for attendees→organizers ("run your own event") | M | M | L | L | H | L |
| 15 | TikTok/IG content engine from platform data ("5 things in Tirana this weekend") | H | M | L | M | M | M |
| 16 | Cross-promotion slots between organizers (you promote me, I promote you) | L | H | M | H | H | M |
| 17 | Milestone PR moments (10k users, 1000th event — public counters) | M | L | L | M | M | L |
| 18 | Localized launch playbook doc (repeatable per city — see §09) | M | M | L | M | H | H |
| 19 | Wikipedia/Wikidata presence for brand + JSON-LD knowledge graph | L | L | L | L | H | L |
| 20 | Freemium API for Albanian media sites (event widgets with backlinks) | M | M | M | H | H | H |

## M. Monetization (18)

| # | Idea | U | O | D | Q | S | E |
|---|---|---|---|---|---|---|---|
| 1 | Ticketing with 3–5% fee (undercut Eventbrite; Stripe Connect) | H | H | H | L | H | H |
| 2 | Featured event slots (transparent "Promoted" label) | M | H | M | L | H | M |
| 3 | Venue Pro subscription (page analytics, featured placement, photos) | M | H | M | L | H | M |
| 4 | Organizer Pro (advanced analytics, blasts, CRM export, priority review) | L | H | M | L | H | M |
| 5 | Diaspora business directory listings (Albanian-owned businesses) | M | M | M | H | H | H |
| 6 | Category sponsorships ("Sports presented by X" — never civic) | L | M | L | L | H | L |
| 7 | Tourism partnerships: hotel/experience affiliate links on trip mode | M | L | M | M | H | M |
| 8 | Payment processing for community dues/donations (small fee) | M | H | H | M | H | M |
| 9 | White-label platform for other diasporas (year 3 — "AlbaGo for X") | L | L | H | H | H | H |
| 10 | Data/insights reports for brands & municipalities (aggregate only) | L | M | M | M | H | M |
| 11 | Waived-fee free events forever (loss-leader policy, stated publicly) | H | H | L | M | H | H |
| 12 | Event insurance / weather-refund partnerships (later) | M | M | H | M | M | L |
| 13 | Premium consumer tier (early access to hot tickets; only at scale) | M | M | M | L | H | L |
| 14 | Merch platform for communities/movements (print-on-demand cut) | M | M | M | H | M | M |
| 15 | Job board for event industry (venues hiring staff) | L | M | M | M | M | L |
| 16 | Boosted diaspora reach (organizer pays to notify a second city) | L | H | M | H | H | H |
| 17 | Payment-free pledge for civic — permanent, marketed as principle | H | L | L | H | H | H |
| 18 | Google/Apple wallet pass branding for venues (Pro feature) | L | M | M | M | H | L |

---

## How to read this list

- **Build now** = anything in Top 25 that is also L/M difficulty.
- **The compounding cluster:** A4 dual-city + F1 follows + K1 push + B4 calendars + G1 communities. These five interlock into the diaspora moat; each makes the others stronger.
- **Deliberately deferred:** all of M (except the free-civic pledge, which is a positioning move, not code), most of E (AI needs data volume first), native apps, and anything requiring supply density the platform doesn't have (guest lists, heatmaps, live modes).
