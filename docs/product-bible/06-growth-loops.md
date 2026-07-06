# 6. Growth Loops

Loops, not funnels. A funnel spends; a loop compounds. Ranked by expected compounding power for AlbaGo specifically. Each loop: mechanism → why it works → trigger → how it scales → current status.

## Loop 1 — The Shareable Artifact Loop (already half-built, highest leverage)

**Mechanism:** Event exists → AlbaGo generates a beautiful branded poster/story/reel → organizer or attendee shares it to WhatsApp/Instagram/Telegram → viewer taps through to the event page → saves/RSVPs → shares again (and some become organizers).
**Why it works:** Albanian social life runs on WhatsApp groups and IG stories. The artifact carries the brand (flame wordmark, QR) into closed networks that ads can't reach. The share system (Story/Square/FB templates, Reel export, captions) is already better than anything competitors offer — it's currently just underexposed.
**Trigger:** publish moment (organizer), emotional moment (protest announcement, placard upload), FOMO moment (attendee at event).
**Scales by:** every new event mints new artifacts; artifact quality is constant regardless of catalog size; per-category visual variants and per-community co-branding increase share rates.
**Status:** Templates ✅, Reel ✅, one-tap share from event page ✅. Missing: auto-pack on organizer publish, share-click analytics, WhatsApp-optimized card, attendee-side "I'm going" frame.

## Loop 2 — The Follow → Notify Loop (retention engine, not built)

**Mechanism:** User attends/views event → follows the organizer/community/city → next event triggers push/email → user returns, attends, follows more entities.
**Why it works:** It flips initiation. Today 100% of visits are user-initiated (memory-dependent — deadly). With follows, AlbaGo initiates. Bandsintown's whole business is this loop; Luma's calendar-subscribe is this loop.
**Trigger:** post-save prompt ("follow Klea to catch her next one"), post-event email, protest page ("get alerts for Munich").
**Scales by:** each organizer acquisition brings followers; each follower makes the platform more valuable to organizers (visible follower counts recruit supply — see Loop 4).
**Status:** Not built. Requires: `follows` table, notification fan-out, web-push. The single most important missing system in the product.

## Loop 3 — The Civic Emotion Loop (unique to AlbaGo, running unmanaged)

**Mechanism:** Protest announced → posters flood diaspora group chats → attendees come to AlbaGo for time/place/safety → upload placards to Pankartat afterwards → placard wall content gets shared → new users arrive → they see the *rest* of the platform.
**Why it works:** Emotion is the strongest sharing motive that exists, and AlbaGo has an authentic monopoly on this one. Pankartat turns attendance into content into reach.
**Trigger:** news cycle (uncontrollable) + platform prompts (controllable: "were you there? add your placard").
**Scales by:** each protest event; each new movement onboarded (`/movements` is already generic); each diaspora city holding solidarity events.
**Risk:** chained to the news cycle — this loop *funds* the others with attention; it must hand users to Loops 2 and 5 or the attention evaporates. Concretely: every civic surface needs one gentle bridge ("see what else is happening in your city").
**Status:** Working organically. Un-hide the /protests Pankartat CTA; add the civic→cultural bridge modules; add protest alert subscriptions (which is Loop 2 wearing civic clothes).

## Loop 4 — The Organizer Success Loop (supply flywheel)

**Mechanism:** Organizer posts event → gets analytics + followers + share pack → event performs visibly better than FB/IG alone → organizer posts next event on AlbaGo *first* → tells other organizers (small, gossipy industry) → more supply → more visitors → better analytics story.
**Why it works:** Organizers are starving for two things Instagram took away: reach and data. Giving both, free, with receipts ("2,400 people saw your event") makes AlbaGo the professional default.
**Trigger:** the post-event report card email — the moment of proof, delivered when pride is highest.
**Scales by:** word of mouth inside the tight Tirana scene, then per-city; verification tiers gamify commitment; follower counts create lock-in (audience portability fear is why organizers never leave platforms).
**Status:** Machinery built, proof layer absent (no analytics). This loop starts the day `event_views` ships and the first report-card email sends.

