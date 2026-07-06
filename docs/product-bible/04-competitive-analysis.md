# 4. Competitive Analysis

Nine competitors, feature-by-feature, then the missing-feature list with why each matters. Legend: ✅ has it, strong · 🟡 partial/weak · ❌ absent.

## 4.1 The matrix

| Capability | AlbaGo | Eventbrite | Meetup | FB Events | Luma | Partiful | Fever | Bandsintown | Google Maps | Airbnb Exp. |
|---|---|---|---|---|---|---|---|---|---|---|
| Event discovery feed | 🟡 (thin supply) | ✅ | ✅ | ✅ | 🟡 | ❌ | ✅ | ✅ | 🟡 | ✅ |
| Map-based discovery | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | 🟡 | ❌ | ✅ | 🟡 |
| Venue pages | ✅ (empty) | ❌ | ❌ | ✅ | ❌ | ❌ | 🟡 | ✅ | ✅ | ❌ |
| Ticketing / payments | ❌ | ✅ | 🟡 | ❌ | ✅ | 🟡 | ✅ | 🟡 | ❌ | ✅ |
| Free RSVP / "I'm going" | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ |
| Guest list / attendee visibility | ❌ | 🟡 | ✅ | ✅ | ✅ | ✅ | ❌ | 🟡 | ❌ | ❌ |
| Recurring events | ✅ | ✅ | ✅ | 🟡 | ✅ | ❌ | ✅ | ❌ | ❌ | ✅ |
| Organizer analytics | ❌ | ✅ | ✅ | 🟡 | ✅ | 🟡 | ✅ | ✅ | 🟡 | ✅ |
| Organizer/artist follow → notify | ❌ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ✅✅ (core) | 🟡 | ❌ |
| Communities / groups | ❌ | ❌ | ✅✅ (core) | ✅ | 🟡 (calendars) | ❌ | ❌ | ❌ | ❌ | ❌ |
| Beautiful shareables (auto posters/reels) | ✅✅ | ❌ | ❌ | ❌ | 🟡 (nice OG) | ✅ (vibes) | ❌ | ❌ | ❌ | ❌ |
| Personal calendar sync (iCal/Google) | ❌ | ✅ | ✅ | ✅ | ✅✅ | 🟡 | ❌ | ✅ | ❌ | ❌ |
| Email/push lifecycle (reminders, updates) | 🟡 (saved-changed email) | ✅ | ✅ | ✅ | ✅✅ | ✅ | ✅ | ✅ | ❌ | ✅ |
| Search & filters | ✅ | ✅ | ✅ | 🟡 | 🟡 | ❌ | ✅ | ✅ | ✅ | ✅ |
| Personalization / recs | ❌ | ✅ | ✅ | ✅ | 🟡 | ❌ | ✅✅ | ✅ | ✅✅ | ✅ |
| Reviews / ratings | ❌ | 🟡 | ✅ | ❌ | ❌ | ❌ | ✅ | ❌ | ✅✅ | ✅✅ |
| Civic/protest infrastructure | ✅✅ | ❌ | ❌ | 🟡 (used, not built for) | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Diaspora / dual-city model | 🟡 (city list) | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | 🟡 (tour cities) | ❌ | ❌ |
| Multilingual (sq-first) | 🟡 (10/73) | ❌ | ❌ | ✅ | ❌ | ❌ | ✅ | ❌ | ✅ | ✅ |
| Native mobile apps | ❌ (PWA) | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ | ✅ | ✅ |
| SEO event pages (JSON-LD) | ✅ | ✅ | 🟡 | ❌ | 🟡 | ❌ | ✅ | ✅ | ✅ | ✅ |
| Curated/editorial discovery | 🟡 (highlight flag) | 🟡 | ❌ | ❌ | 🟡 (featured cals) | ❌ | ✅✅ | ❌ | 🟡 | ✅✅ |
| Trust/verification tiers | ✅ | 🟡 | 🟡 | ❌ | 🟡 | ❌ | ✅ | ✅ | ✅ | ✅✅ |

## 4.2 What to learn (and steal) from each

