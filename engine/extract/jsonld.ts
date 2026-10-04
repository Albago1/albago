import { emptyExtraction, type ExtractionV1 } from './extraction'

/**
 * Deterministic schema.org/Event reader. JSON-LD is treated as INPUT TO
 * VERIFY, not truth: real sources publish broken data (almanart.al: an event
 * starting 2026-10-24 01:00 that "ends" 2026-10-23; price "0" on events that
 * are not free). Problems are recorded in `issues` and the bad value dropped.
 */

type Json = Record<string, unknown>

const isObj = (v: unknown): v is Json => typeof v === 'object' && v !== null && !Array.isArray(v)
const str = (v: unknown): string | null => {
  if (typeof v === 'string') return v.trim() || null
  if (typeof v === 'number') return String(v)
  return null
}
const decode = (s: string | null) =>
  s
    ? s
        .replace(/&#8220;|&#8221;|&quot;/g, '"')
        .replace(/&#8217;|&#039;|&#39;/g, "'")
        .replace(/&amp;/g, '&')
        .trim()
    : null

function typesOf(node: Json): string[] {
  const t = node['@type']
  return (Array.isArray(t) ? t : [t]).filter((x): x is string => typeof x === 'string')
}

/** All schema.org Event nodes in the page's JSON-LD (incl. @graph and arrays). */
export function findJsonLdEvents(blocks: unknown[]): Json[] {
  const out: Json[] = []
  const walk = (v: unknown, depth: number) => {
    if (depth > 6 || out.length >= 20) return
    if (Array.isArray(v)) return v.forEach((x) => walk(x, depth + 1))
    if (!isObj(v)) return
    if (typesOf(v).some((t) => /Event$/.test(t))) out.push(v)
    if (v['@graph']) walk(v['@graph'], depth + 1)
  }
  blocks.forEach((b) => walk(b, 0))
  return out
}

/** "2026-10-24T01:00:00+02:00" → wall-clock date + time as written by the source. */
export function splitIsoDateTime(raw: string | null): { date: string | null; time: string | null } {
  if (!raw) return { date: null, time: null }
  const m = raw.match(/^(\d{4}-\d{2}-\d{2})(?:[T ](\d{2}):(\d{2}))?/)
  if (!m) return { date: null, time: null }
  const date = m[1]
  const time = m[2] != null ? `${m[2]}:${m[3]}` : null
  // A bare midnight on a date-only event is how many CMSs write "no time".
  return { date, time }
}

function placeOf(location: unknown): { name: string | null; address: string | null; locality: string | null; country: string | null } {
  const loc = Array.isArray(location) ? location[0] : location
  if (typeof loc === 'string') return { name: decode(loc), address: null, locality: null, country: null }
  if (!isObj(loc)) return { name: null, address: null, locality: null, country: null }
  const addr = loc.address
  if (typeof addr === 'string') return { name: decode(str(loc.name)), address: decode(addr), locality: null, country: null }
  const a = isObj(addr) ? addr : {}
  const country = isObj(a.addressCountry) ? str(a.addressCountry.name) : str(a.addressCountry)
  return {
    name: decode(str(loc.name)),
    address: decode(str(a.streetAddress)),
    locality: decode(str(a.addressLocality)),
    country: decode(country),
  }
}

function namesOf(v: unknown): string[] {
  const arr = Array.isArray(v) ? v : v == null ? [] : [v]
  return arr
    .map((x) => (isObj(x) ? str(x.name) : str(x)))
    .map(decode)
    .filter((x): x is string => !!x)
}

// schema.org Event sub-types → engine taxonomy (deterministic; generic "Event" stays null).
const SCHEMA_TYPES: Record<string, NonNullable<ExtractionV1['event_type']>> = {
  MusicEvent: 'concert',
  TheaterEvent: 'theatre',
  ComedyEvent: 'comedy',
  ScreeningEvent: 'film',
  ExhibitionEvent: 'exhibition',
  VisualArtsEvent: 'exhibition',
  SportsEvent: 'sports_match',
  Festival: 'festival',
  FoodEvent: 'food_drink',
  ChildrensEvent: 'family',
  EducationEvent: 'talk_workshop',
  BusinessEvent: 'talk_workshop',
  LiteraryEvent: 'talk_workshop',
  DanceEvent: 'club_night',
  SocialEvent: 'party_social',
  SaleEvent: 'market_fair',
}

const STATUS: Record<string, ExtractionV1['status']> = {
  EventScheduled: 'scheduled',
  EventCancelled: 'cancelled',
  EventPostponed: 'postponed',
  EventRescheduled: 'rescheduled',
  EventMovedOnline: 'scheduled',
}

/** Read one schema.org Event node into an extraction. */
export function extractFromJsonLdEvent(node: Json): ExtractionV1 {
  const x = emptyExtraction()
  const stated = (field: keyof ExtractionV1) => {
    x.field_status[field] = 'stated'
  }
  x.is_event = true
  const schemaType = typesOf(node).map((t) => SCHEMA_TYPES[t]).find(Boolean)
  if (schemaType) {
    x.event_type = schemaType
    x.field_status.event_type = 'derived'
  }

  x.title = decode(str(node.name))
  if (x.title) stated('title')
  x.description = decode(str(node.description))
  if (x.description) stated('description')

  const start = splitIsoDateTime(str(node.startDate))
  const end = splitIsoDateTime(str(node.endDate))
  if (start.date) {
    x.start_date = start.date
    stated('start_date')
    if (start.time) {
      x.start_time = start.time
      stated('start_time')
    }
  }
  if (end.date) {
    const endKey = `${end.date} ${end.time ?? '99:99'}`
    const startKey = `${start.date ?? ''} ${start.time ?? '00:00'}`
    if (start.date && endKey < startKey) {
      x.issues.push('jsonld_end_before_start')
    } else {
      x.end_date = end.date
      stated('end_date')
      if (end.time) {
        x.end_time = end.time
        stated('end_time')
      }
    }
  }

  const statusKey = (str(node.eventStatus) ?? '').split('/').pop() ?? ''
  if (STATUS[statusKey]) {
    x.status = STATUS[statusKey]
    stated('status')
  }

  const place = placeOf(node.location)
  x.venue_name = place.name
  x.address = place.address
  x.locality = place.locality
  x.country = place.country
  for (const k of ['venue_name', 'address', 'locality', 'country'] as const) if (x[k]) stated(k)

  x.organizer_name = namesOf(node.organizer)[0] ?? null
  if (x.organizer_name) stated('organizer_name')
  x.performers = namesOf(node.performer)
  if (x.performers.length) stated('performers')

  const offer = (Array.isArray(node.offers) ? node.offers[0] : node.offers) as unknown
  if (isObj(offer)) {
    const price = str(offer.price) ?? str(offer.lowPrice)
    const currency = str(offer.priceCurrency)
    const amount = price != null ? Number(price.replace(',', '.')) : NaN
    if (!Number.isNaN(amount) && amount > 0) {
      x.price_min = amount
      x.price_currency = currency
      x.price_text = currency ? `${price} ${currency}` : price
      stated('price_min')
    } else if (!Number.isNaN(amount) && amount === 0) {
      // Many CMS plugins emit price "0" by default; "free" must be stated in words.
      x.issues.push('jsonld_zero_price_unverified')
    }
    const url = str(offer.url)
    if (url && /^https?:\/\//.test(url)) {
      x.ticket_url = url
      stated('ticket_url')
    }
  }

  const image = Array.isArray(node.image) ? node.image[0] : node.image
  const imageUrl = isObj(image) ? str(image.url) : str(image)
  if (imageUrl && /^https?:\/\//.test(imageUrl)) {
    x.image_url = imageUrl
    stated('image_url')
  }

  return x
}
