# 13. 24-Month Roadmap

Four eras. Every month: objectives → priorities → success metrics. Metrics compound — each month inherits the previous month's bar. **Standing rule: if a month's supply/user metric misses badly, the next month repeats it — feature work does not proceed on schedule against a failing foundation.** Dates from 2026-07.

## Era 1 — Foundation & Supply (Months 1–6): make it true in one city

### M1 (Jul 2026) — Stop the bleeding, start measuring
- **Objectives:** clear every P0; instrument the platform; begin the supply war.
- **Priorities:** rotate/delete `ID_Resend.txt`; commit aging diffs; E2E-test /submit-event; submit sitemap to Search Console; ship `event_views` + save/share/search tracking; Sentry; delete dead routes (submit-event-v2, krijo); begin concierge outreach — first 5 real organizers, seed 25 Tirana venues.
- **Metrics:** 0 open P0s; tracking live on 100% of event pages; 5 organizers onboarded; 25 venues live; baseline numbers recorded (they'll be small — write them down anyway).

### M2 (Aug 2026) — Albanian-first + supply push (Riviera season)
- **Objectives:** the platform speaks Albanian; ride the summer.
- **Priorities:** full i18n sweep (all 73 components through `t()`, `al`→`sq`, key-parity build check); 10 more organizers with focus on coast venues/festivals; "This weekend on the Riviera" curated collections; generated OG images for banner-less events.
- **Metrics:** 100% UI strings localized; 15 total active organizers; 60+ live non-civic events; organic search impressions +50% over M1.

### M3 (Sep 2026) — The retention spine: follows + push
- **Objectives:** AlbaGo initiates visits instead of waiting for them.
- **Priorities:** `follows` table (organizer/city/community-ready); web-push (protest alerts + followed-organizer events + 24h saved-event reminders); add-to-calendar on every event; follow CTAs on event pages/post-save.
- **Metrics:** 25% of WAU follows ≥1 entity; push opt-in ≥30% of PWA installs; notification CTR ≥15%; W2 retention baseline established.

### M4 (Oct 2026) — Organizer love: analytics + report card
- **Objectives:** turn listing into growth; close Loop 4.
- **Priorities:** organizer dashboard on real view/save/share data; post-event report-card email; auto share-pack on publish; wizard 8→5 steps + quick-create one-pager; SSR /events.
- **Metrics:** 25 active organizers; 50% of organizers return weekly to dashboard; 30% publish a 2nd event within 30 days; /events LCP < 2.0s on 4G.

### M5 (Nov 2026) — Community objects + Flag Day moment
- **Objectives:** communities exist; Nov 28 (Flag Day) is the ignition event — every diaspora association on earth holds one that week.
- **Priorities:** community pages v1 (profile, membership, announcements→notify, calendar feed); concierge-onboard 5 diaspora associations (Munich, London, Zurich warm from civic network); Flag Day campaign with share packs; subscribable .ics city/community calendars.
- **Metrics:** 5 communities live with ≥50 members each; Flag Day week = record WAU; 500+ calendar subscriptions; first diaspora city (Munich) at 5 events/month.

### M6 (Dec 2026) — Consolidation + IA restructure
- **Objectives:** fix the two-rooms-one-house IA; year-end retention audit.
- **Priorities:** nav restructure (Home/Explore/Saved/Profile, civic as mode — staged, user-confirmed per working style); onboarding flow (city + hometown + categories + notify); "back home" dual-city rail v1; year-in-review share cards (communities + users).
- **Metrics:** W4 retention +30% vs M3 baseline; dual-city set by 20% of diaspora users; 100 live events/month across all cities.

**Era 1 exit bar:** 1,000 WAU · 30 active organizers · 100 events/month · 10 communities · measurable retention curve. If not met, Era 2 waits.

## Era 2 — Diaspora Expansion (Months 7–12): one playbook, four cities

### M7 (Jan 2027) — Munich fully lit + playbook written
- **Priorities:** run §9 playbook to completion in Munich (association + 2 organizers + 10 events/mo + landing page + digest); write the repeatable playbook doc from what actually worked; German locale shipped; empty-city waitlist loop live.
- **Metrics:** Munich: 10 events/mo, 300 WAU; playbook doc exists; 5 waitlist cities with >20 signups.

### M8 (Feb 2027) — Search v2 + weekly digests
- **Priorities:** typo-tolerant sq/en search; weekly city digest emails (auto-curated); saved searches with alerts; venue pages traffic push (SEO titles, photos).
- **Metrics:** search success rate (result-click within session) >60%; digest open rate >35%; 20% of WAU from email/push (initiated-by-AlbaGo share).

### M9 (Mar 2027) — London launch + artist follow graph
- **Priorities:** London city launch (playbook run #2); artist pages + follow-artist→tour-alerts (Bandsintown mechanic); partnership with 2 promoters of Albanian concerts abroad.
- **Metrics:** London: 10 events/mo by month-end; 3 touring artists using AlbaGo as primary announcement; artist-follow count >1,000.

### M10 (Apr 2027) — RSVP + social proof (density permitting)
- **Priorities:** "I'm going/Interested" rollout civic-first + dense cities (per §4 gating rule); guest count on cards; invite-a-friend WhatsApp flow (Loop 9); event Q&A.
- **Metrics:** RSVP rate ≥8% of event views in enabled cities; invites sent per RSVP ≥0.5; no-regression check on save rate.

### M11 (May 2027) — Milan launch + AI ingestion agent
- **Priorities:** Milan/Italy launch (playbook #3, Italian locale — doubles for tourist season); Universal Ingestion Agent v1 (URL/text→draft) for organizers and admin aggregation; auto-translation of event content sq↔en↔de↔it.
- **Metrics:** Milan lit; 30% of new events arrive via ingestion; 100% of events readable in 4 languages.

### M12 (Jun 2027) — Year-one hardening + monetization prep
- **Priorities:** performance/a11y/test-coverage pass (CI + smoke tests — overdue by a year); venue claim flow; Stripe Connect groundwork (no fees yet); annual "State of Albanian Events" data report (PR moment).
- **Metrics:** 10,000 WAU · 100 active organizers · 400 events/month · 30 communities · 4 lit cities. **This is the funding/monetization gate.**

## Era 3 — Depth & Revenue (Months 13–18)

### M13 (Jul 2027) — NYC launch + trip mode
- **Priorities:** US launch (playbook #4, timezone audit); trip-mode itineraries for the August diaspora return ("Kthehu në shtëpi" campaign — the year's biggest marketing moment); tourist SEO pages (de/it/en) for the Riviera.
- **Metrics:** NYC lit; trip-mode usage by 15% of diaspora WAU; record summer traffic.

### M14 (Aug 2027) — Ticketing beta
- **Priorities:** ticketing v1 (free + paid, Stripe Connect, QR at door, wallet passes) with 10 hand-picked organizers, diaspora-city concerts first (card-native); door check-in mode.
- **Metrics:** 20 ticketed events; >98% scan success; zero payout incidents; fee revenue >€0 (symbolic but real).

### M15 (Sep 2027) — Venue Pro + promoted slots
- **Priorities:** venue Pro subscription launch (50 claimed venues as beta pool); transparent promoted placements; self-serve billing.
- **Metrics:** 15 paying venues; 10 promoted campaigns; promoted CTR ≥ organic (quality bar — if promoted underperforms organic, inventory is mispriced or mislabeled).

### M16 (Oct 2027) — Social layer v2
- **Priorities:** friends (contact match), "friends going" on cards, per-event photo walls (Pankartat generalized), profiles with attendance badges.
- **Metrics:** 20% of users connect ≥1 friend; photo-wall posts on 25% of past events; retention lift measured against M13 cohort.

### M17 (Nov 2027) — Communities v2 + Flag Day II
- **Priorities:** community roles, volunteer pools per community, inter-community federation calendar, community verification badges; Flag Day campaign at 5-city scale; community dues/donations pilot (2 trusted associations).
- **Metrics:** 60 active communities; Flag Day week doubles prior record; dues pilot moves real money with zero disputes.

### M18 (Dec 2027) — Organizer Pro + copilot v1
- **Priorities:** Organizer Pro tier (benchmarks, demographics, blasts, CRM export, second-city boost); rule-based success copilot in report cards; year-in-review II.
- **Metrics:** 10% of active organizers on Pro; MRR (venues+organizers) >€3k; 20,000 WAU.

## Era 4 — Scale & Moat (Months 19–24)

### M19 (Jan 2028) — Native app decision gate
- **Priorities:** evaluate PWA limits with data (push reliability, iOS engagement); if warranted, start Expo app sharing the API; else double down on PWA + widgets. Zurich/Vienna launches (playbook #5–6, waitlist-ranked).
- **Metrics:** decision documented with data; 6 lit cities.

### M20 (Feb 2028) — AI concierge + NL search
- **Priorities:** natural-language search in sq/en (the catalog is now dense enough to deserve it); "plan my Saturday" concierge beta; taste-model ranking v1.
- **Metrics:** NL queries = 20% of searches; concierge session→save conversion >30%.

### M21 (Mar 2028) — The group decision agent + WhatsApp depth
- **Priorities:** WhatsApp-native group planning flows (poll links → agent v1); Telegram city channels automation; share analytics for users.
- **Metrics:** group flows initiate 10% of RSVPs; k-factor measured >0.3.

### M22 (Apr 2028) — Ticketing GA + festivals
- **Priorities:** ticketing open to all verified organizers; multi-day/festival support (lineups, day passes); API for professional promoters.
- **Metrics:** 100 ticketed events/month; GMV run-rate €500k/yr; take-rate holding at 4% without churn.

### M23 (May 2028) — Balkan expansion decision
- **Priorities:** Kosovo full launch (Prishtina is already in the location system — formalize); evaluate North Macedonia/Montenegro Albanian communities; the "for-X" white-label question gets a real memo (§10-#9).
- **Metrics:** Prishtina lit within 6 weeks (shared language/culture = fastest playbook run ever); white-label go/no-go documented.

### M24 (Jun 2028) — The institution
- **Priorities:** platform reliability certification for civic seasons (load-tested, monitored, on-call); public transparency report (moderation, civic pledge compliance); Memory Institution v1 (movement/community archives); strategic review against this bible — rewrite it for years 3–4.
- **Metrics (the 24-month scoreboard):** 50,000 WAU · 300 active organizers · 1,500 events/month · 150 communities · 8+ lit cities · €10k+ MRR + growing GMV · and the qualitative one: when an Albanian anywhere asks "çfarë po ndodh?", the answer is AlbaGo.

## What is deliberately NOT on this roadmap
Native apps before M19 · Japan (§9) · general-market non-Albanian launches · display advertising · chat/DMs · NFT/web3 anything · consumer subscriptions. Each is either premature, off-thesis, or rejected outright.
