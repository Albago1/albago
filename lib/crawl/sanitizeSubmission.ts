import type { CrawlSubmission } from './toSubmission'

/**
 * Pure sanitizer for admin-curated crawl finds (no I/O — safe in tests).
 *
 * The dry run computes a full `event_submissions` row (`CrawlSubmission`) for
 * every "would_submit" find and returns it to the admin. When the admin ticks
 * specific finds and hits "Queue selected", the client sends those exact
 * previews back — so what they reviewed is what gets queued, with no second
 * extraction (no LLM variance between preview and insert).
 *
 * Because that object round-trips through the browser it is UNTRUSTED coming
 * back: every field is re-coerced from an allow-list here before the insert
 * (defence in depth — an admin can already create events, but a malformed or
 * injected row must never reach Postgres). `status` is forced to 'pending' and
 * `place_id` to null; the submitter is stamped by the caller.
 */

type Category = CrawlSubmission['category']
type Recurrence = CrawlSubmission['recurrence']
type Language = CrawlSubmission['language']

// Kept local (not imported from posterReader) so this stays a pure, AI-free
// module that tests can load. Typed as Category[], so it can't drift to an
// invalid value — a category later ADDED to the app just falls back to
// 'culture' here until listed, which is a safe (not wrong) default.
const CATEGORY_LIST: Category[] = ['nightlife', 'music', 'sports', 'culture', 'food', 'civic']
const CATEGORIES = new Set<string>(CATEGORY_LIST)
const RECURRENCE = new Set(['none', 'daily', 'weekly'])
const LANGS = new Set(['en', 'sq', 'de', 'es', 'it', 'fr'])

function str(v: unknown, max: number): string {
  return typeof v === 'string' ? v.trim().slice(0, max) : ''
}
/** A trimmed non-empty string, or null. */
function strOrNull(v: unknown, max: number): string | null {
  const s = str(v, max)
  return s.length ? s : null
}
function numOrNull(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null
}
function bool(v: unknown): boolean {
  return v === true
}
/** Trimmed, non-empty strings only; capped in count and length. */
function strArray(v: unknown, maxItems: number, maxLen: number): string[] {
  if (!Array.isArray(v)) return []
  const out: string[] = []
  for (const item of v) {
    const s = str(item, maxLen)
    if (s) out.push(s)
    if (out.length >= maxItems) break
  }
  return out
}
/** A plain-object JSON bag (i18n packs, socials), or null. Never an array. */
function objOrNull(v: unknown): Record<string, unknown> | null {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null
}
/** Only a browser-loadable http(s) URL survives (mirrors toSubmission). */
function httpUrlOrNull(v: unknown): string | null {
  const s = strOrNull(v, 2000)
  if (!s) return null
  try {
    const u = new URL(s)
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.toString() : null
  } catch {
    return null
  }
}

export type SanitizedSubmission = CrawlSubmission

/**
 * Rebuild a safe `event_submissions` row from an untrusted client object.
 * Returns null when a hard requirement (title, valid date) is missing — the
 * queue's own NOT NULL/validation would reject it, so we surface it as a skip.
 */
export function sanitizeCrawlSubmission(
  raw: unknown,
  submittedBy: string | null,
): SanitizedSubmission | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>

  const title = str(r.title, 300)
  const date = str(r.date, 10)
  // title + a YYYY-MM-DD date are the irreducible minimum for a queue row.
  if (!title || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null

  const isCivic = bool(r.is_civic)
  const categoryRaw = str(r.category, 40).toLowerCase()
  const category = (CATEGORIES.has(categoryRaw) ? categoryRaw : isCivic ? 'civic' : 'culture') as Category
  const recurrenceRaw = str(r.recurrence, 10).toLowerCase()
  const recurrence = (RECURRENCE.has(recurrenceRaw) ? recurrenceRaw : 'none') as Recurrence
  const langRaw = str(r.language, 8).toLowerCase()
  const language = (LANGS.has(langRaw) ? langRaw : 'en') as Language

  return {
    title,
    title_i18n: objOrNull(r.title_i18n) as Record<string, string> | null,
    description_i18n: objOrNull(r.description_i18n) as Record<string, string> | null,
    venue_name: str(r.venue_name, 200) || 'TBA',
    place_id: null, // linking is an approval-time act — never trust a client place_id
    date,
    time: strOrNull(r.time, 8),
    end_time: strOrNull(r.end_time, 8),
    timezone: strOrNull(r.timezone, 60),
    category,
    price: strOrNull(r.price, 120),
    contact_email: strOrNull(r.contact_email, 200),
    description: str(r.description, 5000),
    country: str(r.country, 100) || 'Unknown',
    region: strOrNull(r.region, 100),
    location_slug: str(r.location_slug, 120) || 'unknown',
    lat: numOrNull(r.lat),
    lng: numOrNull(r.lng),
    address: strOrNull(r.address, 300),
    address_hint: strOrNull(r.address_hint, 300),
    is_online: bool(r.is_online),
    online_url: httpUrlOrNull(r.online_url),
    tags: strArray(r.tags, 12, 40),
    language,
    banner_url: httpUrlOrNull(r.banner_url),
    gallery_urls: (Array.isArray(r.gallery_urls) ? r.gallery_urls : [])
      .map((u) => httpUrlOrNull(u))
      .filter((u): u is string => !!u)
      .slice(0, 12),
    status: 'pending' as const,
    submitted_by_user_id: submittedBy,
    event_type: strOrNull(r.event_type, 40),
    is_civic: isCivic,
    featured_movement_slug: strOrNull(r.featured_movement_slug, 120),
    organizer_name: strOrNull(r.organizer_name, 200),
    organizer_contact: strOrNull(r.organizer_contact, 200),
    organizer_phone: strOrNull(r.organizer_phone, 60),
    organizer_website: httpUrlOrNull(r.organizer_website),
    organizer_socials: objOrNull(r.organizer_socials) as Record<string, string> | null,
    telegram_link: strOrNull(r.telegram_link, 300),
    whatsapp_link: strOrNull(r.whatsapp_link, 300),
    safety_notes: strOrNull(r.safety_notes, 1000),
    expected_attendees: numOrNull(r.expected_attendees),
    recurrence,
    recurrence_until: strOrNull(r.recurrence_until, 10),
    recurrence_days_of_week: (Array.isArray(r.recurrence_days_of_week) ? r.recurrence_days_of_week : [])
      .filter((d): d is number => typeof d === 'number' && d >= 1 && d <= 7)
      .slice(0, 7),
    recurrence_exceptions: strArray(r.recurrence_exceptions, 60, 10),
  }
}