## Loop 5 — The Calendar Infiltration Loop (Luma's trick, diaspora-amplified)

**Mechanism:** User adds event to Google Calendar / subscribes to a city or community calendar feed → AlbaGo events render inside their calendar forever → each glance is an impression → clicks come back to AlbaGo → more subscriptions.
**Why it works:** The calendar is the highest-trust surface on anyone's phone, and .ics feeds are free distribution with zero platform risk. A WhatsApp admin pinning "Albanian events in Zurich — subscribe" converts one share into a permanent channel to hundreds of phones.
**Trigger:** add-to-calendar button on every event; "subscribe to this city" on empty states and digests.
**Scales by:** communities and group-chat admins doing the distribution; zero marginal cost.
**Status:** Not built. Cheap (ics generation is trivial), high leverage, invisible to competitors.

## Loop 6 — The SEO Compounding Loop (built, needs feeding)

**Mechanism:** Every event/venue/city page is server-rendered with JSON-LD → Google indexes → "events tirana tonight" / "albanian events london" searches land on AlbaGo → visitors save/follow → organizers see traffic source → more events → more pages → more queries covered.
**Why it works:** Near-zero competition in Albanian-language event SEO and diaspora-city queries; Google's event rich results actively distribute structured event data.
**Trigger:** passive (search demand exists year-round; spikes in summer for tourism).
**Scales by:** programmatic city×category×language landing pages; supply growth = page growth.
**Status:** Plumbing excellent, but the sitemap was never submitted to Search Console (do it — it's been pending for weeks) and /events is client-rendered (crawlers see a shell — fix). Tourist-facing German/Italian pages unstarted.

## Loop 7 — The Empty-City Waitlist Loop (turns weakness into acquisition)

**Mechanism:** Diaspora user opens AlbaGo in Vienna → no events → instead of a dead end: "No events in Vienna yet. 47 people are waiting. Know an organizer or association? Bring AlbaGo to Vienna." → user shares to their community group → association signs up as first organizer → city seeds itself.
**Why it works:** Converts the platform's biggest embarrassment (empty cities) into a coordination game with visible momentum (the counter). Diaspora communities are pre-organized — one association = instant supply.
**Trigger:** any empty search/city view.
**Scales by:** every empty city becomes a mini-campaign; ranked "next city" leaderboard adds competitive pride between diaspora communities.
**Status:** Not built. Small build (waitlist table + counter + share card), disproportionate payoff for §09 expansion.

## Loop 8 — The Contribution Identity Loop (Pankartat pattern, generalized)

**Mechanism:** User uploads content (placard, event photo, venue tip) → content gets votes/spotlights → contributor earns visible identity (badges, "founder era", leaderboard) → contributes more → walls get richer → more visitors → more contributors.
**Why it works:** People return to places where they have identity and standing (Reddit karma, Strava kudos). AlbaGo's civic wall already proves Albanians will contribute emotionally-charged content.
**Trigger:** post-event prompts, weekly spotlights, badge unlocks.
**Scales by:** generalizing photo walls from Pankartat to every event; badges cost nothing.
**Status:** Civic version live; generalization not started.

## Loop 9 — The Friend Invite Loop (classic, needs density first)

**Mechanism:** User RSVPs → prompted "who's coming with you?" → sends WhatsApp invite with personal card → friend lands on event, sees "Erisa is going" → RSVPs, joins.
**Why it works:** Events are inherently social; nobody goes alone. Partiful built an entire company on the invite moment.
**Trigger:** the RSVP moment (highest intent instant in the product).
**Scales by:** every RSVP is an invite opportunity; k-factor lives here.
**Status:** Blocked on RSVP existing; sequence after supply density (see §04 note).

## Loop meta-strategy

Order of activation: **1 & 3 are live** (amplify, add analytics) → **2, 5, 6-fixes ship next** (retention + free distribution) → **4 starts with analytics** (supply flywheel) → **7 with expansion** → **8, 9 with density**. The system is deliberately WhatsApp-shaped and calendar-shaped because paid acquisition is off the table and Albanian network topology (dense group chats, tight scenes, organized diaspora) is the actual distribution infrastructure.