- **Eventbrite** — the cautionary tale, not the model. Won ticketing logistics, lost love: extractive fees, zero discovery loyalty, organizers leave the second an alternative appears. *Steal:* the checkout reliability bar. *Avoid:* becoming a fee-collecting utility with no consumer brand.
- **Meetup** — proof that *groups*, not events, are the retention primitive. People rejoin a group; they attend an event once. *Steal:* the group→event→member loop for §08. *Avoid:* its stagnation — paying organizers subsidize a decaying product.
- **Facebook Events** — the real competitor in Albania. Unbeatable distribution, terrible product (spam, 40% no-show "going", zero organizer tools). *Steal:* frictionless "Interested" as the lowest-commitment social signal. *Attack:* its reach collapse — organizers already know FB shows their events to nobody.
- **Luma** — the modern gold standard for organizer UX: event page live in 60 seconds, gorgeous emails, calendar-first subscriptions, guest lists that make events feel like parties. *Steal:* one-page instant event creation (vs AlbaGo's 8-step wizard), calendar subscribe, post-RSVP flow. Luma is the single most relevant product reference for AlbaGo's organizer side.
- **Partiful** — proof that *social energy* is a feature: playful invites, RSVP as a status symbol, text-message virality among Gen Z. *Steal:* the emotional register of RSVPs ("who's coming" as the product), SMS/WhatsApp-native flows for a WhatsApp-native country.
- **Fever** — the editorial/curation machine: "Fever Original" experiences, city guides, aggressive personalization. *Steal:* curated collections ("This weekend in Tirana", "Riviera nights") — AlbaGo's category tiles already gesture at this. *Avoid:* its pay-to-play catalog opacity.
- **Bandsintown** — the follow graph as the entire product: follow artist → get notified when they tour your city. *Steal wholesale for diaspora:* follow Albanian artists → notified when they play Munich/London/NYC. This is THE diaspora feature and Bandsintown proves the mechanic at 85M users.
- **Google Maps** — owns "near me now." Can't be beaten at places; can be beaten at *events* (its event layer is an afterthought fed by scrapers). *Steal:* the venue page completeness bar (hours, photos, busy-ness). *Defend:* AlbaGo's JSON-LD means Google *distributes* AlbaGo events — Google is a channel, not just a competitor.
- **Airbnb Experiences** — trust architecture (reviews, host standards, photography standards) that makes strangers buy experiences from strangers. *Steal:* supply quality bar and host-success program for the eventual paid-experiences layer (year 2+). Also the design bar the current UI already aspires to.

## 4.3 Missing features that matter, ranked

1. **RSVP / "I'm going" + guest visibility** — the universal social primitive AlbaGo lacks. It converts passive browsing into commitment, gives organizers their #1 requested datum (headcount), and creates social proof ("34 going"). Every social competitor has it. *(Note user's own prior call, respected: don't ship it on a thin catalog — it shows "0 going" everywhere and reads as failure. Gate it on supply density: ship per-city when a city clears ~30 weekly events, or civic-first where numbers are already large.)*
2. **Follow graph (organizers, communities, artists, cities) + notifications** — the retention engine. Without follows, every visit must be self-initiated; with follows, AlbaGo initiates visits. Bandsintown built a 9-figure company on this single loop. For diaspora, "follow your hometown" is unique to AlbaGo.
3. **Organizer analytics** — already P1 in the July audit. It's the difference between "we list your event" and "we grow your audience." No `event_views` table exists; everything else in this bible depends on fixing that.
4. **Calendar integration (iCal feed, Google Calendar add, subscribe-to-city)** — Luma's quiet superpower. An event in someone's calendar is attendance insurance + a recurring brand impression. Subscribe-to-a-city/community feeds are shareable artifacts (a WhatsApp group pins "Albanian events in Zurich" calendar link → every member's calendar becomes an AlbaGo surface).
5. **Push notifications (PWA web-push)** — protests are time-critical; "new protest in your city" push is the single highest-emotional-value notification in the product's arsenal, and the PWA shell is already installed on users' phones.
6. **Communities/groups** — Meetup's core, absent everywhere else in modern form. For the diaspora market this is not a feature, it's the product (§08).
7. **Personalization** — even rules-based ("your city + your saved categories first") beats the current one-feed-for-everyone. Full ML later; heuristics now.
8. **Ticketing / paid RSVP** — the revenue engine, deliberately sequenced later (§10). Schema already anticipates it. Don't build until organizers with real audiences ask.
9. **Reviews/ratings (venues first)** — Google-Maps-grade venue trust, eventually event feedback loops ("how was it?" post-event ping). Powers both quality signal and post-event re-engagement.
10. **Native apps** — matters at scale for push reliability + home-screen presence, but the PWA buys 12+ months. Don't split focus yet.

## 4.4 Where AlbaGo is genuinely ahead

Worth stating so it doesn't get accidentally deprioritized: **auto-generated branded shareables + Reel export** (nobody has it), **civic infrastructure** (nobody will build it), **the cinematic brand** (event platforms look like admin panels; AlbaGo looks like a film), **RLS-grade security architecture at this stage**, and **JSON-LD/SEO discipline** better than Meetup's or Facebook's. The strategy is to connect these strengths to the missing retention loop — shareables bring people in; follows + calendar + push must keep them.
