import { generateText } from 'ai'
import { textModel } from './textModel'
import { parseModelJson } from './parseModelJson'
import { safeFetch } from '@/lib/ssrfGuard'
import {
  coercePosterReading,
  LENS_JSON_SHAPE,
  type PosterReading,
} from './posterReader'

/**
 * AlbaGo Lens (master plan LENS-4): reads an event from a pasted URL —
 * Facebook / Instagram event links, ticket pages, any web listing — and
 * extracts the same structured event a poster photo would. The "organizer
 * migration tool": copy a link, get a prefilled submission.
 *
 * Same contract as the poster reader: extraction only, NEVER invent. A field
 * the page doesn't state comes back empty and the user fills it in the wizard.
 *
 * Reality check honored: FB/IG public pages are often login-walled or
 * JS-rendered, so their server HTML may carry only OpenGraph meta. We extract
 * from whatever signal the page exposes (OG tags, JSON-LD schema.org/Event,
 * <title>, visible text) and let the model return is_event:false / low
 * confidence when there genuinely isn't enough — the route degrades to a clear
 * "couldn't read that link, paste the text instead" rather than guessing.
 */

const MAX_HTML_BYTES = 600_000
const MAX_MODEL_CHARS = 12_000
const FETCH_TIMEOUT_MS = 8000

// A real browser UA — many hosts return a stub or 403 to non-browser agents.
const BROWSER_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
    '(KHTML, like Gecko) Chrome/124.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en,sq;q=0.9,de;q=0.8,es;q=0.7',
}

type UrlContent = {
  /** Assembled text signal handed to the model. */
  text: string
  /** og:image (absolute), offered as a possible event photo. */
  imageUrl: string | null
}

function decodeEntities(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&nbsp;/g, ' ')
}

function metaContent(html: string, property: string): string | null {
  // Handles both `property="og:x" content="..."` and the reversed order.
  const patterns = [
    new RegExp(
      `<meta[^>]+(?:property|name)=["']${property}["'][^>]+content=["']([^"']+)["']`,
      'i',
    ),
    new RegExp(
      `<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${property}["']`,
      'i',
    ),
  ]
  for (const re of patterns) {
    const m = html.match(re)
    if (m?.[1]) return decodeEntities(m[1].trim())
  }
  return null
}

function extractJsonLd(html: string): string {
  const blocks: string[] = []
  const re = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(html)) && blocks.length < 3) {
    const raw = m[1].trim()
    // Keep only event-ish blocks to save tokens.
    if (/"@type"\s*:\s*"[^"]*Event/i.test(raw) || /startDate|location|performer/i.test(raw)) {
      blocks.push(raw.slice(0, 4000))
    }
  }
  return blocks.join('\n')
}

function visibleText(html: string): string {
  return decodeEntities(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim(),
  )
}

/**
 * Fetch a URL and distill it to the signal worth handing the model. Returns
 * null on network failure, non-HTML, or an empty page.
 */
export async function fetchUrlContent(
  url: string,
  maxChars: number = MAX_MODEL_CHARS,
): Promise<UrlContent | null> {
  let res: Response
  try {
    // safeFetch re-validates every redirect hop against private IPs (SSRF).
    res = await safeFetch(url, { headers: BROWSER_HEADERS, timeoutMs: FETCH_TIMEOUT_MS })
  } catch {
    return null
  }
  if (!res.ok) return null
  const contentType = res.headers.get('content-type') ?? ''
  if (!contentType.includes('html') && !contentType.includes('xml')) return null

  const raw = await res.text()
  const html = raw.slice(0, MAX_HTML_BYTES)

  const ogTitle = metaContent(html, 'og:title')
  const ogDesc = metaContent(html, 'og:description')
  const ogImageRaw = metaContent(html, 'og:image')
  const titleTag = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim()
  const jsonLd = extractJsonLd(html)
  const body = visibleText(html)

  // og:image is often relative or protocol-relative — resolve against the
  // final URL so the client gets a loadable absolute src.
  let imageUrl: string | null = null
  if (ogImageRaw) {
    try {
      imageUrl = new URL(ogImageRaw, res.url || url).toString()
    } catch {
      imageUrl = null
    }
  }

  const parts = [
    `Source URL: ${url}`,
    ogTitle ? `OG title: ${ogTitle}` : null,
    ogDesc ? `OG description: ${ogDesc}` : null,
    titleTag ? `Page title: ${decodeEntities(titleTag)}` : null,
    jsonLd ? `Structured data (JSON-LD):\n${jsonLd}` : null,
    body ? `Page text:\n${body}` : null,
  ].filter(Boolean)

  const text = parts.join('\n\n').slice(0, maxChars)
  // Nothing usable at all — treat as unreadable.
  if (!ogTitle && !ogDesc && !jsonLd && body.length < 40) return null

  return { text, imageUrl }
}

