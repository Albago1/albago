import { describe, expect, it } from 'vitest'
import {
  countryToIso,
  distillPage,
  extractFromJsonLdEvent,
  findJsonLdEvents,
  normalizeDate,
  normalizeTime,
  parsePrice,
  splitIsoDateTime,
} from '@/engine'

// Shape of the real almanart.al JSON-LD for the Frekuence Club night
// (probed 2026-10-04), including its two known defects.
const ALMANART_EVENT = {
  '@context': 'https://schema.org',
  '@type': 'Event',
  name: 'DJ Kabay, DJ Leo Lumezi, DJ FRNS te &#8220;Frekuence Club&#8221; Tiranë',
  startDate: '2026-10-24T01:00:00+02:00',
  endDate: '2026-10-23',
  eventStatus: 'https://schema.org/EventScheduled',
  location: { '@type': 'Place', name: '"Frekuence Club", Tiranë', address: 'Fari, Liqeni Artificial, Tiranë' },
  offers: { url: 'https://www.almanart.al/events/x/', price: '0', priceCurrency: 'ALL' },
  organizer: { '@type': 'Person', name: '"Frekuence Club"' },
  performer: '',
  image: 'https://www.almanart.al/wp-content/uploads/2026/10/Frekuence-Club.webp',
}

describe('JSON-LD reader (verify, never trust)', () => {
  it('finds Event nodes inside @graph and arrays', () => {
    const blocks = [{ '@graph': [{ '@type': 'WebPage' }, { '@type': 'MusicEvent', name: 'A' }] }, [{ '@type': 'Event', name: 'B' }]]
    expect(findJsonLdEvents(blocks).map((e) => e.name)).toEqual(['A', 'B'])
  })

  it('reads the almanart event, keeps the stated start, drops the impossible end and the default 0 price', () => {
    const x = extractFromJsonLdEvent(ALMANART_EVENT)
    expect(x.title).toBe('DJ Kabay, DJ Leo Lumezi, DJ FRNS te "Frekuence Club" Tiranë')
    expect(x.start_date).toBe('2026-10-24')
    expect(x.start_time).toBe('01:00')
    expect(x.end_date).toBeNull()
    expect(x.issues).toContain('jsonld_end_before_start')
    expect(x.price_min).toBeNull()
    expect(x.issues).toContain('jsonld_zero_price_unverified')
    expect(x.venue_name).toBe('"Frekuence Club", Tiranë')
    expect(x.performers).toEqual([])
    expect(x.status).toBe('scheduled')
    expect(x.field_status.start_time).toBe('stated')
    expect(x.field_status.price_min).toBeUndefined()
  })

  it('splits ISO date-times as written (wall clock, offset ignored)', () => {
    expect(splitIsoDateTime('2026-11-14T20:00:00+01:00')).toEqual({ date: '2026-11-14', time: '20:00' })
    expect(splitIsoDateTime('2026-11-14')).toEqual({ date: '2026-11-14', time: null })
    expect(splitIsoDateTime('soon')).toEqual({ date: null, time: null })
  })
})

describe('normalization', () => {
  it('maps country names in many languages to ISO codes, and unknowns to null', () => {
    expect(countryToIso('Shqipëria')).toBe('AL')
    expect(countryToIso('Albania')).toBe('AL')
    expect(countryToIso('Kosova')).toBe('XK')
    expect(countryToIso('Deutschland')).toBe('DE')
    expect(countryToIso('Österreich')).toBe('AT')
    expect(countryToIso('België / Belgique / Belgien')).toBe('BE')
    expect(countryToIso('Северна Македонија')).toBe('MK')
    expect(countryToIso('UK')).toBe('GB')
    expect(countryToIso('de')).toBe('DE')
    expect(countryToIso('Atlantis')).toBeNull()
  })

  it('parses prices without inventing them', () => {
    expect(parsePrice('Hyrja falas')).toMatchObject({ state: 'free' })
    expect(parsePrice('Free')).toMatchObject({ state: 'free' })
    expect(parsePrice('€22')).toMatchObject({ state: 'paid', min: 22, currency: 'EUR' })
    expect(parsePrice('Presale: 1,000 ALL / Regular: 1,500 ALL')).toMatchObject({ state: 'paid', min: 1000, max: 1500, currency: 'ALL' })
    expect(parsePrice('Phase 1 Pre-sale Ticket 1,000 lekë')).toMatchObject({ state: 'paid', min: 1000, currency: 'ALL' })
    expect(parsePrice('Standard and VIP tickets available')).toMatchObject({ state: 'unknown' })
    expect(parsePrice('Unknown')).toMatchObject({ state: 'unknown' })
    expect(parsePrice('25')).toMatchObject({ state: 'unknown' }) // amount without currency is not a price
    expect(parsePrice(null)).toEqual({ state: 'unknown', min: null, max: null, currency: null, note: null })
  })

  it('normalizes times and rejects bare or impossible values', () => {
    expect(normalizeTime('21:00')).toBe('21:00')
    expect(normalizeTime('21.30')).toBe('21:30')
    expect(normalizeTime('9 PM')).toBe('21:00')
    expect(normalizeTime('22h')).toBe('22:00')
    expect(normalizeTime('21')).toBeNull()
    expect(normalizeTime('25:00')).toBeNull()
  })

  it('accepts only real calendar dates', () => {
    expect(normalizeDate('2026-10-31')).toBe('2026-10-31')
    expect(normalizeDate('2026-02-30')).toBeNull()
    expect(normalizeDate('31.10.2026')).toBeNull()
  })
})

describe('page distillation', () => {
  it('extracts title, parsed JSON-LD, text and the poster image', () => {
    const html = `<html><head><title>Devil &amp; Paradise</title>
      <meta property="og:image" content="/img/poster.jpg">
      <script type="application/ld+json">${JSON.stringify(ALMANART_EVENT)}</script>
      <script type="application/ld+json">{ broken json</script></head>
      <body><nav>Menu</nav><p>Sat 31 Oct · 18:00</p></body></html>`
    const page = distillPage(html, 'https://gowild.al/event/devil')
    expect(page.title).toBe('Devil & Paradise')
    expect(page.jsonld).toHaveLength(1)
    expect(page.text).toContain('Sat 31 Oct · 18:00')
    expect(page.imageUrl).toBe('https://gowild.al/img/poster.jpg')
  })
})
