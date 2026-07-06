# 12. UX Audit — flows reviewed and redesigned

Grounded in the actual routes/components at commit `5ab7a05`. Verdict format: what exists → what's wrong → the redesign. Respecting the standing user rule: big visual restructures ship stage-by-stage with confirmation, smallest reversible piece first.

## 12.1 Navigation & information architecture

**Exists:** Navbar (logo, links, language dropdown, theme toggle, avatar menu) + mobile bottom nav (Home / Events / Protests / Map) + footer. Admin has its own Linear-style shell.

**Wrong:** The IA encodes the identity crisis. "Protests" occupying 25% of global nav forces the civic/nightlife collision on every user (audit P2 #11). There is no place for "my stuff" (saved) in primary nav. Language switcher exposes `AL` code (should read "Shqip"). 48 routes hang off a nav built for 12.

**Redesign — the "two rooms, one house" model:**
- Bottom nav: **Home · Explore · ♥ Saved · Profile** — the universal consumer-app quartet. "Explore" merges events+map+venues (map as a toggle *view* of explore results, not a separate destination — Airbnb's list/map pattern; the components are already siblings).
- Civic becomes a **mode, not a tab**: a persistent, dismissible "LIVE — civic" ribbon when protests are active (LiveProtestsBanner already exists — promote it to the pattern), plus a first-class Civic card block inside Home and Explore. Activists get urgency when it matters; a clubber's Tuesday isn't a rally.
- Profile hosts saved/dashboard/organizer/settings/language/theme — everything self-referential in one place.

## 12.2 Onboarding (first session)

**Exists:** None. Users land raw; sign-up (email or Google) is only prompted at save/submit. Default city = Tirana for everyone.

**Wrong:** The single highest-leverage missing flow. A Munich Albanian sees Tirana events; nobody is asked what they care about; language defaults silently; no notification permission is ever earned.

**Redesign — 3 screens, skippable, under 20 seconds:**
1. **"Ku je?"** — city picker with geolocation button, diaspora cities prominent, plus the killer question: *"Nga je?"* (add a "back home" city — the §3.8 dual-city seed, asked as naturally as any Albanian asks it).
2. **"Çfarë të pëlqen?"** — 3+ category chips (feeds the heuristic feed).
3. **"Mos humb asgjë"** — notification opt-in framed by value ("protests in your city / your artists on tour"), not permission-begging.
Sign-up stays deferred (correct today — keep it). Language auto-detects from browser with a visible switch.

## 12.3 Discovery & search

**Exists:** /events with the Airbnb-grade sticky filter bar (search + suggestions, city/date/sort popovers, mini range calendar, mobile sheet), image-first cards, category gradient tiles on home.

**Wrong:** Client-rendered list (blank-shell first paint, invisible to crawlers — audit P2 #10). Search is literal substring — no typo tolerance, no Albanian/English synonym bridging ("koncert"/"concert"), and `search_vector` uses the `simple` config (no language handling). Filters don't persist across sessions (city amnesia). Empty results are dead ends.

**Redesign:** SSR the list with URL-as-state (the filter logic already round-trips URLs — the hard part is done). Persist last city/filters per user. Search v2: pg_trgm fuzziness + a small sq/en synonym map now; NL search (§11-#4) later. Every empty state sells something: nearby-city fallback, "follow this city" (Loop 7), or clear-filters shortcut. Weekend/Tonight editorial URLs (/weekend) as shareable entry points.

## 12.4 Event page → action

**Exists:** Excellent SSR detail page: gallery, JSON-LD, save, share modal (posters/reel/QR), directions, countdown for civic, organizer attribution.

**Wrong:** It's a leaf node — great arrival, no onward path. No add-to-calendar (the cheapest high-value button in the industry). No related events / more-from-organizer. Save is the only commitment verb (silent, private, weak). Post-event, the page just goes stale.

**Redesign:** Action row = **Save · Calendar · Share · Directions**; RSVP joins when density allows (§4 rule). Below content: "More from {organizer} + follow", "Same night in {city}". After the date passes: recap state (photo wall CTA, next-edition pointer). The page becomes a hub, not a leaf.

## 12.5 Event creation (community wizard)

**Exists:** 8-step wizard (type → category → basics → when → where → media → organizer → review), localStorage drafts, rate-limited RPC, auth handled at entry with draft reassurance (fixed in `97c8253`/`036eb34`).

**Wrong:** 8 steps for what Luma does in one screen (audit P2 #8: two steps are single-choice). Free-text venue entry because venue supply is empty. English-only. Never verified end-to-end in production (P0 — still). `window.confirm()` for draft reset.

**Redesign:** Merge Type+Category; fold Media into Basics → 5 steps. Then add the **fast lane**: a one-screen "quick create" (title/when/where/photo) that expands into the wizard only for recurring/complex events — two doors, one machine. Venue field becomes autocomplete-first (after venue seeding op) with free-text fallback. Full i18n. And run the E2E test — it has been "next" for two weeks.

## 12.6 Organizer experience

**Exists:** Onboarding survey → Spotify-style dashboard (hero metric, KPI sparklines, top events, activity) → create wizard → verification page. Tier auto-promotion trigger live.

**Wrong:** Onboarding asks revenue/audience-size at step 2 — interrogation before value (known backlog item). Dashboard sparklines visualize data that isn't collected (analytics theater — the sparklines mostly render nothing). No follower concept, no share-pack delivery, no post-event moment. The dashboard answers "what did I post?" not "how am I doing?"

**Redesign:** Onboarding = name + email + one optional question; the survey moves to a later "complete your profile" nudge. Dashboard reorients around the §7 journey: next event front and center with its live stats; report card after each event; followers as the persistent growth number. Publish flow ends with the share pack, not a toast.

## 12.7 Civic surfaces

**Exists:** /protests (countdowns, whole-card links, popups), /movements/[slug], Pankartat wall, /volunteer, safety panel, live banner.

**Wrong:** Very little — this is the product's best-loved UX. Gaps: no alert subscription (the #1 plausible user wish), Pankartat CTA still hidden pending unveil, one-off hand-built pages (edi-rama-berlin) instead of the generic movement pattern, no bridge from civic surfaces to the rest of the platform.

**Redesign:** "🔔 Get alerts for {city}" on every civic surface (push/email — Loop 2 in civic clothes). Generalize rich protest pages into /protests/[slug] templates. One quiet bridge module per civic page ("also in your city this week") — the funnel from moment to habit.

## 12.8 Auth & account

**Exists:** Email + Google OAuth, `?next=` preserved across sign-in/up/reset (fixed per audit), branded auth emails, settings with notification prefs, delete-account via mailto.

**Wrong:** Google app still shows "unverified" interstitial (pending verification submission). Delete-account by email is GDPR-awkward. No profile identity (display name shows, but no avatar/public profile).

**Redesign:** Submit OAuth verification; self-serve deletion; profile grows only when social features (§5-F) need it — not before.

## 12.9 Cross-cutting

1. **Language is the biggest UX bug in the product.** 10/73 components internationalized means the AL toggle produces a broken promise. This outranks any layout concern in this entire section.
2. **Loading/skeleton discipline is good** (PageSkeleton, staggered cards) — maintain the standard on new surfaces.
3. **Light mode:** reactive-patch policy is correct; dark is the brand.
4. **Performance:** homepage is 1,358 lines client-side (HomeClient) with multiple live queries; as supply grows, move rails to server components with streaming. Mobile-first means first-paint on 4G is the real benchmark.
5. **Accessibility:** the /volunteer a11y pass set the pattern (labels, aria-live, roles) — apply it to the wizard and filter bar; the flame-on-ink palette needs contrast checks on `text-white/50`-style faint text.
6. **Design system:** the cinematic vocabulary (flame CTAs, ink surfaces, kickers, hairlines, category tones) is consistent and strong — codify it in a short `docs/design-system.md` so future sessions stop re-deriving it from memory files.
