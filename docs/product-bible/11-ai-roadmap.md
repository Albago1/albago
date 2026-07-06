# 11. AI Roadmap — revolutionary features, limitations ignored

Ordering is by *strategic leverage*, not feasibility — but each entry notes the realistic first step, because an AI roadmap that never ships is theater. The platform's AI advantage is unusual: a bilingual (sq/en) domain, a culturally specific graph (nation + diaspora), and emotionally charged content — generic models serve this badly, which makes a tuned layer defensible.

## Tier 1 — The supply multipliers (build first; they attack the binding constraint)

### 1. Universal Event Ingestion Agent ("paste anything, get an event")
Paste a Facebook event URL, an Instagram post, a WhatsApp forward, or a *photo of a street poster* → structured AlbaGo draft: title, date/time (Albanian date formats understood), venue matched against `places` (fuzzy), category, bilingual description, suggested banner crop. Human confirms, publishes.
- **Why revolutionary here:** it reduces organizer switching cost to ~zero and lets one admin aggregate a whole city's public events in an afternoon. This is the cold-start weapon.
- **First step:** URL/text → draft via a single LLM extraction call feeding the existing wizard state. Poster-photo OCR second.

### 2. The Translation Layer (every event in every language, invisibly)
Every event auto-published in sq + en + de + it; organizer writes in whichever language they think in. UI copy, event content, notifications — all localized. Second-gen diaspora kids read German; their parents read Albanian; the same event serves both.
- **Why revolutionary:** turns the platform's worst current failure (half-translated UI) into a structural advantage no manual sweep could reach.
- **First step:** on-publish translation of title/description into a `translations` JSONB column; human-editable.

### 3. Auto-Creative Studio (the share system, self-driving)
The poster/story/reel system already exists — add generation: brand-consistent AI banners for imageless events (flame/ink/serif system prompts), auto-assembled recap reels from event photo walls, per-category visual variants, caption writing in the organizer's voice.
- **First step:** generated OG/banner images for banner-less events (already a backlog item) — template-based first, generative second.

## Tier 2 — The demand-side brain

### 4. Natural-language everything ("çfarë ka sonte?")
One search box that takes "free live music near Blloku tonight", "something for my parents visiting Sunday", "ku ka protesta këtë javë" — in Albanian, English, or mixed (code-switching is how the diaspora actually types) — and returns structured, filtered results. Voice input on mobile.
- **First step:** LLM → filter-JSON translation layer over the existing search/filter API. The filters already exist; NL is a parser.

### 5. The Concierge ("plan my Saturday")
Conversational planner: constraints in (budget, group, vibe, time), itinerary out (event + dinner venue + backup), bookable/savable in one tap. For tourists: multi-day trip plans. For diaspora August returns: "two weeks in Vlora with kids" → a living itinerary.
- **First step:** a curated "Tonight's plan" generation from existing catalog + a chat UI. Depends on supply density — sequence accordingly.

### 6. Taste Graph & personal ranking
Per-user event scoring from saves/views/attendance/follows; "your kind of night" ordering; "because you loved X" rows; smart digest content selection. Cold-start via category picks at onboarding.
- **First step:** heuristic scoring (city + category affinity + follows), honestly labeled; ML when data volume justifies it. Do not ship a fake "AI feed" over 40 events.

## Tier 3 — The organizer copilot

### 7. Event Success Copilot
"Your Friday event overlaps with X's festival — Thursday averages 30% better attendance for techno in Tirana." Pre-publish advice (timing, pricing, title quality), mid-campaign nudges ("saves are 2x your average — consider a bigger room"), post-event narrative analysis in plain Albanian. Attendance forecasting once RSVP data exists.
- **First step:** rule-based insights on the report-card email; graduate to models with data.

### 8. Moderation Copilot
Pre-screens submissions and placard uploads: duplicate detection, scam patterns, policy flags with reasons, quality scoring — admin reviews a ranked queue instead of a chronological one. Civic surfaces get human-always-in-the-loop by policy.
- **First step:** LLM policy-check pass in the existing admin queue, advisory-only.

## Tier 4 — The frontier (genuinely new, build when earned)

### 9. The Group Decision Agent
The real bottleneck of going out is the group chat argument. Drop an AlbaGo agent link into a WhatsApp group → it interviews the group ("in or out Friday? budget?"), proposes three options from the catalog, runs the vote, books/RSVPs the winner, adds it to everyone's calendar. The agent lives where Albanians decide things: the group chat.

### 10. The Living City Model
Fuse events, RSVPs, share velocity, directions-taps, and (opt-in) presence signals into a real-time model of the city's social energy — powering "hot right now" maps, venue busy-ness, organizer scheduling intelligence, and eventually a public API municipalities pay for (§10-#8, aggregate-only).

### 11. The Memory Institution
AI as archivist: every movement, community, and scene accumulates a searchable, narrated history — "show me the story of the 2026 movement in photos", auto-generated community year-in-reviews, anniversary resurfacing ("one year ago, 50,000 placards"). For a nation whose history is chronically under-archived, AlbaGo becomes the living record. Emotionally, this may be the most defensible thing on this page.

### 12. Cross-language cultural bridge
Second-generation diaspora youth (English/German-first) and their heritage, mutually translated: not just language but context — "what is Dita e Verës?" inline, festival explainers, lyric translations at concerts. Identity infrastructure disguised as tooltips.

## Standing AI rules

1. **No AI on civic truth.** Protest times/places are human-verified, always. AI drafts; humans confirm anything with real-world coordination stakes.
2. **AI is invisible by default.** The user sees "it's in my language," "search just works," "the poster made itself" — never a sparkle-emoji feature dump. The cinematic brand does not do gimmicks.
3. **Every AI feature must feed a loop** (§6): ingestion feeds supply, translation feeds diaspora reach, creative feeds sharing, copilots feed organizer retention. AI for demo value is rejected.
4. **Data honesty:** taste models and forecasts ship only when the underlying data exists (see §14 — no theater).