const SYSTEM_PROMPT = `You read the text and metadata scraped from an event web page (Facebook or Instagram event, ticketing page, venue listing, news post) and extract the event as strict JSON.

Rules:
1. NEVER invent information. If the page does not state a field, return "" (or [] for lists). Wrong guesses damage trust; empty fields are fine. Ignore navigation menus, cookie banners, related-event lists, and comments — extract only the ONE main event the page is about.
2. The description must be built ONLY from the page's own text, as 1–4 clean sentences in the event's own language. No marketing additions.
3. Dates: resolve to ISO YYYY-MM-DD using the reference date you are given. If a year is missing, assume the next occurrence. Month names may be Albanian (janar, shkurt, mars, prill, maj, qershor, korrik, gusht, shtator, tetor, nëntor, dhjetor), German, Spanish, or Italian. Prefer an explicit startDate in structured data. If the event runs a range of consecutive days (startDate/endDate on different days, "22–24 August"), set date to the FIRST day, recurrence to "daily" and recurrence_until to the LAST day. If no date is readable, return "".
4. Times: 24h HH:MM. Prefer the start time over doors.
5. category: exactly one of nightlife, music, sports, culture, food, civic — or "" if unclear. Protests, marches, commemorations, civic assemblies → civic and is_civic true.
6. price: exactly as stated, including currency. Free → the page's own wording.
7. language: the event's main language as one of en, sq, de, es, it, fr (closest match).
8. tags: up to 5 lowercase single words (genre, scene, occasion).
9. artists: performer/speaker names, largest billing first.
10. is_event: false when the page is not a single event announcement (a profile page, a shop, a generic homepage, a login wall with no event data). Set confidence honestly — thin or ambiguous pages get low confidence.
11. Repetition — ONLY when the page states it, never guessed: a weekly pattern ("every Friday", "çdo të premte", "jeden Freitag", "cada viernes", schema.org repeatFrequency weekly / byDay) → recurrence "weekly" with recurrence_days_of_week as ISO numbers (1=Monday … 7=Sunday) and date = the next occurrence. "every day" / "daily" → recurrence "daily". A stated series end (endDate of a schedule, "until Sep 30") → recurrence_until as ISO date. A one-off event → recurrence "none" with empty recurrence_until and [].

Return ONLY a JSON object with exactly these keys:
${LENS_JSON_SHAPE}
No markdown fences, no commentary.`

/**
 * Extract a structured event from already-fetched page content. Returns null
 * when the model output is unusable.
 */
export async function readEventFromContent(
  content: UrlContent,
  todayIso: string,
): Promise<PosterReading | null> {
  const { text } = await generateText({
    model: textModel(),
    system: SYSTEM_PROMPT,
    prompt: `Reference date (today): ${todayIso}.\n\n${content.text}`,
    maxOutputTokens: 1600,
  })

  return coercePosterReading(parseModelJson(text))
}

/** Fetch + extract in one call. Returns the reading and the page's OG image. */
export async function readEventFromUrl(
  url: string,
  todayIso: string,
): Promise<{ reading: PosterReading; imageUrl: string | null } | null> {
  const content = await fetchUrlContent(url)
  if (!content) return null
  const reading = await readEventFromContent(content, todayIso)
  if (!reading) return null
  return { reading, imageUrl: content.imageUrl }
}

// ---------------------------------------------------------------------------
// Multi-event LIST extraction (CRAWL-1.9). A listing / "what's on" / homepage
// page describes MANY events at once; this reads the whole page and returns
// every distinct event on it — the "paste a domain, get its event list"
// behaviour. Same per-event contract as the single reader; each item is
// coerced identically so the rest of the pipeline can't tell how it arrived.
// ---------------------------------------------------------------------------

// Listing pages are long — give the model much more of the page than a single
// event page needs, so events far down the list aren't truncated away.
const LIST_MAX_CHARS = 32_000
const LIST_DEFAULT_MAX = 15

