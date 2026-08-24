import 'server-only'
import { generateText } from 'ai'
import { google } from '@ai-sdk/google'
import { openai } from '@ai-sdk/openai'
import { parseModelJson } from '@/lib/ai/parseModelJson'
import { windowEnd, type ScoutBrief } from './brief'

/**
 * The Scout's search half (Phase 39): one grounded web search per brief,
 * returning raw event objects in the ingest contract's shape.
 *
 * This is the piece that replaces "open ChatGPT and ask it to look". It uses
 * Gemini with Google Search grounding — the same key and SDK the rest of the
 * app's AI already runs on, so no second vendor account and no second bill.
 *
 * Two things it deliberately does NOT do:
 *
 *  1. It does not decide anything. Its output goes straight into ingestEvents,
 *     which re-reads every source page, overrules the model wherever the page
 *     disagrees, resolves the city itself, and files a draft for a human. The
 *     model is a scout, not an editor — same contract as the ChatGPT path.
 *  2. It does not use structured output. Gemini cannot combine search grounding
 *     with a response schema, so the JSON shape is stated in the prompt and
 *     parsed with the shared parseModelJson. Anything malformed is dropped.
 */

/**
 * Which provider does the searching.
 *
 * OpenAI by default, because the Scout's searches are the one AI job here that
 * is entirely separate from the rest of the app: keeping it on its own key means
 * a nightly run can never exhaust the quota that Lens, translations and the
 * compose assistant depend on — which is exactly the failure that produced the
 * first empty result (a Gemini free-tier quota error, reported as "found
 * nothing"). Force either way with SCOUT_PROVIDER=openai|google.
 */
export type ScoutProvider = 'openai' | 'google'

export function resolveProvider(): ScoutProvider {
  const explicit = process.env.SCOUT_PROVIDER?.trim().toLowerCase()
  if (explicit === 'openai' || explicit === 'google') return explicit
  return process.env.OPENAI_API_KEY ? 'openai' : 'google'
}

/** Model ladder per provider: preferred first, fallback second. Pin the first
 *  entry with AI_SCOUT_MODEL. */
function modelLadder(provider: ScoutProvider): string[] {
  const pinned = process.env.AI_SCOUT_MODEL?.trim()
  const ladder =
    provider === 'openai'
      ? // mini is the right shape for this: the hard part is searching and
        // reading, not reasoning, and the nightly run is cost-sensitive.
        ['gpt-5.4-mini', 'gpt-5.4']
      : ['gemini-flash-latest', 'gemini-flash-lite-latest']
  if (!pinned) return ladder
  return [pinned, ...ladder.filter((m) => m !== pinned)]
}

/** Reasoning models spend part of the output budget thinking, so the ceiling has
 *  to clear both the reasoning and the JSON. */
function outputBudget(provider: ScoutProvider): number {
  return provider === 'openai' ? 12_000 : 8_000
}

/** Hard cap on events per brief, so one loose search can't flood the queue. */
export const MAX_EVENTS_PER_BRIEF = 10

/**
 * A grounded search runs several web fetches inside the provider before it
 * answers, so it is legitimately slow — but it must not be allowed to hang. A
 * call that stalls would otherwise consume the entire run budget and surface as
 * a generic timeout with no cause attached, which is exactly the failure mode
 * that made the first empty result so hard to diagnose.
 */
const SEARCH_TIMEOUT_MS = 90_000

const SYSTEM_PROMPT = `You are AlbaGo's event scout. You search the public web for real, upcoming, public events and report them as JSON. You are a reporter: you record what sources say, and nothing else.

THE ONE RULE: NEVER INVENT A VALUE. If a source does not state the time, the year, the venue, or the price, leave that field as an empty string. A wrong date on a public event page sends real people to a closed door. An empty field is correct; a plausible guess is not. This rule outranks any instinct to produce complete-looking results.

Rules:
1. Only events that are genuinely upcoming within the stated date window. Never a past event, never last year's edition of a recurring festival. Check the year explicitly — event pages routinely leave old editions online.
2. Every event MUST carry source_url: the specific public page you read it on. No source_url, no event. Never cite a search engine results page, and never cite a page you did not actually read.
3. One entry per event. Do not list the same event twice under different names.
4. city must be a real settlement (Tirana, Durrës, Vlorë, Sarandë, Prishtina…), spelled as OpenStreetMap spells it. Never a region, coastline, country or neighbourhood. A neighbourhood goes in address.
5. Do not compute a location slug and do not send coordinates. AlbaGo resolves the location itself; anything you send for it is discarded.
6. title and description keep the source's own wording in the source's own language. Do not translate, do not embellish, do not summarise into marketing copy.
7. date is ISO YYYY-MM-DD. time and end_time are 24h HH:MM. If a source states only a doors time, use it as the start.
8. category is exactly one of: nightlife, music, sports, culture, food, civic — or "" if genuinely unclear. Protests, marches, commemorations → civic.
9. image_url only when it is a direct URL to the image FILE (.jpg/.png/.webp/.avif). A page URL, a search thumbnail, or a social CDN link that will expire is worse than nothing — leave it empty and AlbaGo will take the page's own preview image.
10. Prefer venue sites, ticketing platforms, cultural institutions, municipality pages and festival sites. Social posts you cannot open are not sources.

Return ONLY a JSON object of the form:
{"events":[{"source_url":"","image_url":"","title":"","description":"","category":"","is_civic":false,"date":"","time":"","end_time":"","venue_name":"","address":"","city":"","country":"","price":"","language":"","tags":[],"artists":[],"organizer_name":"","organizer_website":"","notes_for_admin":""}]}
No markdown fences, no commentary. An empty list is a valid and honest answer when you found nothing you can stand behind.`

