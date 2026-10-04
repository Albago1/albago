# Worldwide Albanian discovery: plan

Status: **approved 2026-10-04** ("find every Albanian event worldwide, stay inside the free tier"). W0 and W1 are built:

- **City keys.** `lib/citySlug.ts` and engine `canonicalLocality` give one key per city. The data fix is migration `20261004200000_one_key_per_city.sql`; it needs approval before it is applied.
- **`robots.txt`.** `engine/acquire/robots.ts` checks it. Requests identify honestly as AlbaGoBot.
- **Rotation.** `integrations/albago/rotation.ts` and `runner.ts` work through the city goals and an artist watch, behind a free-tier gate: at most 900 searches/month and 8 runs/day, one run at a time.
- **Artist learning.** It lives in `engine/services/entities.ts` and runs from `discover`. The seed list is written as confirmed performers.
- **Admin.** A discovery panel and a "New artists to confirm" list.
- **Cron.** `/api/cron/engine` runs 5× daily.

Still open from the decisions below: grouping star tours as one series (W4).

**Goal:** find Albanian events wherever they happen. That means:

- diaspora parties at known clubs;
- big concerts by Albanian artists, in any country;
- festivals;
- all of Albania (not only Tirana), Kosovo, and the Albanian towns in North Macedonia and Montenegro.

## What already works

- **The relevance rule is not tied to a place.** An event in Zurich counts as Albanian when it has an Albanian performer, an Albanian organizer, says it is for the Albanian community, or is promoted in Albanian. This is `ALBANIAN_RELEVANCE` in `integrations/albago/goals.ts`.
- **Goals can already be worldwide.** They can also be limited to categories and look up to 365 days ahead.
- **AlbaGo's delivery rule already accepts events outside AL/XK**, as long as the event is Albanian-relevant.
- **Duplicates merge.** The same concert listed on three ticket sites becomes one event.

## What is missing

### 1. A search strategy that fits the world

Searching "Tirana, next 14 days" works for one city. It cannot be repeated for every city on earth. Four angles replace it.

| Angle | What it searches | Look-ahead | Why |
|---|---|---|---|
| **Artist watch** | "<artist> concert 2026 tickets" for a list of Albanian artists | 180 days | Big concerts are announced months ahead. One artist search often finds every tour date. |
| **Diaspora cities** | "albanian party / koncert shqip / Albaner Party <city>" | 30 days | Parties and club nights in about 20 cities with large Albanian communities |
| **Albanian region** | All event types per city | 14–21 days | The Tirana slice, repeated for Prishtina, Durrës, Vlorë, Sarandë, Tetovo, Ulcinj, … |
| **Known sources** | Re-reads approved pages directly: promoter sites, venue programs, artists' tour pages | n/a | **Uses no search credits.** This is how the system scales for free. |

The AI proposes known sources as it searches; it already proposed letsgo.al. You approve each one once, and from then on the engine re-checks it directly.

### 2. Staying inside the free tiers

Tavily gives 1,000 searches per month. Rough allocation:

| Angle | Calculation | Searches/month |
|---|---|---|
| Artist watch | about 150 artists, about 1 search each per month (busy artists more often) | 150–200 |
| Diaspora cities | 20 cities × 4 searches × 2 per month | 160 |
| Albanian region | 12 cities × 4 searches × 4 per month | 190 |
| **Total** | | **about 500–550** |

That leaves a buffer. Gemini flash-lite stays free, so runs are paced and slower.

Each run must finish within Vercel's 5 minutes, so "worldwide" means many small runs: one city or one batch of artists at a time. For now these are started by hand from a goal dropdown. Automatic rotation is stage W3 and needs your approval.

### 3. Honest limits (Instagram)

Much diaspora party promotion lives only on Instagram and Facebook. We do not scrape those platforms; that is a firm rule. Coverage comes instead from:

- **Public ticket shops:**
  - Switzerland: Eventfrog, Ticketcorner, Starticket
  - Germany and Austria: Eventim, oeticket
  - UK: Fatsoma, Skiddle
  - Worldwide: Ticketmaster, Dice, Resident Advisor
- **Promoter and venue websites.**
- **Poster scans.** Already built: "Scan poster".
- **The ChatGPT import.** You paste an event or flyer text.
- **Later, promoters as organizers** who post their own events.

**Before reading many new sites, the engine must respect `robots.txt`.** It does not do this yet, so it is part of W0. Pages are read one at a time, like a person would, with no tricks around blocks.

Eventbrite and Songkick stay blocked. Their terms forbid scraping. Both have official APIs, which could become direct connectors later if they are worth it.

### 4. AlbaGo side

- **City names must be one canonical slug.** Today Tirana is split:

  | Slug | Published events | Who writes it |
  |---|---|---|
  | `tirane` | 11 | the wizard |
  | `tirana` | 2 | the app's own key, and the engine |

  The homepage filters on `tirana`, so the 11 `tirane` events don't show under Tirana. Durrës has a similar problem (`bashkia-durres`). This gets worse with every new city, so it is fixed first.
- **Diaspora cities need to appear in the city picker** (Zurich, Munich, Vienna, London, New York, …). Unknown slugs already render honestly (M2 fix), but users can't pick those cities yet.
- **Images.** The engine does not copy posters, because the rights are unknown. Engine events therefore have no banner image. This is acceptable for now. The Poster Studio and organizer uploads solve it later.

