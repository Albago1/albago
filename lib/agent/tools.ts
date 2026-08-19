import { jsonSchema, tool, type ToolSet } from 'ai'
import { readEventListFromText } from '@/lib/ai/urlReader'
import { readPosterImage } from '@/lib/ai/posterReader'
import { translateEventText } from '@/lib/ai/translateEvent'
import { resolvePoster, type LensResolution } from '@/lib/lens/resolve'
import { assessReading } from '@/lib/radar/assess'
import { getEventTimezone } from '@/lib/timezone'
import { readingToDraftPatch } from '@/lib/eventDraftFromReading'
import { draftToReading } from './draftReading'
import type { EventDraft } from '@/types/eventDraftBase'

/**
 * The agent's hands.
 *
 * Every AI call in this codebase so far is `generateText()` with a prompt
 * asking for JSON, rescued by `parseModelJson` + hand-written coercion (see
 * the 2026-08-12 audit §21). Tools replace that: the model calls a typed
 * function and gets a typed result, so a malformed field is a schema error at
 * the boundary instead of a wrong event on the public site.
 *
 * Each tool wraps code that already exists and is already trusted. The agent
 * is new; the extraction, matching and assessment underneath it are not.
 */

/** Mutable per-turn state. Not a session store: Vercel gives no shared memory
 *  between invocations, so the draft travels with the request and comes back
 *  in the response. The client is the only place it lives between turns. */
export type AgentContext = {
  draft: EventDraft
  /** Reference date for "is this in the past" checks, injected for testability. */
  todayIso: string
  /** Last resolution computed this turn, so duplicate reporting is free. */
  lastResolution: LensResolution | null
  /** Names of tools called this turn — the DoD script asserts on these. */
  called: string[]
  /** Image URLs the admin attached, already uploaded to our own storage.
   *  `read_image` will read NOTHING else — see the note on that tool. */
  attachments: string[]
}

/** Fields the agent may write. Everything absent is deliberate: media and
 *  ticket tiers belong to the wizard's own steps, and slug/status/ids are
 *  never a model's business. */
type SetFieldsInput = {
  title?: string
  description?: string
  category?: string
  tags?: string[]
  language?: string
  date?: string
  end_date?: string
  time?: string
  end_time?: string
  city?: string
  country?: string
  address?: string
  address_hint?: string
  venue_name?: string
  is_online?: boolean
  online_url?: string
  price?: string
  ticket_mode?: 'none' | 'external' | 'albago'
  ticket_url?: string
  ticket_provider?: string
  organizer_name?: string
  organizer_contact?: string
  organizer_phone?: string
  organizer_website?: string
}

const SET_FIELDS_SCHEMA = jsonSchema<SetFieldsInput>({
  type: 'object',
  properties: {
    title: { type: 'string', description: 'Event title, as stated by the source.' },
    description: { type: 'string', description: 'Plain-text description.' },
    category: {
      type: 'string',
      enum: ['nightlife', 'music', 'sports', 'culture', 'food', 'civic'],
    },
    tags: { type: 'array', items: { type: 'string' }, description: 'Up to 5 short lowercase tags.' },
    language: { type: 'string', description: "ISO 639-1 of the event's own text, e.g. 'sq'." },
    date: { type: 'string', description: 'Start date, ISO YYYY-MM-DD. Never guess a year.' },
    end_date: {
      type: 'string',
      description: 'Last day, ISO YYYY-MM-DD. ONLY for a multi-day run at one venue.',
    },
    time: { type: 'string', description: 'Start time, 24h HH:MM.' },
    end_time: { type: 'string', description: 'End time, 24h HH:MM. Leave empty unless stated.' },
    city: { type: 'string', description: 'City as written by the source, e.g. "Tiranë".' },
    country: { type: 'string' },
    address: { type: 'string', description: 'Street address, without the venue name.' },
    address_hint: { type: 'string', description: 'Landmark or "how to find it" note.' },
    venue_name: { type: 'string', description: 'Venue as written, e.g. "Kino Millennium".' },
    is_online: { type: 'boolean' },
    online_url: { type: 'string' },
    price: { type: 'string', description: 'Exactly as stated, with currency: "1500 LEK", "Free".' },
    ticket_mode: {
      type: 'string',
      enum: ['none', 'external', 'albago'],
      description:
        "'external' when tickets are sold on another site (then set ticket_url). 'albago' is set up in the wizard, not here.",
    },
    ticket_url: { type: 'string', description: 'Where people buy. Must be http(s).' },
    ticket_provider: { type: 'string', description: 'Who sells them, e.g. "Eventbrite".' },
    organizer_name: { type: 'string' },
    organizer_contact: { type: 'string', description: 'Contact email.' },
    organizer_phone: { type: 'string' },
    organizer_website: { type: 'string' },
  },
  additionalProperties: false,
})