const SYSTEM_PROMPT_LIST = `You read the text and metadata scraped from an events web page (a venue "what's on" page, a promoter or ticketing listing, a culture calendar, a homepage that lists upcoming events) and extract EVERY distinct event you can see as a JSON array.

Rules:
1. NEVER invent information. If the page does not state a field for an event, return "" (or [] for lists). Wrong guesses damage trust; empty fields are fine. Ignore navigation menus, cookie banners, footers, and comments.
2. List EVERY separate upcoming event on the page, each as one object — a listing may hold many. If the page really describes only one event, return one. If there are genuinely no events, return an empty array.
3. Do NOT return the same event twice. Merge obvious duplicates (same title + date).
4. The description must be built ONLY from the page's own text for that event, 1–3 clean sentences in the event's own language. No marketing additions.
5. Dates: resolve to ISO YYYY-MM-DD using the reference date you are given. If a year is missing, assume the next occurrence. Month names may be Albanian (janar, shkurt, mars, prill, maj, qershor, korrik, gusht, shtator, tetor, nëntor, dhjetor), English, German, Spanish, or Italian. Prefer explicit startDate in structured data. Consecutive-day ranges → date = first day, recurrence "daily", recurrence_until = last day. If no date is readable for an event, return "" for its date (still include it).
6. Times: 24h HH:MM, prefer start over doors. category: exactly one of nightlife, music, sports, culture, food, civic — or "". Protests/marches/commemorations → civic, is_civic true. price: exactly as stated. language: one of en, sq, de, es, it, fr. tags: up to 5 lowercase words. artists: performer names, biggest first.
7. is_event: true for a real event; set confidence honestly per event.
8. Repetition — ONLY when stated: weekly ("every Friday", "çdo të premte", repeatFrequency weekly/byDay) → recurrence "weekly", recurrence_days_of_week as ISO numbers (1=Mon…7=Sun), date = next occurrence. "every day"/"daily" → "daily". A stated end → recurrence_until. One-off → "none", "", [].

Return ONLY a JSON object of the form {"events":[ EVENT, EVENT, ... ]} where each EVENT has exactly these keys:
${LENS_JSON_SHAPE}
No markdown fences, no commentary. Cap the array at ${LIST_DEFAULT_MAX} events (the soonest/most prominent).`

/** Pull the events array out of the model's JSON, tolerating either
 *  {"events":[…]} or a bare […]. */
function eventsArray(parsed: unknown): unknown[] {
  if (Array.isArray(parsed)) return parsed
  if (parsed && typeof parsed === 'object') {
    const events = (parsed as Record<string, unknown>).events
    if (Array.isArray(events)) return events
  }
  return []
}

/** Extract all events described on already-fetched page content. */
export async function readEventListFromContent(
  content: UrlContent,
  todayIso: string,
  max: number = LIST_DEFAULT_MAX,
): Promise<PosterReading[]> {
  const { text } = await generateText({
    model: textModel(),
    system: SYSTEM_PROMPT_LIST,
    prompt: `Reference date (today): ${todayIso}.\n\n${content.text}`,
    maxOutputTokens: 4000,
  })

  const items = eventsArray(parseModelJson(text))
  const readings: PosterReading[] = []
  for (const item of items.slice(0, max)) {
    const reading = coercePosterReading(item)
    if (reading) readings.push(reading)
  }
  return readings
}

/** Fetch a page and extract every event on it. Returns null when the page can't
 *  be fetched at all; an empty array means fetched-but-no-events-found. */
export async function readEventListFromUrl(
  url: string,
  todayIso: string,
  max: number = LIST_DEFAULT_MAX,
): Promise<{ readings: PosterReading[]; imageUrl: string | null } | null> {
  const content = await fetchUrlContent(url, LIST_MAX_CHARS)
  if (!content) return null
  const readings = await readEventListFromContent(content, todayIso, max)
  return { readings, imageUrl: content.imageUrl }
}

/**
 * Extract every event from a block of PASTED text — e.g. an events list a user
 * copied out of ChatGPT, an email, or a PDF. This is the "let a browsing AI
 * gather the messy events, then structure them here" path: it sidesteps
 * JS-rendered/login-walled sites entirely because the human already collected
 * the text. Same per-event contract and coercion as every other reader.
 */
export async function readEventListFromText(
  pastedText: string,
  todayIso: string,
  max: number = LIST_DEFAULT_MAX,
): Promise<PosterReading[]> {
  const clipped = pastedText.slice(0, LIST_MAX_CHARS)
  if (clipped.trim().length < 10) return []
  return readEventListFromContent({ text: clipped, imageUrl: null }, todayIso, max)
}
