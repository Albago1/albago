# 15. The 30-Day Founder Operating Plan

**Start: Day 1 = next working day. This converts the bible into execution. Rule zero: if a task isn't in this file, it waits 30 days.** The month has one goal, stated as numbers: **20 real organizers, 50 live venues, 50+ real non-civic events, 100 notification subscribers, tracking on everything, Albanian everywhere users look.**

---

## The 30-day calendar (overview)

| Day | Build track (2h/day) | Network track (2–3h/day, daily from Day 3) |
|---|---|---|
| 1 | P0 sweep: Resend key rotation, git hygiene, .editorconfig, Sentry | Compile venue list (start) |
| 2 | P0 sweep: sitemap submission, OAuth verification submission, /submit-event E2E test, eyeball homepage stage 2 | Compile venue list (finish 50), compile organizer list (start) |
| 3 | Tracking: SQL + /api/track + lib/track.ts | Create IG/TikTok accounts + Telegram channel; first post; finish organizer list (60 names) |
| 4 | Tracking: wire all surfaces + UTM discipline + daily-numbers query | First 5 outreach DMs; enter 10 venues |
| 5–9 | i18n sweep (12–15 components/day, priority order below) | 5 DMs/day + follow-ups; 10 venues/day; 1 post/day; onboard first repliers |
| 10–11 | i18n finish + `al`→`sq` + parity check | First onboarding sessions (create their event WITH them) |
| 12–14 | Buffer: fix whatever the week broke; manual event aggregation tooling = none (Studio is fine) | Outreach wave 2; first Friday weekend-guide post; aggregate 10 public events by hand |
| 15–16 | Add-to-calendar (.ics + Google link) on event pages | Daily loop continues |
| 17–19 | Subscribe capture (`subscribers` table + email field on /events, /protests, event pages) | Daily loop; push subscribe link in Telegram + IG |
| 20–21 | Protest-alert + city-digest send path (extend existing Resend plumbing) | Daily loop; first digest draft |
| 22 | Send digest #1 manually | Daily loop |
| 23–26 | Nothing new. Polish only what onboarded organizers actually complained about | Follow-up wave; onboard to 15+; seed diaspora city (5 Albanian events in Munich or London) |
| 27–28 | Instrument gaps found during the month | Daily loop; push to 20 organizers |
| 29 | Freeze. Verify all tracking end-to-end | Digest #2 |
| 30 | Month review: pull every number, write month-2 plan from data | Thank-you messages to all 20 organizers |

Engineering budget is deliberately ~2h/day. **The constraint this month is network, not code.**

---

## 1. Immediate P0 cleanup (Days 1–2, done means done)