/** Apply only the keys the model actually sent, so a partial call can never
 *  blank a field somebody already filled. */
function applyFields(draft: EventDraft, input: SetFieldsInput): string[] {
  const changed: string[] = []
  for (const [key, value] of Object.entries(input)) {
    if (value === undefined || value === null) continue
    if (typeof value === 'string' && value.trim() === '') continue
    ;(draft as unknown as Record<string, unknown>)[key] = value
    changed.push(key)
  }
  return changed
}

/**
 * Fill only what's still empty. Used by extraction tools so a re-read of the
 * source can never overwrite an answer the human just gave in conversation —
 * the most important invariant in this file, and the reason it's exported:
 * `scripts/agent-test.mjs` asserts it without needing a live model.
 */
export function fillEmpty(draft: EventDraft, patch: Partial<EventDraft>): string[] {
  const filled: string[] = []
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined || value === null) continue
    if (typeof value === 'string' && value.trim() === '') continue
    if (Array.isArray(value) && value.length === 0) continue
    const current = (draft as unknown as Record<string, unknown>)[key]
    const isEmpty =
      current === '' ||
      current === null ||
      current === undefined ||
      (Array.isArray(current) && current.length === 0)
    if (!isEmpty) continue
    ;(draft as unknown as Record<string, unknown>)[key] = value
    filled.push(key)
  }
  return filled
}

function missingSummary(ctx: AgentContext) {
  const assessment = assessReading(
    draftToReading(ctx.draft),
    ctx.lastResolution,
    ctx.todayIso,
  )
  return {
    missing: assessment.missingFields,
    warnings: assessment.warnings.map((w) => w.message),
    confidence: assessment.confidence,
  }
}

