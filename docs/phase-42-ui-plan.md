# Phase 42 — World-class UI (audit + plan)

Status: **42.0 and 42.1 live** (PR #1, 2026-10-05). **42.2 built** (adaptive shelves). 42.3 onward awaits approval.

## How this was checked

- Live site albago.org, 2026-10-05.
- Phone (375 px) and desktop (1440 px).
- Pages walked: home, /events, two event pages, /map (+ results sheet), /cities, /city/tirana, /city/berlin, /submit-event, /sign-in, /about, /faq, /organizers, /become-organizer, the 404 page, the phone menu.
- Real catalog at the time: 6 live events.

## What is already world-class — keep it

1. The brand: flame red, ink black, Instrument Serif headlines. It reads premium.
2. The glass bottom nav on phone, including the shrink-on-scroll.
3. The desktop hero with the drifting poster wall behind "Every Event. One Map."
4. Event page structure on desktop: two columns, blurred poster behind the title.
5. Sign-in card, 404 page, FAQ and About. They are clean and on-brand.

The problems below are about **layout, emptiness and broken details**, not about the brand.

---

## Part A — Things that break the illusion (fix first)

These are small, but each one makes the site look unfinished. A "billion-dollar" feel dies on details like these.

| # | What I saw | Where | Fix |
|---|---|---|---|
| A1 | **Broken poster images.** 2 of the 6 live events (Devil's Paradise, Verknipt) show a broken-image icon. Their posters live on other sites (gowild.al, allevents.in), and the image optimizer only allows Supabase. | /events cards, event pages | UI safety net: when a poster fails to load, swap in the designed no-image backdrop. Real fix is outside this chat (see Part D). |
| A2 | Price shows the word **"Unknown"**. | Cards, event page sidebar | Treat "unknown" / "TBA" / empty as no price, and hide the price. |
| A3 | The **cookie banner covers about a third of the phone screen** and hides the bottom nav on the first visit. | Every page, first visit | A slim one-line bar at the bottom, above the nav. |
| A4 | **Two headline styles.** 18 pages use the serif headline. /submit-event, /become-organizer, /places, the event wizard and onboarding use bold sans. | Those pages | Use the serif headline everywhere. |
| A5 | Sign-in shows "AlbaGo" in plain serif instead of the real logo (red pin plus italic red "Go"). | /sign-in, /sign-up | Use the real wordmark. |
| A6 | Leftover copy: "activists" on /organizers (protests were removed). The raw path "/become-organizer" shows as link text. | /organizers | Fix the copy. |
| A7 | /organizers publicly says "No verified organizers yet". | /organizers | Hide the empty list until there are organizers. The page becomes a pitch. |

---

## Part B — The big moves, ranked

Ranked by **visible impact ÷ effort**, with the catalog size in mind. Today there are about 6 events, so every layout has to look great with 2 events, not 200.

### B1. Poster-first cards — every listing
- **Seen:** cards crop posters into a short strip, the title sits in a grey box below, and "View event" adds noise.
- **Do:** the poster fills a tall card, the title sits on the image over a soft blurred fade, a faint glow takes the poster's colours, and the price is a small pill. Mockup already built (scratchpad `poster-card-mockup.html`).
- **Reference:** Apple TV+, App Store "Today" cards.

### B2. Layouts that look full with only a few events
- **Seen:** on desktop the home "Featured events" is **one card on a 1440 px page**. On /events every category row holds 2 cards and leaves ~60% of the width empty. "More events like this" is one lonely card.
- **Do:** the layout adapts to the count:
  - **1 event:** a wide spotlight banner (poster plus blurred-poster backdrop, big title, date, button).
  - **2–3 events:** big side-by-side posters.
  - **4 or more:** a sliding row.
  - On desktop /events: one grid with category filter chips, instead of a row per category, until there are roughly 12 or more events.
- **Reference:** Apple TV+ "featured" banner, Netflix hero.

### B3. Dark, branded map
- **Seen:** the map uses a bright beige/blue style, the only light surface in a black-and-red product. The product promise is "One Map".
- **Do:** switch to a dark map. OpenFreeMap's free `dark` and `fiord` styles are both live; we already use OpenFreeMap. Tint land and water to ink, and use flame-red pins with a soft glow. Pins become small poster thumbnails. Results-sheet rows get poster thumbnails, and a swipeable card row syncs with the pins.
- **Reference:** Apple Maps dark mode, Airbnb map with price pins.

### B4. Event page — Apple Music treatment
- **Seen:** on phone the title sits on dark and the poster appears lower, in the gallery. The action buttons (official info, Save, Share, Open in Map) wrap into 3 messy rows. The price shows "Unknown".
- **Do:**
  - **Poster:** on phone, a full-bleed poster at the top with the title over its bottom fade.
  - **Ambient colour:** the page glow takes the poster's colours.
  - **Phone action bar:** a sticky bottom bar with one main button (tickets or official info) plus Share and Directions icons.
  - **Desktop:** the right-hand info card stays pinned while you scroll.
- **Reference:** Apple Music album page, Fever event page.

### B5. Real search
- **Seen:** the bottom nav's "Search" tab opens the same /events page as the "Events" tab, so two of five tabs do the same thing. On the home page, search is a 3-box form.
- **Do:** one full-screen search sheet, opened from the Search tab and from a single pill on the home page ("Search events · Berlin"). It shows recent searches, cities, categories and live results as you type, with a "Use my location" row.
- **Reference:** Airbnb search, Uber "Where to?".

### B6. Phone home — events above the fold
- **Seen:** the first phone screen is the headline plus the search form. **Zero events are visible** until you scroll.
- **Do:** a compact headline, the search pill from B5, then a "Tonight / This week in {city}" row of posters, all on the first screen.
- **Caution:** a full homepage restructure was reverted once before (2026-06-14). This goes **last**, mockup first, one piece at a time.

### B7. Collapsing large titles
- **Seen:** on /events, /cities and /city pages the header block takes about 45% of the phone screen before any content.
- **Do:** the iPhone pattern. The big title shrinks into the top bar as you scroll, and search plus the filter chips stick under it.

### B8. /cities — a destination picker, not a directory
- **Seen:** about 100 identical text tiles, almost all with zero events. That reads as a directory, which the product rules say AlbaGo must not be.
- **Do:** live cities first, as big image tiles with counts ("Tirana · 4 events"). The rest sit behind a search field ("Find a city").

### B9. City page with a face
- **Seen:** /city/berlin is a title, two buttons and one text row.
- **Do:** a hero with a dark map snapshot or the city's top poster, a poster row, and a "Tonight" chip when something is on.

### B10. One motion system
- **Do:**
  - **Card into page:** tapping a card grows its poster into the event page instead of a hard page load. Browsers support this natively, and Next 16 has an experimental switch for it.
  - **Feel:** a press-in effect on every card, one shared spring curve, and loading placeholders shaped like the content.
- **Reference:** iOS App Store card open.

### B11. Slimmer phone header
- **Seen:** the phone header has a sign-in icon plus a hamburger menu that repeats the bottom nav.
- **Do:** just the logo plus an avatar or sign-in. Theme and language move into the profile sheet.

### B12. Category tiles
- **Seen:** 3 tiles in a 2-column grid leave an orphan on phone. The tiles show only an icon.
- **Do:** a sliding row, each tile filled with a small collage of that category's real posters.

### Later — signature moments (after B1–B12)
- **Live map hero:** a dimmed dark map with glowing pins behind the home headline on desktop.
- **Evening mode:** after about 6pm the first row becomes "Tonight", with a countdown to the next start. The date stays visible.

---

## Part C — Order of work (stage-and-confirm)

Each stage: mockup, your approval, build, check on phone and desktop, then commit as `Phase 42.N: …`. Nothing moves to the next stage without a thumbs-up.

| Stage | Contents | Risk |
|---|---|---|
| 42.0 | Part A fixes (A1–A7) | Very low. Invisible except that things stop looking broken. |
| 42.1 | B1 poster cards | Low. One component, easy to undo. |
| 42.2 | B2 adaptive layouts + desktop /events grid | Medium |
| 42.3 | B3 dark map | Medium. Mockup the style first. |
| 42.4 | B4 event page | Medium |
| 42.5 | B5 search sheet, then B6 phone home | High, the homepage. Mockup first, one piece at a time. |
| 42.6 | B7 headers, B8 /cities, B9 city page, B11 header, B12 tiles | Medium |
| 42.7 | B10 motion and card-to-page morph | Medium |

---

## Part D — Outside this chat (data / engine), flagged only

These make the UI look broken, but the fix is not UI work:

1. **Re-host imported posters** into Supabase storage at import time, so they pass the image optimizer. A1 only hides the symptom.
2. **"Tirane" and "Tirana" are two separate cities.** /cities lists both, and /city/tirana shows 1 event while 4 exist.
3. **Junk city names** from imports ("Bashkia Durres", "Bernice E Poshtme Donja Brnjica").
4. **Price saved as the text "Unknown"** by the importer. It should be empty.
5. **The map shows 3 of 6 events.** The other 3 probably have no coordinates.