export type ScoutSearchResult = {
  /** Raw event objects — validated downstream by the ingest contract. */
  events: unknown[]
  /** Which model actually answered, for the run report. */
  model: string
  error?: string
}

function buildPrompt(brief: ScoutBrief, todayIso: string): string {
  const end = windowEnd(todayIso, brief.days)
  const common = [
    `Search in Albanian as well as the local language — many listings exist only in Albanian.`,
    `Report at most ${MAX_EVENTS_PER_BRIEF} events, the most clearly-documented ones first.`,
    `Every event needs a source_url you actually opened. Leave any field the source does not state as an empty string, and say what was missing in notes_for_admin.`,
  ]

  if (brief.scope === 'diaspora') {
    // "Events in Germany" would return German events. The question is the
    // Albanian community's own calendar there — a different search entirely.
    return [
      `Today is ${todayIso}.`,
      `Find events for or by the ALBANIAN COMMUNITY (diaspora) in ${brief.area}, happening between ${todayIso} and ${end} (inclusive).`,
      ``,
      `That means, for example: concerts by Albanian or Kosovar artists touring there; Albanian community, cultural or folklore festivals; Albanian film screenings; Independence Day (28 November) and Flag Day celebrations; Albanian church or mosque community gatherings; Albanian student and professional association events; Albanian-language theatre.`,
      `It does NOT mean ordinary local events that happen to be in that country. If an event has no Albanian connection, do not report it.`,
      `Good sources: Albanian community associations, Albanian embassies and consulates, diaspora media, Albanian churches/mosques, ticket sites listing Albanian artists.`,
      `Set city to the actual city the event happens in (Munich, Zurich, Brooklyn…), not the country.`,
      ...common,
    ].join('\n')
  }

  return [
    `Today is ${todayIso}.`,
    `Find public events happening in ${brief.area} between ${todayIso} and ${end} (inclusive).`,
    `If the area is a whole country, spread your search across different towns and cities rather than returning only the capital's events.`,
    `Set city to the specific town or city the event happens in, never the country or a region.`,
    ...common,
  ].join('\n')
}

/** Pull the events array out of whatever shape the model returned. Accepts both
 *  {"events":[…]} and a bare […] — models drift between the two. */
function eventsArray(parsed: unknown): unknown[] {
  if (Array.isArray(parsed)) return parsed
  if (parsed && typeof parsed === 'object') {
    const arr = (parsed as { events?: unknown }).events
    if (Array.isArray(arr)) return arr
  }
  return []
}

async function searchWith(
  provider: ScoutProvider,
  modelId: string,
  brief: ScoutBrief,
  todayIso: string,
) {
  // Each branch passes its provider's own tool object literal. A shared
  // `tools` variable can't be typed across both providers — the SDK infers a
  // tool's input schema per provider, and the two don't unify.
  const common = {
    system: SYSTEM_PROMPT,
    prompt: buildPrompt(brief, todayIso),
    maxOutputTokens: outputBudget(provider),
    abortSignal: AbortSignal.timeout(SEARCH_TIMEOUT_MS),
  }

  return provider === 'openai'
    ? generateText({
        ...common,
        model: openai(modelId),
        tools: { web_search: openai.tools.webSearch({}) },
      })
    : generateText({
        ...common,
        model: google(modelId),
        tools: { google_search: google.tools.googleSearch({}) },
      })
}

/**
 * Run one brief. Never throws: a failed search returns an empty list with the
 * reason, so one dead city can't abort the nightly run.
 */
export async function searchEventsForBrief(
  brief: ScoutBrief,
  todayIso: string,
): Promise<ScoutSearchResult> {
  const provider = resolveProvider()
  const models = modelLadder(provider)
  let lastError = 'The search model returned nothing.'

  if (provider === 'openai' && !process.env.OPENAI_API_KEY) {
    return {
      events: [],
      model: 'none',
      error: 'OPENAI_API_KEY is not set, so the scout has no way to search.',
    }
  }

  for (const modelId of models) {
    try {
      const { text, finishReason } = await searchWith(provider, modelId, brief, todayIso)
      const events = eventsArray(parseModelJson(text)).slice(0, MAX_EVENTS_PER_BRIEF)
      // A parse failure is a model problem, not a "no events" answer — try the
      // fallback model before believing the area is empty. The reply's opening
      // characters ride along in the error: when this goes wrong in production
      // that snippet is the only evidence of WHY, and it costs nothing to keep.
      if (events.length === 0 && !/\[\s*\]/.test(text) && !/"events"\s*:\s*\[\s*\]/.test(text)) {
        lastError =
          finishReason === 'length'
            ? 'The search model ran out of output budget before finishing its answer.'
            : `The search model returned an unreadable answer (${finishReason}): ${
                text.trim().slice(0, 160) || '<empty>'
              }`
        continue
      }
      return { events, model: modelId }
    } catch (err) {
      lastError = err instanceof Error ? err.message : 'The search model failed.'
      console.warn(`[scout] ${modelId} failed for ${brief.area}:`, lastError)
    }
  }

  return { events: [], model: models[models.length - 1], error: lastError }
}