export function createAgentTools(ctx: AgentContext): ToolSet {
  const note = (name: string) => ctx.called.push(name)

  return {
    set_fields: tool({
      description:
        'Write one or more fields onto the event draft. Only send fields you actually know — never invent a value to fill a gap.',
      inputSchema: SET_FIELDS_SCHEMA,
      execute: async (input: SetFieldsInput) => {
        note('set_fields')
        const changed = applyFields(ctx.draft, input)
        return { changed, ...missingSummary(ctx) }
      },
    }),

    read_text: tool({
      description:
        'Extract an event from a block of pasted text (a WhatsApp forward, an email, a social post). Fills only empty draft fields and reports what is still missing.',
      inputSchema: jsonSchema<{ text: string }>({
        type: 'object',
        properties: { text: { type: 'string', description: 'The raw pasted text.' } },
        required: ['text'],
        additionalProperties: false,
      }),
      execute: async ({ text }: { text: string }) => {
        note('read_text')
        const readings = await readEventListFromText(text, ctx.todayIso, 1)
        const reading = readings[0]
        if (!reading || !reading.is_event) {
          return { ok: false, reason: 'No event could be read from that text.' }
        }
        const filled = fillEmpty(ctx.draft, readingToDraftPatch(reading))
        return { ok: true, filled, ...missingSummary(ctx) }
      },
    }),

    read_image: tool({
      description:
        'Read an event poster the admin attached. Pass the exact image URL from their message. Fills only empty draft fields; if the poster contradicts something already in the draft, say so and ask — never silently overwrite.',
      inputSchema: jsonSchema<{ url: string }>({
        type: 'object',
        properties: {
          url: { type: 'string', description: 'The attached image URL, copied exactly.' },
        },
        required: ['url'],
        additionalProperties: false,
      }),
      execute: async ({ url }: { url: string }) => {
        note('read_image')
        // The model chooses this argument, so it is untrusted input to a
        // server-side fetch. Restricting it to images WE uploaded this turn
        // closes that door completely — no SSRF surface, no way to be talked
        // into fetching something else.
        if (!ctx.attachments.includes(url)) {
          return { ok: false, reason: 'That image is not attached to this conversation.' }
        }
        try {
          const res = await fetch(url)
          if (!res.ok) return { ok: false, reason: 'The image could not be loaded.' }
          const mediaType = (res.headers.get('content-type') ?? 'image/jpeg').split(';')[0].trim()
          const bytes = new Uint8Array(await res.arrayBuffer())
          const scan = await readPosterImage(bytes, ctx.todayIso, mediaType)
          if (!scan) return { ok: false, reason: 'The poster could not be read.' }
          if (!scan.reading.is_event) {
            return { ok: false, reason: "That image doesn't look like an event announcement." }
          }

          // Report what the poster says but the draft already contradicts, so
          // the agent can ask instead of picking a winner silently.
          const patch = readingToDraftPatch(scan.reading)
          const conflicts: Array<{ field: string; draft: string; poster: string }> = []
          for (const [key, value] of Object.entries(patch)) {
            if (typeof value !== 'string' || !value.trim()) continue
            const current = (ctx.draft as unknown as Record<string, unknown>)[key]
            if (typeof current === 'string' && current.trim() && current.trim() !== value.trim()) {
              conflicts.push({ field: key, draft: current, poster: value })
            }
          }

          const filled = fillEmpty(ctx.draft, patch)
          return { ok: true, filled, conflicts, ...missingSummary(ctx) }
        } catch {
          return { ok: false, reason: 'The image could not be read.' }
        }
      },
    }),

    /**
     * One tool, not two. The plan listed `resolve_location` and
     * `check_duplicate` separately, but `resolvePoster` computes city, venue,
     * geocode AND duplicate in a single pass — splitting them would mean
     * either running it twice or holding hidden state between calls. Fewer,
     * fatter tools also measurably improve model tool-choice.
     */
    resolve_location: tool({
      description:
        "Match the draft's city and venue against AlbaGo's real places, get coordinates, and check whether this event is already on the site. Call this once the venue or city is known, and tell the user what matched.",
      inputSchema: jsonSchema<Record<string, never>>({
        type: 'object',
        properties: {},
        additionalProperties: false,
      }),
      execute: async () => {
        note('resolve_location')
        const resolution = await resolvePoster(draftToReading(ctx.draft))
        ctx.lastResolution = resolution

        if (resolution.city.status !== 'none') {
          ctx.draft.location_slug = resolution.city.slug
          ctx.draft.city = resolution.city.label
          if (resolution.city.country) ctx.draft.country = resolution.city.country
          if (resolution.city.region) ctx.draft.region = resolution.city.region
        }
        const place = resolution.venue.status === 'matched' ? resolution.venue.place : null
        if (place) {
          ctx.draft.venue_name = place.name
          ctx.draft.location_slug = place.location_slug
          if (place.address) ctx.draft.address = place.address
          if (place.lat != null) ctx.draft.lat = place.lat
          if (place.lng != null) ctx.draft.lng = place.lng
        } else if (resolution.geocode.status === 'address') {
          if (resolution.geocode.lat != null) ctx.draft.lat = resolution.geocode.lat
          if (resolution.geocode.lng != null) ctx.draft.lng = resolution.geocode.lng
          if (resolution.geocode.formatted) ctx.draft.address = resolution.geocode.formatted
        }

        const tz = getEventTimezone(ctx.draft.location_slug, ctx.draft.country)
        if (tz !== 'UTC') ctx.draft.timezone = tz

        return {
          city: { status: resolution.city.status, label: resolution.city.label },
          venue: {
            status: resolution.venue.status,
            // 'matched' = linked; 'suggested' = a near miss the human must confirm.
            name: resolution.venue.place?.name ?? null,
          },
          coordinates: ctx.draft.lat != null && ctx.draft.lng != null ? 'set' : 'unknown',
          duplicate: {
            status: resolution.duplicate.status,
            existing: resolution.duplicate.event?.title ?? null,
            slug: resolution.duplicate.event?.slug ?? null,
          },
          ...missingSummary(ctx),
        }
      },
    }),

    translate: tool({
      description:
        'Translate the finished title and description into all four AlbaGo languages. Call this only once the text is final.',
      inputSchema: jsonSchema<Record<string, never>>({
        type: 'object',
        properties: {},
        additionalProperties: false,
      }),
      execute: async () => {
        note('translate')
        if (!ctx.draft.title.trim()) return { ok: false, reason: 'No title to translate yet.' }
        const packs = await translateEventText({
          title: ctx.draft.title,
          description: ctx.draft.description,
          sourceLanguage: ctx.draft.language,
        })
        if (!packs) return { ok: false, reason: 'Translation failed; the original text stands.' }
        ctx.draft.title_i18n = packs.title
        ctx.draft.description_i18n = packs.description
        return { ok: true, languages: Object.keys(packs.title) }
      },
    }),

    summarize_draft: tool({
      description:
        "What the draft currently holds, what's still missing, and what looks wrong. Call before telling the user it's ready.",
      inputSchema: jsonSchema<Record<string, never>>({
        type: 'object',
        properties: {},
        additionalProperties: false,
      }),
      execute: async () => {
        note('summarize_draft')
        const d = ctx.draft
        return {
          draft: {
            title: d.title,
            date: d.date,
            end_date: d.end_date,
            time: d.time,
            end_time: d.end_time,
            venue_name: d.venue_name,
            city: d.city,
            country: d.country,
            address: d.address,
            category: d.category,
            price: d.price,
            ticket_mode: d.ticket_mode,
            ticket_url: d.ticket_url,
            organizer_name: d.organizer_name,
            organizer_contact: d.organizer_contact,
            is_civic: d.is_civic,
            has_translations: d.title_i18n !== null,
          },
          ...missingSummary(ctx),
        }
      },
    }),
  }
}
