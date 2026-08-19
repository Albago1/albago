import { LENS_CATEGORIES, type PosterReading } from '@/lib/ai/posterReader'
import type { EventDraft } from '@/types/eventDraftBase'

/**
 * A wizard draft, viewed as a PosterReading.
 *
 * The inverse of `readingToDraftPatch`. Radar and Lens both go reading →
 * draft; the agent needs the other direction, because the tools that make its
 * answers good — `resolvePoster` (city, venue, coordinates, duplicates) and
 * `assessReading` (what's missing, what looks wrong) — were written against a
 * reading, and reusing them beats writing draft-shaped copies that drift.
 *
 * Lossy on purpose: `artists` has no draft home (it's folded into the
 * description at read time) and confidence is meaningless for a
 * human-supervised draft, so both get inert values.
 */

const LENS_LANGUAGES = ['en', 'sq', 'de', 'es', 'it', 'fr'] as const

function asCategory(value: string): PosterReading['category'] {
  const lower = value.trim().toLowerCase()
  return (LENS_CATEGORIES as readonly string[]).includes(lower)
    ? (lower as PosterReading['category'])
    : ''
}

function asLanguage(value: string): PosterReading['language'] {
  const lower = value.trim().toLowerCase()
  return (LENS_LANGUAGES as readonly string[]).includes(lower)
    ? (lower as PosterReading['language'])
    : 'en'
}

export function draftToReading(draft: EventDraft): PosterReading {
  return {
    is_event: true,
    confidence: 1,
    title: draft.title,
    description: draft.description,
    category: draft.is_civic || draft.event_type === 'protest' ? 'civic' : asCategory(draft.category),
    is_civic: draft.is_civic || draft.event_type === 'protest',
    date: draft.date,
    time: draft.time,
    end_time: draft.end_time,
    venue_name: draft.venue_name,
    address: draft.address,
    city: draft.city,
    country: draft.country,
    price: draft.price,
    language: asLanguage(draft.language),
    tags: draft.tags,
    artists: [],
    organizer_name: draft.organizer_name,
    organizer_website: draft.organizer_website,
    recurrence: draft.recurrence,
    recurrence_until: draft.recurrence_until,
    recurrence_days_of_week: draft.recurrence_days_of_week,
  }
}