### 5. Review load

Worldwide discovery could find 50–150 events per week. Everything goes through your review for now. Once quality is proven, "auto-approve" rules are possible. Example: a trusted ticket shop, a complete date, time and venue, and a strong Albanian signal. **Not in this plan.**

## Stages

- **W0 — Foundations (small, do first)**
  - Canonical city slugs. A one-time data fix (`tirane` → `tirana`, Durrës variants), shown as SQL for your approval.
  - The wizard and the importers use the same city canonicalizer.
  - Engine fetcher respects `robots.txt`.
- **W1 — Goal templates + goal picker**
  - Artist watch, diaspora city and region city goals, built from lists you approve.
  - Performers of found events become candidate artists. The admin page gets a "New artists to confirm" list, and confirmed artists join the artist watch.
  - The admin page gets a goal dropdown instead of the single Tirana button.
  - Each run records which goal it served.
- **W2 — Known-source lane**
  - Approve or deny proposed sources in the admin.
  - Approved sources are re-read directly (no search credits), with JSON-LD first so most pages need no AI.
  - Migrate the 31 old `crawl_sources` into the engine.
- **W3 — Rotation (needs separate approval)**
  - A daily schedule works through the goals within the free limits.
- **W4 — AlbaGo browsing (separate product plan)**
  - Diaspora cities in the picker.
  - A "Worldwide / Diaspora" view.
  - Tours grouped as an Event Series (Phase 40).

## Decisions needed

1. **Global stars:** Dua Lipa, Rita Ora, Bebe Rexha and Ava Max play huge world tours.
   - **Recommendation:** include their tour dates, grouped as one tour series, so they don't flood the feed.
   - The alternative is to leave them out.
2. **Artist list.** The seed is below and grows by itself; add names any time.
3. **City list.** Draft below; edit freely.
4. **Start with W0 + W1?** Recommended.

### The artist list grows by itself

A hand-typed list will always miss artists, so the list is only a seed.

**Learning:**
- Every event the engine finds with an Albanian-relevant performer adds that performer as a *candidate artist*.
- This uses the engine's existing `entities` table, which is neutral: "performer X has affiliation Y, seen in events Z".
- A candidate waits for one click from the reviewer before it is searched. This keeps out non-Albanian DJs who played at an Albanian night.

**Searching:**
- Each confirmed artist is searched about once a month.
- Artists who keep turning up events are searched more often.
- Artists with nothing for months are searched less often.
- 150 artists is roughly 150–200 of the 1,000 free searches per month.

**Editing:** you can add names at any time. For W1 the list is a config file; it moves into the admin in W2.

### Seed artist list (edit freely)

- **Global:**
  - Dua Lipa, Rita Ora, Bebe Rexha, Ava Max
  - Ermal Meta, Action Bronson, Gashi
- **DACH / diaspora rap and pop:**
  - Loredana, Azet, Ardian Bujupi, Lumi B, DJ Gimi-O, Don Phenom
- **Pop / R&B:**
  - Alban Skënderaj, Elvana Gjata, Noizy, Era Istrefi, Yll Limani, Arilena Ara
  - Dafina Zeqiri, Dhurata Dora, Ledri Vula, Butrint Imeri, Ronela Hajati, Besa
  - Morena Taraku, Enca, Flori Mumajesi, Aurela Gaçe, Eneda Tarifa, Anjeza Shahini
  - Kejsi Tola, Elhaida Dani, Jonida Maliqi, Rona Nishliu, Genta Ismajli, Leonora Jakupi
  - Nora Istrefi, Vesa Luma, Bleona, Mariza Ikonomi, Rovena Stefa, Xhensila Myrtezaj
  - Olta Boka, Melinda Ademi, Arta Bajrami, Linda Halimi, Fifi, Blero
  - Ermal Fejzullahu, Endri & Stefi Prifti, Tayna, Kida
- **Rap / hip-hop:**
  - Capital T, Gjiko, Majk, Getinjo, Mozzik, Stresi
  - Lyrical Son, Unikkatil, MC Kresha, Cozman, Ghetto Geasy, Varrosi
  - Vig Poppa, DJ Blunt & Real 1
- **Folk / traditional** (big diaspora concert and festival circuit):
  - Shkurte Fejza, Sinan Hoxha, Ilir Shaqiri, Mahmut Ferati, Adelina Ismaili

### Draft city list (edit)

- **Diaspora:**
  - Switzerland: Zurich, Basel, Geneva, Lausanne, St. Gallen, Lucerne
  - Germany: Munich, Stuttgart, Frankfurt, Düsseldorf, Cologne, Berlin, Hamburg
  - Vienna · Milan · Athens · London · Brussels · Stockholm · Malmö
  - USA: New York, Detroit, Chicago
- **Albanian region:**
  - Kosovo: Prishtina, Prizren, Peja, Gjakova, Ferizaj
  - North Macedonia: Tetovo, Skopje, Struga
  - Ulcinj
  - Albania: Durrës, Vlorë, Sarandë, Ksamil, Dhërmi/Himarë, Shkodër, Korçë
