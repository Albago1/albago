import { getEventTimezone } from '@/lib/timezone'
import { defaultEventDraft, type EventDraft } from '@/types/eventDraft'
import type { PosterReading } from '@/lib/ai/posterReader'
import type { LensResolution, LensResolvedPlace } from '@/lib/lens/resolve'
import type { EventTranslation } from '@/lib/ai/translateEvent'

/**
 * One extraction → one wizard draft.
 *
 * A poster photo (Lens) and an imported URL (Radar) produce the exact same two
 * objects — a `PosterReading` and a `LensResolution` — because both call
 * `readEventFrom*` + `resolvePoster`. So both fill the SAME creation wizard,
 * from this one conversion. Adding a third reader later means writing no new
 * form: produce a reading, call this, seed the draft.
 *
 * Pure and UI-free on purpose: the browser (Lens) and the Radar review screen
 * both import it, and neither owns it.
 */

/** The shared localStorage key the creation wizard hydrates from. */
export const DRAFT_STORAGE_KEY = 'albago:event-draft:v1'

/** Raw reading → draft fields, before any resolution is layered on. */
export function readingToDraftPatch(reading: PosterReading): Partial<EventDraft> {
  const isCivic = reading.is_civic || reading.category === 'civic'
  const description =
    reading.artists.length > 1
      ? `${reading.description}\n\nLineup: ${reading.artists.join(', ')}`
      : reading.description
  return {
    event_type: isCivic ? 'protest' : 'event',
    is_civic: isCivic,
    category: isCivic ? 'civic' : reading.category,
    title: reading.title,
    description: description.trim(),
    tags: reading.tags,
    language: reading.language,
    date: reading.date,
    time: reading.time,
    end_time: reading.end_time,
    city: reading.city,
    country: reading.country,
    address: reading.address,
    venue_name: reading.venue_name,
    price: reading.price,
    organizer_name: reading.organizer_name,
    organizer_website: reading.organizer_website,
    recurrence: reading.recurrence,
    recurrence_until: reading.recurrence_until,
    recurrence_days_of_week: reading.recurrence_days_of_week,
  }
}

/**
 * Overlay the LENS-2 resolution onto the raw reading patch: a resolved city
 * fills location_slug + canonical label, an auto-matched (or user-accepted)
 * venue fills the venue's canonical name + coordinates, and a geocoded
 * address supplies coordinates when no venue was linked. Place linking
 * itself stays an approval-time act — the draft carries no place_id.
 */
export function resolvedDraftPatch(
  reading: PosterReading,
  resolution: LensResolution | null,
  acceptedPlace: LensResolvedPlace | null,
  translation: EventTranslation | null,
): Partial<EventDraft> {
  const patch = readingToDraftPatch(reading)

  // LENS-3: carry the 4-language packs into the draft so they persist through
  // submission. The wizard's base title/description stay the source of truth
  // and the fallback; these only enrich.
  if (translation) {
    patch.title_i18n = translation.title
    patch.description_i18n = translation.description
  }

  if (resolution) {
    if (resolution.city.status !== 'none') {
      patch.location_slug = resolution.city.slug
      patch.city = resolution.city.label
      if (resolution.city.country) patch.country = resolution.city.country
      if (resolution.city.region) patch.region = resolution.city.region
    }

    const place =
      resolution.venue.status === 'matched'
        ? resolution.venue.place
        : (acceptedPlace ?? undefined)

    if (place) {
      patch.venue_name = place.name
      patch.location_slug = place.location_slug
      if (place.address) patch.address = place.address
      if (place.city) patch.city = place.city
      if (place.lat != null) patch.lat = place.lat
      if (place.lng != null) patch.lng = place.lng
    } else if (resolution.geocode.status === 'address') {
      if (resolution.geocode.lat != null) patch.lat = resolution.geocode.lat
      if (resolution.geocode.lng != null) patch.lng = resolution.geocode.lng
      if (resolution.geocode.formatted) patch.address = resolution.geocode.formatted
    }
  }

  // Derive the event's timezone from the resolved location so a Berlin poster
  // doesn't keep the draft default (Europe/Tirane). Unmapped locations return
  // 'UTC' — leave the default in place rather than prefill a worse guess.
  const tz = getEventTimezone(patch.location_slug, patch.country)
  if (tz !== 'UTC') patch.timezone = tz

  return patch
}

/**
 * Full draft from an extraction, ready to hand to the wizard.
 *
 * `coverUrl` must already live in our own storage — a hotlink to the source
 * site would break the moment they rotate the file, so Radar adopts the image
 * first and passes the adopted URL here. The wizard treats gallery_urls[0] as
 * the cover, which is what `submitAdminEvent` publishes as banner_url.
 */
export function draftFromReading(args: {
  reading: PosterReading
  resolution: LensResolution | null
  acceptedPlace?: LensResolvedPlace | null
  translation?: EventTranslation | null
  coverUrl?: string | null
  sourceUrl?: string | null
}): EventDraft {
  const {
    reading,
    resolution,
    acceptedPlace = null,
    translation = null,
    coverUrl,
    sourceUrl,
  } = args

  // A priced event read off a real page is almost always sold on that page, so
  // open the wizard on "sold somewhere else" pointing there. It's a default,
  // not a decision — the ticket step shows the link for the admin to confirm,
  // change, or switch away from entirely.
  const externalTickets =
    sourceUrl && /^https?:\/\//i.test(sourceUrl) && reading.price.trim()
      ? { ticket_mode: 'external' as const, ticket_url: sourceUrl }
      : {}

  return {
    ...defaultEventDraft,
    ...resolvedDraftPatch(reading, resolution, acceptedPlace, translation),
    ...externalTickets,
    ...(coverUrl ? { gallery_urls: [coverUrl] } : {}),
  }
}

/**
 * Seed the wizard and return. Callers navigate to a wizard route afterwards;
 * the wizard hydrates this key on mount. Storage being unavailable is not an
 * error worth blocking on — the wizard simply starts empty.
 */
export function seedWizardDraft(draft: EventDraft): void {
  try {
    window.localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft))
  } catch {
    // Storage unavailable — the wizard simply starts empty.
  }
}

/** Which import a seeded draft came from, so publishing can close its loop. */
export type DraftOrigin = {
  candidateId: string
  sourceUrl: string | null
}

const ORIGIN_STORAGE_KEY = 'albago:event-draft-origin:v1'

export function seedDraftOrigin(origin: DraftOrigin): void {
  try {
    window.localStorage.setItem(ORIGIN_STORAGE_KEY, JSON.stringify(origin))
  } catch {
    // No origin recorded — the event publishes without its source stamp.
  }
}

/**
 * Read the origin back, but only for the candidate the URL says we're
 * finishing. The `?cid=` param proves this navigation came from the handoff,
 * so an abandoned import can't stamp its source onto an unrelated event
 * someone starts later from a blank wizard.
 */
export function readDraftOrigin(expectedCandidateId: string | null): DraftOrigin | null {
  if (!expectedCandidateId) return null
  try {
    const raw = window.localStorage.getItem(ORIGIN_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<DraftOrigin> | null
    if (!parsed || parsed.candidateId !== expectedCandidateId) return null
    return {
      candidateId: parsed.candidateId,
      sourceUrl: typeof parsed.sourceUrl === 'string' ? parsed.sourceUrl : null,
    }
  } catch {
    return null
  }
}

export function clearDraftOrigin(): void {
  try {
    window.localStorage.removeItem(ORIGIN_STORAGE_KEY)
  } catch {
    // Nothing to clean up.
  }
}
