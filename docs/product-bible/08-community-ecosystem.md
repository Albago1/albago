# 8. Community Ecosystem — infrastructure for a people, not just its events

## The reframe

Events are moments; communities are institutions. An event platform gets opened when there's an event. Community infrastructure gets opened because *that's where my people are*. The strategic move is to make AlbaGo the digital layer under Albanian collective life — of which events are the most visible output, not the product itself.

The civic movement already proved the thesis: /protests, Pankartat, and /volunteer aren't event features — they're *community* features (shared identity, contribution, coordination) that happen to orbit events. The task is to generalize what the movement built.

## Why communities are the durable layer

1. **Retention:** a user who joined "Albanians in Munich" has a permanent reason to return; a user who attended a concert doesn't.
2. **Supply:** communities are pre-organized supply — one association = a calendar of events, a volunteer pool, a photo archive, hundreds of members.
3. **Defensibility:** event listings are copyable; a community's membership graph, history, and archive are not. Facebook Groups' switching cost is what keeps them there despite the product decaying — take exactly that hostage-value, but earned with a better product.
4. **The movement's afterlife:** whatever happens politically, the energy needs somewhere to live. Communities are where civic identity converts into permanent presence.

## The community object (product spec, first principles)

A **Community** on AlbaGo:

- **Identity:** name, city (or "worldwide"), logo, bio, verification badge (registered-association check), founded date, languages.
- **People:** members (join / request-join), roles (board, editors, event managers), member directory with privacy tiers (public count, members-only list).
- **Voice:** announcement feed → fan-out to members via push/email (the Facebook-Groups-killer feature: 100% reach of your own members, permanently free).
- **Calendar:** community events (created by its editors through the existing organizer machinery — a community is technically an organizer with members), subscribable .ics feed, embeddable widget for their website.
- **Memory:** photo wall per community and per event (Pankartat pattern), pinned history ("founded 1994, 30 years of Flag Day celebrations"), annual auto-generated year-in-review.
- **Coordination:** volunteer pool (extends the existing /volunteer signups), simple threads (durable discussions, not chat — chat stays in WhatsApp, and that's fine; AlbaGo is the town square, WhatsApp is the kitchen).

Schema note: this composes cleanly with what exists — `communities` (like `organizers` but 1:many members), `community_members` (like `saved_events` RLS shape), announcements table, and `events.community_id` nullable FK following the `organizer_id` pattern. No architectural violence needed.

## The three community archetypes to win, in order

1. **Diaspora associations** (Munich, Zurich, London, NYC, Milan…): volunteer-run, Facebook-trapped, starving for legitimacy and youth reach. Concierge-onboard them like organizers — one association at a time, starting with the ones already organizing solidarity protests (warm list from the civic side!). Their killer features: member notify, RSVP headcounts for hall rentals, bilingual pages, kids-program listings.
2. **Scenes** (Tirana techno, poetry, hiking, gaming): informal, taste-driven, currently just Instagram accounts. Their killer features: follower graph, photo walls, collab events. A "scene" is a community with a lighter membrane — same object, join = follow.
3. **Movements** (civic): already built at /movements. Generalize so any peaceful movement gets the toolkit (events, placard wall, volunteers, alerts) without hand-built pages like edi-rama-berlin-2026. The movement IS a community with `type = 'movement'`.

## The "new in town" moment (the wedge use case)

The single most emotionally resonant community feature: an Albanian lands in a new city (study, work, migration). Today: they ask cousins, search Facebook for hours, feel alone for months. AlbaGo end-state: open app → set city to Vienna → "Your people in Vienna": the association, the student club, this month's events, the Albanian-owned café map, a "say hello" thread. **Five minutes from alone to connected.** This is the story diaspora media will write about, the feature parents tell their emigrating kids about, and the growth loop (§6, Loop 7) in human form.

## What AlbaGo must NOT become

- **Not a social network.** No general feed, no infinite scroll, no engagement farming. Communities coordinate real-world gathering; the success metric is *people in rooms*, not time-on-app.
- **Not a chat app.** WhatsApp won; integrate with it (share cards, invite links), don't fight it.
- **Not a political party's tool.** Movements get infrastructure under the same neutral terms as folklore-dance associations. Neutrality of the *platform* is what makes hosting movements possible at all.

## Sequencing

Communities ship *after* follows/notifications exist (a community without notify is a dead page) and *alongside* the diaspora push — realistically month 5–8 in §13. Until then, the concierge move: onboard associations as *organizers* now, with a "community page coming" promise, so their events and audiences are already in the system when the object launches.

## Success metrics

- Communities activated (≥1 event or announcement in 30 days) — target 50 by month 12.
- Members reachable (total community members with notifications on).
- The conversion that proves the thesis: % of civic-era users who belong to ≥1 community a year later.
- Rooms filled: RSVPs to community events (the real-world outcome).
