import { generateText, type ModelMessage } from 'ai'
import { textModel } from './textModel'
import { parseModelJson } from './parseModelJson'

/**
 * AlbaGo Lens (master plan LENS-1): reads a photo of a physical event poster
 * and extracts a structured event draft. Extraction only — the result feeds
 * the normal submission wizard + moderation queue, never publishes directly.
 *
 * Contract rule #1: NEVER invent facts. A field the poster doesn't state
 * comes back empty and the user fills it in the wizard.
 */

export const LENS_CATEGORIES = [
  'nightlife',
  'music',
  'sports',
  'culture',
  'food',
  'civic',
] as const

const LENS_LANGUAGES = ['en', 'sq', 'de', 'es', 'it', 'fr'] as const

export type PosterReading = {
  /** True when the photo is actually an announcement of an event. */
  is_event: boolean
  /** 0..1 — overall reading confidence. */
  confidence: number
  title: string
  description: string
  category: (typeof LENS_CATEGORIES)[number] | ''
  is_civic: boolean
  /** ISO YYYY-MM-DD, or '' when the poster doesn't state a resolvable date. */
  date: string
  /** HH:MM 24h, or ''. */
  time: string
  end_time: string
  venue_name: string
  address: string
  city: string
  country: string
  /** Price exactly as printed ("500 lekë", "Free entry"), or ''. */
  price: string
  /** ISO 639-1 of the poster's main language. */
  language: (typeof LENS_LANGUAGES)[number]
  tags: string[]
  artists: string[]
  organizer_name: string
  organizer_website: string
}

/** The exact JSON contract every Lens extractor (photo or URL) must return.
 *  Shared so the poster reader and the URL reader stay in lockstep. */
export const LENS_JSON_SHAPE =
  '{"is_event":bool,"confidence":0..1,"title":"","description":"","category":"","is_civic":bool,"date":"","time":"","end_time":"","venue_name":"","address":"","city":"","country":"","price":"","language":"","tags":[],"artists":[],"organizer_name":"","organizer_website":""}'

const SYSTEM_PROMPT = `You read photographs of real-world event posters (street posters, flyers, banners, screens) and extract the event as strict JSON.

Rules:
1. NEVER invent information. If the poster does not state a field, return "" (or [] for lists). Wrong guesses damage trust; empty fields are fine.
2. The description must be composed ONLY from text visible on the poster, written as 1–4 clean sentences in the poster's own language. No marketing additions.
3. Dates: resolve to ISO YYYY-MM-DD using the reference date you are given. Posters often omit the year — assume the next occurrence (if the day/month already passed this year, use next year). Month names may be Albanian (janar, shkurt, mars, prill, maj, qershor, korrik, gusht, shtator, tetor, nëntor, dhjetor), German, Spanish, or Italian. If a date range is shown, use the first day and mention the range in the description. If no date is readable, return "".
4. Times: 24h HH:MM. "21:00", "9 PM" → "21:00". Doors vs start: prefer the start time; if only doors, use it.
5. category: exactly one of nightlife, music, sports, culture, food, civic — or "" if unclear. Protests, marches, commemorations, civic assemblies → civic and is_civic true.
6. price: exactly as printed, including currency word. Free entry → the poster's own wording.
7. language: the poster's main language as one of en, sq, de, es, it, fr (closest match).
8. tags: up to 5 lowercase single words drawn from the poster (genre, scene, occasion).
9. artists: performer/speaker names printed on the poster, largest billing first.
10. is_event: false when the photo is not an event announcement (product ad, menu, street scene, document...). Set confidence honestly — blur, glare, partial framing lower it.

Return ONLY a JSON object with exactly these keys:
{"is_event":bool,"confidence":0..1,"title":"","description":"","category":"","is_civic":bool,"date":"","time":"","end_time":"","venue_name":"","address":"","city":"","country":"","price":"","language":"","tags":[],"artists":[],"organizer_name":"","organizer_website":""}
No markdown fences, no commentary.`

function str(value: unknown, max = 400): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : ''
}

function strList(value: unknown, maxItems: number, maxLen = 80): string[] {
  if (!Array.isArray(value)) return []
  return value
    .filter((v): v is string => typeof v === 'string')
    .map((v) => v.trim().slice(0, maxLen))
    .filter(Boolean)
    .slice(0, maxItems)
}

/** Validate + clamp a raw model object into a safe PosterReading, or null.
 *  Exported so the URL reader coerces identically to the photo reader. */
export function coercePosterReading(raw: unknown): PosterReading | null {
  if (typeof raw !== 'object' || raw === null) return null
  const r = raw as Record<string, unknown>

  const category = str(r.category, 20).toLowerCase()
  const language = str(r.language, 5).toLowerCase()
  const date = str(r.date, 10)
  const time = str(r.time, 5)
  const endTime = str(r.end_time, 5)
  const confidence = typeof r.confidence === 'number' ? r.confidence : 0

  return {
    is_event: r.is_event === true,
    confidence: Math.min(1, Math.max(0, confidence)),
    title: str(r.title, 160),
    description: str(r.description, 1500),
    category: (LENS_CATEGORIES as readonly string[]).includes(category)
      ? (category as PosterReading['category'])
      : '',
    is_civic: r.is_civic === true || category === 'civic',
    date: /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : '',
    time: /^\d{2}:\d{2}$/.test(time) ? time : '',
    end_time: /^\d{2}:\d{2}$/.test(endTime) ? endTime : '',
    venue_name: str(r.venue_name, 120),
    address: str(r.address, 200),
    city: str(r.city, 80),
    country: str(r.country, 80),
    price: str(r.price, 60),
    language: (LENS_LANGUAGES as readonly string[]).includes(language)
      ? (language as PosterReading['language'])
      : 'en',
    tags: strList(r.tags, 5, 30).map((t) => t.toLowerCase()),
    artists: strList(r.artists, 10),
    organizer_name: str(r.organizer_name, 120),
    organizer_website: str(r.organizer_website, 200),
  }
}

/**
 * Read one poster photo. Returns null when the model output is unusable
 * (the route maps that to an "unreadable" error, distinct from is_event:false).
 */
export async function readPosterImage(
  image: Uint8Array,
  todayIso: string,
  mediaType = 'image/jpeg',
): Promise<PosterReading | null> {
  const messages: ModelMessage[] = [
    {
      role: 'user',
      content: [
        {
          type: 'text' as const,
          text: `Reference date (today): ${todayIso}. Extract the event from this poster photo.`,
        },
        { type: 'file' as const, mediaType, data: image },
      ],
    },
  ]

  const { text } = await generateText({
    model: textModel(),
    system: SYSTEM_PROMPT,
    messages,
    maxOutputTokens: 1600,
  })

  return coercePosterReading(parseModelJson(text))
}
