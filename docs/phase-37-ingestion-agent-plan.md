# Phase 37 — Event Ingestion Agent (admin-only conversational event creation)

**Status:** planned, awaiting approval. Scope = admin-only. Organizer-facing and public chat are explicit non-goals (see §8).

**Strategy source:** `docs/product-bible/11-ai-roadmap.md` §Tier 1 #1, "Universal Event Ingestion Agent — paste anything, get an event." The bible ranks this the **first** AI feature to build because it attacks the binding constraint (supply), not because it demos well. This plan is the execution order against the current codebase; where they conflict, the bible wins.

**Anchor:** one admin aggregates a whole city's events in an afternoon. Paste a WhatsApp forward, drop three poster photos, answer two questions, publish.

---

## 0. What already exists (this is why the phase is affordable)

| Piece | Where | Reused as |
|---|---|---|
| Text → structured event | `readEventListFromText` (`lib/ai/urlReader.ts`) | the extraction call, wrapped in a tool |
| Free-text prompt → event | `lib/ai/promptReader.ts`, `/api/lens/prompt` | proof the one-shot path works; becomes multi-turn |
| Poster photo → event | `readPosterImage` (`lib/ai/posterReader.ts`) | the image tool |
| City / venue / geocode / duplicate | `resolvePoster` (`lib/lens/resolve.ts`) | the `resolve_location` + `check_duplicate` tools |
| Reading → wizard draft | `lib/eventDraftFromReading.ts` (Phase 36.5) | the agent's output format — **unchanged** |
| Draft → published event | `submitAdminEvent` (`lib/wizardSubmit.ts`) | the only publish path; the agent never inserts |
| Image upload | `hooks/useImageUpload` → `event-covers` bucket | attachments become gallery images |
| 4-language packs | `lib/ai/translateEvent.ts` | the translate tool |

**Net new:** conversation state, tool-calling, a chat surface, and the "ask instead of guessing" behaviour.

---

## 1. The one architectural rule

**The agent produces an `EventDraft`. Nothing else.** It is a *fourth way to fill the same form*, not a fourth way to create an event.

```
chat turn ──► tools mutate a server-held EventDraft ──► streamed back to the panel
                                                    │
                                            "Open in wizard"
                                                    │
                              seedWizardDraft() ──► EventCreationWizard ──► submitAdminEvent
```

Consequences, all deliberate:

- **The agent cannot publish.** Publishing happens in the wizard's review step, by a human. This satisfies bible standing AI rule #1 ("AI drafts; humans confirm anything with real-world coordination stakes") and means the agent inherits every validation the wizard already enforces.
- **No new write path.** No new RPC, no new insert, nothing to keep in sync with the wizard.
- **Zero schema change for the draft itself.** `EventDraft` already carries every field including the Phase-37 ticket modes.

---

## 2. Stage A — Typed tools + chat route (no UI)

`lib/agent/tools.ts` — the draft-manipulation contract. Tools, not prose-parsing: the model calls a function with typed arguments and gets a typed result, replacing the current `generateText()` + `parseModelJson()` + hand-written coercion pattern that the Aug-12 audit flagged (§21: "no structured output, no schema enforcement, no tool calling").

| Tool | Does | Wraps |
|---|---|---|
| `set_fields` | write whitelisted draft fields | — |
| `read_text` | extract an event from pasted text | `readEventListFromText` |
| `read_image` | extract from an uploaded poster | `readPosterImage` |
| `resolve_location` | city + venue + coords, with the tier reported back | `resolvePoster` |
| `check_duplicate` | is this already on the site? | `detectDuplicate` |
| `translate` | fill the 4-language packs | `translateEvent` |
| `summarize_draft` | what's filled, what's missing, what's uncertain | `assessReading` |

Schemas via the AI SDK's `jsonSchema()` helper — **no new dependency** (zod is not currently in `package.json`).

`app/api/admin/agent/route.ts` — admin-gated (`isRequestAdmin`), `streamText` with the tool set, session draft held server-side keyed by a session id. Model: `gemini-flash-lite-latest` via the existing `lib/ai/textModel.ts`, same as every other AI call.