Day 1:
1. **Rotate the Resend key.** The file is deleted, but the key existed on this machine and in terminal history. resend.com → API Keys → create new → update `.env.local` and Vercel env (Production + Preview) → revoke old → redeploy. 10 minutes, closes it forever.
2. **Git hygiene:** commit or discard `.gitignore` (M) and `lib/i18n/translations.ts` (M — the Edi Rama copy edit; commit it, it's been rotting since June); commit `docs/audit-2026-07-02.md`. Working tree must be clean by end of Day 1 and stay clean nightly.
3. **`.editorconfig` with `charset = utf-8`** — 5 minutes, prevents the next mojibake outbreak.
4. **Sentry:** create project, wire DSN (~20 min per prior estimate). You cannot run protest-weekend traffic blind.

Day 2:
5. **Submit `https://albago.org/sitemap.xml` to Google Search Console.** Pending for weeks; it's a form.
6. **Submit Google OAuth verification** (removes the "unverified app" interstitial — approval takes weeks, so submit now).
7. **E2E test /submit-event in production** with a real account: full wizard, real submission, admin approve, event visible, approval email received. If a fourth column-cast bug surfaces, audit the entire `event_submissions` column list against the RPC in one pass — no more trickle fixes.
8. **Eyeball homepage stage 2 in the browser** (shipped 5ab7a05, never reviewed) + one light-mode walk of the five new surfaces. Fix only what's broken, not what's imperfect.

Explicitly deferred from P0: admin 2FA, lint cleanup, `<img>`→`Image` conversions. Not this month.

## 2. Measurement foundation (Days 3–4)

One table, one API route, one helper. No dashboards this month — Supabase Studio SQL is the dashboard.

```sql
create table interactions (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in (
    'event_view','protest_view','place_view','placard_download','placard_view',
    'share_click','share_destination','calendar_add','city_search','search_query',
    'submit_started','submit_completed','subscribe','outbound_click'
  )),
  entity_type text,            -- 'event' | 'place' | 'placard' | null
  entity_id uuid,
  session_id uuid not null,    -- anonymous, localStorage-generated
  user_id uuid,                -- when signed in
  city text,
  meta jsonb not null default '{}',  -- query text, share platform, etc.
  utm_source text, utm_campaign text,
  referrer text,
  created_at timestamptz not null default now()
);
create index on interactions (type, created_at desc);
create index on interactions (entity_type, entity_id, created_at desc);
alter table interactions enable row level security;
-- no client policies: inserts go through /api/track with service role; reads admin-only
```

Wiring (all existing surfaces, no new UI):
- `event_view` / `protest_view` / `place_view`: fire from detail pages (client effect, once per session per entity).
- `share_click` + `share_destination`: inside ShareModal (which button, which platform) — answers "which platform converts," a question the backlog has asked twice.
- `placard_download` / `placard_view`: PlacardCard actions.
- `calendar_add`: the Day 15 button, instrumented from birth.
- `city_search` + `search_query`: filter bar and search input (debounced, log the final query) → this becomes the **demand map**: what people want that you don't have.
- `submit_started` / `submit_completed`: wizard mount / success — the conversion funnel the audit worried about.
- `subscribe`: the Day 17 capture.
- **Source/UTM:** read `utm_source`/`utm_campaign` + `document.referrer` on first pageview per session, stash in sessionStorage, attach to every interaction. **From Day 3, no link leaves your hands without UTM**: `?utm_source=ig&utm_campaign=weekend-guide-w28`, `utm_source=tg`, `utm_source=wa`, `utm_source=fbgroup-munich`. This is the entire "conversion from social media" answer.
- **Returning users:** `session_id` persists in localStorage → distinct sessions per week + sessions seen in ≥2 different weeks = your retention number. Two SQL queries, saved in a `docs/ops/queries.sql` scratch file.

Privacy: no PII, no IP storage, anonymous ID only — consistent with the civic no-tracking pledge; keep Vercel Analytics behind the existing consent banner as-is.

**The 5 daily numbers** (one saved query, checked every morning): unique sessions yesterday · event views yesterday · top 5 search queries with zero results · new subscribers · interactions by utm_source.

## 3. Albanian localization sweep (Days 5–11)

Order = what a first-time Albanian visitor hits, in sequence. The English that hurts most is the *functional* English — buttons, filters, empty states — because it says "this product isn't for you" at the exact moment of intent.

| Priority | Surface | Worst offenders today |
|---|---|---|
| 1 | Navbar, footer, mobile bottom nav, cookie banner | First pixels every visitor sees |
| 2 | Homepage (HomeClient + new cinematic components) | Hero copy, category tiles, section headers, stats labels |
| 3 | /events: FilterBar, EventCard, MiniCalendar, empty states, skeleton labels | "Tonight", "This Weekend", "Featured first", "Search events, clubs, food..." — the audit's named examples |
| 4 | Event detail page (labels, save/share/directions CTAs, countdown) | The page organizers will judge you by |
| 5 | /submit-event wizard, all steps + error/success states | The conversion flow; an organizer's first task |
| 6 | Sign-in/up/reset + auth errors | Trust moment |
| 7 | /protests, /pankartat chrome (content largely sq already — fix the frame) | Mixed-language frames read as unfinished |
| 8 | Dashboard, organizer dashboard, onboarding | Your 20 new organizers land here this month |
| 9 | /about, /faq, /contact, /organizers | Sq versions of trust copy |
| 10 | Admin | **Skip. English admin is fine forever.** |

Process, per day: pick 12–15 components → grep hardcoded strings → wire `t()` → add `sq` keys (write Albanian first, English second — that's the product's voice order now). Day 10–11: rename `al`→`sq` (ISO), migrate the localStorage language key, add a build-time key-parity check so `sq` can never silently fall behind again. Spanish: leave as-is; do not spend a minute on it this month.

Definition of done: switch the language toggle to Shqip and click through surfaces 1–8 without seeing English. That's the test — not key counts.

## 4. Organizer acquisition (Days 3–30, the core job)

**Target profile (in priority order):**
1. **Scene collectives & recurring-night promoters** — techno/house crews, live-music nights, stand-up comedy, quiz nights, poetry slams. Found via Instagram: location tags (Blloku venues), hashtag mining (#tiranaevents, #tiranenights, event poster reposters), and the posters physically on walls in Blloku. They post events weekly, they're starving for reach, and one yes = recurring supply.
2. **Venues that program their own weeks** — bars/clubs with a resident DJ calendar, cultural centers with exhibitions. One yes = 4–8 events/month + a claimed venue page later.
3. **Event-poster aggregator accounts** — the IG pages that repost Tirana events. Not organizers, but one partnership = a pipeline of every event in the city and a distribution ally.

**Cities:** Tirana only, Days 3–22. One diaspora city (Munich if the civic contacts are warmer there, else London) Days 23–30, targeting exactly two things: the Albanian association and any promoter bringing Albanian artists over.

**The math:** 5 DMs/day × 20 days = 100 contacts → expect ~30–35 replies → **20 onboarded**. Track every contact in one spreadsheet: name, IG handle, segment, date contacted, date followed up, status, first event live (date). This spreadsheet is the most important artifact of the month.

**First-touch DM (Albanian, personalize the first line always):**

> Përshëndetje! Pashë eventin tuaj "{titulli}" — duket shumë i fortë. 🔥
>
> Jam Gerardi, kam ndërtuar AlbaGo (albago.org) — platforma ku shqiptarët kudo shohin çfarë po ndodh. Dua ta shtoj eventin tuaj falas: ju bëj faqen e eventit + posterin, story-n dhe reel-in gati për postim, dhe shihni saktësisht sa veta e panë.
>
> Zero punë nga ju — më dërgoni vetëm posterin ose detajet, dhe e keni live për 10 minuta. E provojmë me eventin e radhës?

(English version for diaspora contacts: same structure — compliment their specific event, one sentence of who you are, the free offer, "send me the poster, live in 10 minutes.")

**Follow-up, +3 days, once only:**

> Përshëndetje sërish! Vetëm një kujtesë e shpejtë — oferta qëndron: eventin tuaj të radhës e vendos live në AlbaGo falas dhe ju dërgoj paketën e gatshme të postimeve. Nëse s'është momenti, s'ka fare problem — më thoni dhe nuk ju shqetësoj më. 🙌

**How to not sound like a random startup:**
- Lead with *their* event, never with AlbaGo. The first sentence proves you actually looked.
- Offer **labor, not software**: "I'll do it for you in 10 minutes" beats "sign up on our platform" every time. You are a person who makes their event look good, not an app requesting adoption.
- Never say startup, app, platform launch, download, or "we're building." Say "albago.org" and let the site — which looks better than anything else in the market — do the talking. This is why the i18n sweep runs in parallel: the site they check must greet them in Albanian.
- The protest work is your credibility. If they hesitate: "është e njëjta platformë që mbajti protestat live për diasporën" — that sentence carries weight this year.

**What they get, immediately (the concierge package):**
1. Their event live with a page nicer than their website (they don't have a website).
2. The share pack — poster, story, reel — generated by you with the existing tooling, delivered in the DM thread. Their design department, free.
3. A number within a week: "134 veta e panë eventin tuaj" (the Day 3 tracking makes this true). First time anyone has ever given them a number.
4. Your WhatsApp for support. Founder-as-hotline is the product this month.

**Onboarding a yes (30-min session, in person or call):** create the first event *together* through the wizard while watching where they stumble (every stumble = a line in the UX backlog — this is user research disguised as service). Deliver the share pack in the same hour. Ask one question and log the answer verbatim: "çfarë ju mungon më shumë kur promovoni një event?" — their answers write month 2.

## 5. Supply seeding (Days 2–14, then maintenance)

**50 venues, Tirana:** Day 1–2, build the list from Google Maps + Instagram: ~15 Blloku bars/clubs, ~8 live-music venues, ~8 cultural spaces (galleries, theaters, cultural centers), ~10 restaurants/cafés that host events, ~5 outdoor/seasonal (rooftops, lake park venues), ~4 sports/entertainment. Days 4–9, enter 10/day via Supabase Studio: name, slug, category, address, lat/lng (from Google Maps), description (2 lines, Albanian). **Photos: use their own public promo photos only when they've said yes (photo permission is literally part of the outreach ask), otherwise ship the category-gradient placeholder — it's designed for this and looks intentional.** Do not scrape Google's photos; a takedown fight in month 1 is a stupid way to die.

**Events — target 50+ live non-civic by Day 30, from three sources:**
1. **Onboarded organizers** (~25–30 events): the §4 pipeline.
2. **Hand aggregation** (~15–20): every public event you see on IG/posters goes in as admin-seeded with the organizer credited and linked. Then — this is the move — DM the organizer: "e shtova eventin tuaj në AlbaGo, shikoni si duket: {link}. Nëse doni, jua kaloj llogarinë." Aggregation IS outreach; the live page is the pitch.
3. **Recurring events** (~5–10): weekly nights (quiz night, jazz night, karaoke) — the recurrence system exists; one entry = permanent catalog density.

**Category priority:** nightlife and live music first (Friday/Saturday density is what a first-time visitor judges), then culture (exhibitions/theatre — runs for weeks, cheap density), then food. Sports only if a real match/run presents itself.

**Diaspora seed (Days 23–30):** 5 Albanian events in the chosen city — touring Albanian artists (agencies post these on IG), the association's next gathering, any solidarity event. That's enough for the city page to not be embarrassing when shared into that city's groups.

**What NOT to add:** no fake or filler events, ever — one fake event discovered costs more trust than ten empty days. No new cities in the picker. No new categories. No conferences/webinars/online-course spam. No venue without coordinates (it breaks the map promise).

## 6. Retention loop (Days 15–22 — email + calendar, NOT push)

Build order and reasoning:

1. **Add-to-calendar (Days 15–16).** `.ics` download + Google Calendar link on every event page. Half a day of work, works for anonymous users, and every added event is a permanent reminder living on their phone. Cheapest retention in the industry.
2. **Subscribe capture (Days 17–19).** One `subscribers` table (email, city, type: `digest` | `civic`, confirmed, created_at) + a single reusable input component in three places: /events empty-ish states, /protests ("🔔 Merr njoftim kur shpallet protestë e re"), event pages footer. Resend double-opt-in. **Email first because you already have Resend wired, branded templates, and a sending reputation** — web-push is a service-worker + fanout project that would eat the month.
3. **Protest alerts (Days 20–21).** When admin publishes a civic event → send to `civic` subscribers of that city. Extend the existing notify-on-publish endpoint (`notify-event-published`) — the plumbing exists, this is a second consumer of it. This is the single highest-emotional-value notification the platform can send, and it converts the civic audience into a reachable audience.
4. **Weekly city digest (Day 22, then every Friday).** Assembled by hand the first two times (curation is judgment work anyway), sent through Resend to `digest` subscribers: "Këtë fundjavë në Tiranë" — 5 events, one venue spotlight, one line of platform news. Automate only after two manual sends prove the format.
5. **Telegram channel (Day 3, no code).** "AlbaGo Tiranë" — daily post mirror of the IG content. Zero engineering, instant re-engagement channel, and Telegram is where the civic audience already lives. WhatsApp: use the Channels feature the same way if the audience shows up there; don't build anything.

Explicitly deferred: follows graph, web-push, RSVP, in-app notification center. Month 2+ decisions, made from month 1 data.

## 7. Content & distribution (daily from Day 3)

**Accounts:** Instagram + TikTok (@albago), Telegram channel. Facebook page exists only to join/post in groups.

**The weekly cadence (1 post/day minimum, made from the share tooling you already built — the admin share-batch ZIP generates a week of content in one click):**
- **Mon:** "Java në Tiranë" — 5-event carousel from next 7 days.
- **Tue:** Venue spotlight (photo + "çfarë ka këtë javë aty").
- **Wed:** Single event spotlight (the Story template, posted as feed + story).
- **Thu:** Organizer feature ("njihuni me {emri}" — makes organizers famous; they will always reshare, and their audience becomes yours).
- **Fri:** **"Fundjava në Tiranë"** — the anchor post, best-performing format in this category everywhere. Carousel + reel version.
- **Sat:** Live/atmosphere content or placard/civic content when relevant.
- **Sun:** Civic recap if there was action; otherwise "java që vjen" teaser.

Every post: link with UTM (`utm_source=ig&utm_campaign={format}-w{week}`), city keyword in first line of caption ("evente në Tiranë"), hashtags #tirana #tiranaevents #shqiperi #eventetirane, location tag Tirana. TikTok gets the reel exports (the 15/30s Reel tooling exists — this is its actual job; verify the Instagram upload works on Day 3, it's still unverified).

**Diaspora distribution (2×/week, not spam):** list the 10 biggest "Shqiptarët në {qytet}" Facebook groups and Telegram channels (Munich, Stuttgart, Zurich, London, Milan, NYC). Share only what's *for them*: solidarity/civic events, Albanian artists touring their city, and (once seeded) their city's AlbaGo page. Always as a person, never as a brand account: "gjeta këtë koncert të {artisti} në Mynih, po e ndaj se dija që ju intereson — {link}".

**Building trust publicly:**
- Reply to every DM and comment same-day. At this scale, support IS marketing.
- Post real numbers monthly ("muajin e parë: X evente, Y organizatorë, Z qytete") — public counters make early adopters feel like founders.
- Publish the civic pledge as a post ("protestat në AlbaGo: falas përgjithmonë, pa gjurmim") — it's a differentiator; say it out loud.
- Credit every organizer and photographer, every time. The scene is small and gossipy; generosity compounds.

## 8. Weekly success metrics

Numbers, not vibes. Pull them Sunday night from the interactions table + the outreach spreadsheet. **Miss badly → next week repeats the week, features don't advance.**

| Metric | Week 1 | Week 2 | Week 3 | Week 4 |
|---|---|---|---|---|
| Open P0s | **0** | 0 | 0 | 0 |
| Tracking live on all surfaces | ✅ | ✅ | ✅ + calendar/subscribe events | ✅ verified E2E |
| i18n (priority surfaces 1–8) | started | **100%** | maintained on new work | maintained |
| Organizers contacted (cumulative) | 15 | 40 | 70 | 100 |
| Organizers onboarded (first event live) | 1–2 | 5 | 12 | **20** |
| Venues live | 25 | **50** | 50+ | 55+ |
| Non-civic events live | 10 | 20 | 35 | **50+** |
| Posts published | 5 | 12 | 19 | 26+ |
| Telegram members | channel exists | 50 | 100 | 150 |
| Email subscribers | — | capture live | 50, digest #1 sent | **100**, digest #2 ≥35% open |
| Unique sessions/week | baseline recorded | +25% | +50% vs W1 | 500+ |
| Sessions from UTM (social) | — | measurable | 20% of traffic | 25% of traffic |
| Returning sessions (seen in a prior week) | — | — | measured | ≥15% |

Week 4 also produces one document: `docs/ops/month-1-review.md` — every number above, the verbatim organizer quotes, the zero-result search queries, and the month-2 plan derived from them.

## 9. Anti-distraction rules — do NOT build in these 30 days

1. No RSVP / "I'm going." (Bible §4 gating rule: needs density you don't have yet.)
2. No follows graph, no web-push, no notification center. Email + Telegram carry the month.
3. No community pages. Onboard associations as organizers; the object waits for month 5.
4. No homepage or navigation restructuring. Stage 2 gets eyeballed and bug-fixed, nothing more.
5. No new share-template variants, no animation tuning, no per-category poster art.
6. No admin improvements of any kind. The queue handles 10× current volume already.
7. No light-mode work unless a real user reports a broken surface.
8. No AI features — no ingestion agent, no auto-translate, no NL search. Month 2+ candidates, chosen by data.
9. No new cities in the app, no new categories, no new routes except: subscribe capture + calendar endpoints.
10. No ticketing, payments, or pricing pages. No native app thinking.
11. No dashboard/sparkline work — Studio SQL is the analytics UI this month.
12. No refactors of anything that already got "i love it."
13. **The meta-rule:** every "while I'm in here, I could also…" impulse goes into a `docs/ops/later.md` file, not into the editor. Review it on Day 30, not before.

## 10. Founder daily routine (Days 3–30)

Non-negotiables in bold. Total ≈ 6h; if a day only has 3h, do the bold items only — **outreach beats code every single day this month.**

| Block | Time | What |
|---|---|---|
| Morning open | 30 min | **The 5 numbers** (saved query) → 2-line log in ops sheet. Reply all DMs/comments/emails. |
| Post | 30 min | **Publish today's content** (prepped yesterday). Cross-post Telegram. |
| Network block | 2h | **5 new outreach DMs** (personalized first lines) + all follow-ups due (+3 days rule) + any onboarding session scheduled. Update the spreadsheet immediately, not "later." |
| Build block | 2h | The week's engineering track only (W1 P0s+tracking · W2 i18n · W3 retention · W4 gaps/freeze). Working tree clean at block end. |
| Supply block | 45 min | Data entry: 10 venues (W1–2) or 3–5 aggregated events (W2–4). Prep tomorrow's post from what you just entered. |
| Close | 15 min | Log: contacted / replied / onboarded / events added / anything a user said verbatim. Tomorrow's top 3. |

Weekly fixtures: **Friday** — weekend-guide post (the anchor) + digest send (from W3). **Sunday evening, 1h** — pull the §8 table, compare, decide whether next week advances or repeats. **Any onboarding session always outranks the build block** — reschedule code, never reschedule an organizer.

---

*Day 30 output: the month-1 review doc + a month-2 plan written from real numbers and real organizer quotes. If the Week-4 row is green, month 2 opens the retention spine (follows + push) per bible §13-M3 — one month later than the bible's calendar, funded by an actual network instead of hope.*
