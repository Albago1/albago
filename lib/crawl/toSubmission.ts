import type { PosterReading } from '@/lib/ai/posterReader'
import type { LensResolution } from '@/lib/lens/resolve'

/**
 * AlbaGo Crawl (CRAWL-1): map a Lens reading + resolution into the exact
 * `event_submissions` row the crawler will insert (or, in a dry run, preview).
 *
 * The shape mirrors `submitCommunityEvent`'s payload in `lib/wizardSubmit.ts`
 * so the crawler and the human wizard land identical rows in the queue — with
 * two deliberate differences:
 *   1. `submitted_by_user_id: null` — no human owns a crawler find. The frozen
 *      `event_submissions` table (schema rule #8) allows this; null-submitter
 *      rows are admin-only readable by existing RLS. This is also how an admin
 *      tells a crawler row apart from a human one in the queue.
 *   2. Resolved entities win over raw text: city slug/label/country and the
 *      coordinates come from `resolvePoster`, falling back to the reading.
 *
 * `place_id` stays null — venue linking is an approval-time act, the same
 * decision Lens made. Translation packs are null here; CRAWL-3 fills them at
 * write-time via the shared `resolveAndTranslate`.
 */

export type CrawlSubmission = ReturnType<typeof crawlReadingToSubmission>

function orNull(s: string | null | undefined): string | null {
  if (s == null) return null
  const t = s.trim()
  return t.length ? t : null
}

/** Best coordinates the resolution found: a matched venue first, then a
 *  geocoded address. Null when neither is confident (never guess a location). */
function resolvedCoords(
  resolution: LensResolution | null,
): { lat: number | null; lng: number | null } {
  if (resolution?.venue.status === 'matched' && resolution.venue.place) {
    const p = resolution.venue.place
    if (p.lat != null && p.lng != null) return { lat: p.lat, lng: p.lng }
  }
  if (resolution?.geocode.status === 'address') {
    return { lat: resolution.geocode.lat ?? null, lng: resolution.geocode.lng ?? null }
  }
  return { lat: null, lng: null }
}

export function crawlReadingToSubmission(
  reading: PosterReading,
  resolution: LensResolution | null,
) {
  const isCivic = reading.is_civic
  const category = reading.category || (isCivic ? 'civic' : 'culture')

  const city = resolution?.city
  const cityMatched = city && city.status !== 'none'

  const locationSlug = (cityMatched && city.slug) || 'unknown'
  const country = orNull(cityMatched ? city.country : reading.country) ?? 'Unknown'

  // Prefer the canonical venue name from a matched place; else the raw reading;
  // else the city; else TBA — mirrors the wizard's venue fallback ladder.
  const venueName =
    (resolution?.venue.status === 'matched' && orNull(resolution.venue.place?.name)) ||
    orNull(reading.venue_name) ||
    (cityMatched ? orNull(city.label) : orNull(reading.city)) ||
    'TBA'

  const { lat, lng } = resolvedCoords(resolution)

  return {
    title: reading.title.trim(),
    // Filled at write-time by CRAWL-3 (translation); the RPC/approve flow no-op
    // on null, exactly like typed submissions.
    title_i18n: null as Record<string, string> | null,
    description_i18n: null as Record<string, string> | null,
    venue_name: venueName,
    place_id: null as string | null,
    date: reading.date,
    time: orNull(reading.time),
    end_time: orNull(reading.end_time),
    timezone: null as string | null,
    category,
    price: orNull(reading.price),
    contact_email: null as string | null,
    description: reading.description.trim(),
    country,
    region: null as string | null,
    location_slug: locationSlug,
    lat,
    lng,
    address: orNull(reading.address),
    address_hint: null as string | null,
    is_online: false,
    online_url: null as string | null,
    tags: reading.tags,
    language: reading.language || 'en',
    gallery_urls: [] as string[],
    status: 'pending' as const,
    // No human owns a crawler find. Admin-only readable by RLS.
    submitted_by_user_id: null as string | null,
    // event_submissions' CHECK only accepts civic subtypes or NULL; the crawler
    // never asserts a protest subtype, so non-null civic reads stay is_civic.
    event_type: null as string | null,
    is_civic: isCivic,
    featured_movement_slug: null as string | null,
    organizer_name: orNull(reading.organizer_name),
    organizer_contact: null as string | null,
    organizer_phone: null as string | null,
    organizer_website: orNull(reading.organizer_website),
    organizer_socials: null as Record<string, string> | null,
    telegram_link: null as string | null,
    whatsapp_link: null as string | null,
    safety_notes: null as string | null,
    expected_attendees: null as number | null,
    recurrence: reading.recurrence,
    recurrence_until: orNull(reading.recurrence_until),
    recurrence_days_of_week: reading.recurrence_days_of_week,
    recurrence_exceptions: [] as string[],
  }
}