**System prompt carries three non-negotiables:**
1. **Never invent a field.** No date on the poster → ask. This is the existing anti-hallucination contract, upgraded from "leave it blank" to "ask a question" — the single biggest quality gain in the phase.
2. **Show the resolution.** "Matched *Kino Millennium*, 200 m from the address you gave — right?" The venue/city matching is the part nobody else has; it must be visible.
3. **Civic events are drafted, never rushed.** `is_civic` drafts get a hard stop: the agent hands to the wizard and says so.

**DoD:** a script drives a multi-turn session (paste text → agent asks for the missing time → answer → draft complete) and asserts the resulting `EventDraft`.

---

## 3. Stage B — The chat surface (`/admin/compose`)

Two panels, mobile-first: conversation left, **live draft right** (stacked on phones), filling in as the agent works. Admin rail link added.

- Streaming responses (AI SDK `useChat`).
- The draft panel is read-only here — editing is the wizard's job.
- Primary action: **Open in wizard**, enabled once the draft passes the wizard's own basics validation. Uses `seedWizardDraft` + `/admin/events/new`, exactly the Radar handoff.
- Session reset; drafts are not persisted across reloads in v1 (v2 could).

**DoD:** paste a real Albanian event's text, answer the agent's questions, land in the wizard with the form filled, publish.

---

## 4. Stage C — Images

- Drop or paste images into the conversation → uploaded via the existing `event-covers` path (admin's UID folder, existing storage policy, **no migration**), then read by `read_image`.
- Multiple images: first becomes the cover, the rest become the gallery (`gallery_urls`), matching what the wizard's media step expects.
- Text + image in one turn merge into one draft — poster gives title/date, the message gives the ticket link. Conflicts are surfaced as a question, never silently resolved.

**DoD:** a street-poster photo plus one line of context ("this is at Tirana, tickets on ticketalbania") produces a complete draft with a real cover image.

---

## 5. Stage D — Resolution, visibly

Wire `resolve_location` and `check_duplicate` into the conversation so the agent reports the match tier the way `/admin/event-radar` does: matched / suggested / unmatched, with the distance sanity ring, and a hard warning when a duplicate is live.

**DoD:** creating an event that already exists gets called out before the wizard opens.

---

## 6. Stage E — Honesty and cost

- **Token/cost telemetry per session**, persisted. The audit's §21 finding: no cost tracking anywhere today. A conversational surface is the first one where costs can run away, so it ships with the meter, not after.
- Translations via the existing `translateEvent` (closes the CRAWL-3 gap for agent-created events).
- Surface strings through `t()` with `sq` at parity — bible standing rule #4. Admin-only, but the rule has no exceptions.
- Failure states in plain language: model down, rate limited, image unreadable.

---

## 7. Verification bar

`tsc` clean · `eslint` clean on touched files · `next build` clean · the Stage A script test · and the headline manual test: **a WhatsApp forward plus two poster photos, published to the live site in one conversation.** Each stage lands as its own commit (stage-and-confirm). The summary to the user always states what remains humanly unverified.

---

## 8. Explicit non-goals

Organizer-facing or public chat (abuse, cost caps, and the `organizer_create_event_v2` RPC gap all land there) · auto-publish without a human · civic/protest events created end-to-end by AI · multi-occurrence and tours (the whole-schema problem in audit §29) · voice input · agent editing of *existing* events · a general "ask AlbaGo anything" assistant (that's bible Tier 2, demand-side, and it needs supply density first).

---

## 9. Build order across sessions

1. **Session 1:** Stage A — tools, route, script test. Nothing user-visible; the contract first.
2. **Session 2:** Stage B — the surface, text-only, end-to-end to a published event.
3. **Session 3:** Stage C + D — images and visible resolution.
4. **Session 4:** Stage E — telemetry, translations, i18n, error states.

**User P0:** none. `GOOGLE_GENERATIVE_AI_API_KEY` is already set (every existing AI feature depends on it). No new env, no new bucket, no SQL for stages A–D; Stage E's telemetry table is the phase's only migration.
