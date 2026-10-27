import { describe, expect, it } from 'vitest'
import { MockLanguageModelV4 } from 'ai/test'
import type { EngineDeps, ObservationInputV1, RelevanceCriteriaV1 } from '@/engine'
import { billingNames, coerceListing, coerceModelExtraction, createEngine, quoteStatesDay } from '@/engine/server'
import { memoryStore } from './memoryStore'

// Pages that LIST several events — a venue programme, an artist's tour dates —
// are cut into one observation per event. The fixtures are shaped like the
// real pages the research agent met (komplex457-style programme with JSON-LD,
// a tour page with plain text rows); the model is scripted and counted.
const NOW = new Date('2026-10-04T12:00:00Z')

const albanian: RelevanceCriteriaV1 = {
  id: 'albanian',
  description: 'Albanian-relevant',
  affiliation: 'albanian',
  keywords: ['shqip', 'albanian'],
  location_implies: { country_codes: ['AL', 'XK'], localities: [] },
  signals: { performer_affiliation: 'strong', title_keyword: 'strong' },
  rule: { min_strong: 1, or_min_medium: 2 },
}

/** A text model that answers with the given replies in order and counts its calls. */
function scripted(replies: string[]) {
  const model = new MockLanguageModelV4({
    doGenerate: async () => {
      const text = replies[Math.min(model.calls, replies.length - 1)]
      model.calls++
      return {
        content: [{ type: 'text', text }],
        finishReason: { unified: 'stop', raw: 'stop' },
        usage: { inputTokens: { total: 10, noCache: 10, cacheRead: 0, cacheWrite: 0 }, outputTokens: { total: 5, text: 5, reasoning: 0 } },
        warnings: [],
      }
    },
  }) as MockLanguageModelV4 & { calls: number }
  model.calls = 0
  return model
}

function deps(store: EngineDeps['store'], extractor = scripted(['{}'])): EngineDeps {
  return {
    store,
    fetcher: { fetchHtml: async () => null },
    search: { id: 'none', search: async () => [] },
    reasoner: { id: 'test/scripted', agent: extractor, extractor },
    now: () => NOW,
  }
}

function pageInput(url: string, evidence: Partial<ObservationInputV1['evidence']>): ObservationInputV1 {
  return {
    connector: 'test',
    source_id: null,
    source_url: url,
    retrieved_at: NOW.toISOString(),
    evidence: { title: null, text_excerpt: null, jsonld: [], meta: {}, media: [], ...evidence },
    lead: null,
    run_id: null,
  }
}

const komplex = { '@type': 'Place', name: 'Komplex 457', address: { addressLocality: 'Zürich', addressCountry: 'CH' } }
const PROGRAMME = [
  { '@type': 'MusicEvent', name: 'Albanian Night: Shqip Hits', startDate: '2026-10-17T22:00:00+02:00', location: komplex, url: '/events/albanian-night' },
  { '@type': 'MusicEvent', name: 'Koncert shqip: Ledri Vula', startDate: '2026-10-17T20:00:00+02:00', location: komplex, performer: [{ name: 'Ledri Vula' }] },
  { '@type': 'MusicEvent', name: 'Techno Tuesday', startDate: '2026-10-13T23:00:00+02:00', location: komplex },
  { '@type': 'MusicEvent', name: 'Summer Closing', startDate: '2026-09-20T22:00:00+02:00', location: komplex },
  { '@type': 'MusicEvent', name: 'New Year Gala', startDate: '2027-03-01T20:00:00+01:00', location: komplex },
]
const ZURICH_WINDOW = { from: '2026-10-04', to: '2026-12-03' }

const TOUR_URL = 'https://ylllimani.example/tour'
const TOUR_TEXT =
  'Yll Limani — Official site. Tour 2026. Fri 04 Dec 2026 Terminal 5 New York, NY Tickets Sat 05 Dec 2026 Terminal 5 New York, NY Tickets Sat 12 Dec 2026 Komplex 457 Zürich, Switzerland Tickets Newsletter Contact'
const TOUR_LINKS = [
  { text: 'Tickets', url: 'https://tix.example/yll-nyc-4' },
  { text: 'Tickets', url: 'https://tix.example/yll-nyc-5' },
]
const TOUR_READING = JSON.stringify({
  page_kind: 'event_list',
  page: { performer: 'Yll Limani', venue_name: null, locality: null, country: null, organizer_name: null, quotes: { performer: 'Yll Limani' } },
  events: [
    { title: null, date: '2026-12-04', venue_name: 'Terminal 5', locality: 'New York', country: 'US', event_type: 'concert', performers: [], languages: ['en'], link: 'https://tix.example/yll-nyc-4', quotes: { date: 'Fri 04 Dec 2026', venue_name: 'Terminal 5', locality: 'New York, NY' } },
    { title: null, date: '2026-12-05', venue_name: 'Terminal 5', locality: 'New York', country: 'US', event_type: 'concert', link: 'https://evil.example/not-on-the-page', quotes: { date: 'Sat 05 Dec 2026', venue_name: 'Terminal 5', locality: 'New York, NY' } },
    { title: null, date: '2026-12-12', venue_name: 'Komplex 457', locality: 'Zürich', country: 'Switzerland', event_type: 'concert', quotes: { date: 'Sat 12 Dec 2026', venue_name: 'Komplex 457', locality: 'Zürich' } },
    // Not on the page at all: the date quote can't be found, so the row is dropped.
    { title: 'Yll Limani at Wembley', date: '2026-12-20', venue_name: 'Wembley', locality: 'London', country: 'GB', quotes: { date: 'Sun 20 Dec 2026', venue_name: 'Wembley' } },
  ],
})
const TOUR_WINDOW = { from: '2026-10-04', to: '2027-04-02' }

describe('observePage() — pages that list several events', () => {
  it('cuts a JSON-LD programme into events without AI, skipping past, far-off and unrelated ones', async () => {
    const mem = memoryStore()
    const neverCalled = scripted([])
    const engine = createEngine(deps(mem.store, neverCalled))
    await engine.entities.ensureAffiliated('performer', ['Ledri Vula'], 'albanian')

    const page = { input: pageInput('https://komplex457.ch/programm', { title: 'Programm', jsonld: [PROGRAMME] }) }
    const result = await engine.observePage(page, { criteria: albanian, window: ZURICH_WINDOW })

    expect(neverCalled.calls).toBe(0)
    expect(result.kind).toBe('list')
    expect(result.outcomes.map((o) => [o.title, o.outcome])).toEqual([
      ['Albanian Night: Shqip Hits', 'new'],
      // Same page, same date, same venue — still two different events, not a merge.
      ['Koncert shqip: Ledri Vula', 'new'],
      ['Techno Tuesday', 'not_relevant'],
    ])
    expect(result.skipped).toEqual({ past: 1, outside_window: 1 })
    expect(mem.occurrences.size).toBe(2)

    const night = mem.occurrences.get(result.outcomes[0].occurrenceId!)!
    expect(night.source_urls).toEqual(['https://komplex457.ch/events/albanian-night'])
    expect(night.start).toMatchObject({ date: '2026-10-17', time: '22:00' })
    expect(night.location).toMatchObject({ locality: 'Zurich', country_code: 'CH' })
    expect(night.review_status).toBe('needs_review')

    // The unchanged page is not read again.
    const again = await engine.observePage(page, { criteria: albanian, window: ZURICH_WINDOW })
    expect(again.kind).toBe('unchanged')
    expect(mem.occurrences.size).toBe(2)
  })

  it('reads a tour page in one AI call; every row must be quoted, links must be the page’s own', async () => {
    const mem = memoryStore()
    const model = scripted([TOUR_READING])
    const engine = createEngine(deps(mem.store, model))
    await engine.entities.ensureAffiliated('performer', ['Yll Limani'], 'albanian')

    const result = await engine.observePage(
      { input: pageInput(TOUR_URL, { title: 'Yll Limani — Tour', text_excerpt: TOUR_TEXT }), links: TOUR_LINKS },
      { criteria: albanian, window: TOUR_WINDOW },
      'event_list',
    )

    expect(model.calls).toBe(1)
    expect(result.kind).toBe('list')
    expect(result.issues).toEqual(['items_dropped_1'])
    expect(result.outcomes.map((o) => [o.start_date, o.title, o.outcome])).toEqual([
      ['2026-12-04', 'Yll Limani in New York', 'new'],
      ['2026-12-05', 'Yll Limani in New York', 'new'],
      ['2026-12-12', 'Yll Limani in Zürich', 'new'],
    ])
    const [nyc4, nyc5, zurich] = result.outcomes.map((o) => mem.occurrences.get(o.occurrenceId!)!)
    // The artist comes from the page header; the confirmed artist makes it Albanian-relevant.
    expect(nyc4.performers).toEqual(['Yll Limani'])
    expect(nyc4.relevance.albanian.verdict).toBe('relevant')
    expect(nyc4.location).toMatchObject({ locality: 'New York', country_code: 'US' })
    // Its own ticket link is its identity; an invented link is dropped, so the row keeps the tour page.
    expect(nyc4.source_urls).toEqual(['https://tix.example/yll-nyc-4'])
    expect(nyc5.source_urls).toEqual([TOUR_URL])
    expect(zurich.location).toMatchObject({ locality: 'Zurich', country_code: 'CH' })
    expect(nyc4.provenance.title.status).toBe('derived')
  })

  it('a tour row and the ticket page for the same concert become one event', async () => {
    const mem = memoryStore()
    const engine = createEngine(deps(mem.store, scripted([TOUR_READING])))
    await engine.entities.ensureAffiliated('performer', ['Yll Limani'], 'albanian')
    const tour = await engine.observePage(
      { input: pageInput(TOUR_URL, { title: 'Yll Limani — Tour', text_excerpt: TOUR_TEXT }), links: TOUR_LINKS },
      { criteria: albanian, window: TOUR_WINDOW },
      'event_list',
    )

    const ticketPage = pageInput('https://tickets.example/yll-limani-live', {
      title: 'Yll Limani Live',
      jsonld: [{
        '@type': 'MusicEvent',
        name: 'Yll Limani Live',
        startDate: '2026-12-04T20:00:00-05:00',
        location: { '@type': 'Place', name: 'Terminal 5', address: { addressLocality: 'New York', addressRegion: 'NY', addressCountry: 'US' } },
        performer: [{ name: 'Yll Limani' }],
      }],
    })
    const single = await engine.observe(ticketPage, { criteria: albanian })

    expect(single.outcome).toBe('attached')
    expect(single.occurrenceId).toBe(tour.outcomes[0].occurrenceId)
    const occ = mem.occurrences.get(single.occurrenceId!)!
    expect(occ.start.time).toBe('20:00')
    expect(occ.source_urls).toEqual(['https://tix.example/yll-nyc-4', 'https://tickets.example/yll-limani-live'])
  })

  it('without a hint, a page the single-event reader calls a list goes to the listing reader', async () => {
    const mem = memoryStore()
    const model = scripted([JSON.stringify({ is_event: false, lists_events: true }), TOUR_READING])
    const engine = createEngine(deps(mem.store, model))

    const result = await engine.observePage(
      { input: pageInput(TOUR_URL, { title: 'Yll Limani — Tour', text_excerpt: TOUR_TEXT }), links: TOUR_LINKS },
      { window: TOUR_WINDOW },
    )

    expect(model.calls).toBe(2)
    expect(result.kind).toBe('list')
    expect(result.outcomes).toHaveLength(3)
    // The page itself is recorded once (by the single-event reading), then one row per event.
    const pageRows = [...mem.observations.values()].filter((o) => o.extracted === null || o.extracted.is_event === false)
    expect(pageRows).toHaveLength(1)
    expect(mem.observations.size).toBe(4)
  })

  it('an artist site whose JSON-LD lacks the cities is read from its text; the artist in the title carries over', async () => {
    // Shaped like elinaduni.com: each show is named after its place and the
    // Place carries only a country name, so the visible text is read instead.
    const mem = memoryStore()
    const text = 'New Tour Dates. Sat 30 Jan 2027 Davos (CH) Kulturplatz with Rob Luft Tickets. Fri 29 Jan 2027 Muri Gümligen (CH) Thoracker Tickets.'
    const show = (name: string, startDate: string) => ({ '@type': 'MusicEvent', name, startDate, location: { '@type': 'Place', name: 'Switzerland', address: { addressLocality: '' } } })
    const model = scripted([
      JSON.stringify({
        page_kind: 'event_list',
        page: {},
        events: [
          { title: 'Davos (CH)', date: '2027-01-30', venue_name: 'Kulturplatz', locality: 'Davos', country: 'CH', quotes: { date: 'Sat 30 Jan 2027', venue_name: 'Kulturplatz', locality: 'Davos' } },
          { title: 'Muri Gümligen (CH)', date: '2027-01-29', venue_name: 'Thoracker', locality: 'Muri Gümligen', country: 'CH', quotes: { date: 'Fri 29 Jan 2027', venue_name: 'Thoracker', locality: 'Muri Gümligen' } },
        ],
      }),
    ])
    const engine = createEngine(deps(mem.store, model))
    await engine.entities.ensureAffiliated('performer', ['Elina Duni'], 'albanian')

    const result = await engine.observePage(
      { input: pageInput('https://elinaduni.example/', { title: 'New Tour Dates - Elina Duni', text_excerpt: text, jsonld: [show('Davos (CH)', '2027-01-30T20:00:00+02:00'), show('Muri Gümligen (CH)', '2027-01-29T20:00:00+02:00')] }) },
      { criteria: albanian, window: TOUR_WINDOW },
    )

    expect(model.calls).toBe(1)
    expect(result.outcomes.map((o) => [o.title, o.outcome])).toEqual([
      ['Elina Duni: Davos (CH)', 'new'],
      ['Elina Duni: Muri Gümligen (CH)', 'new'],
    ])
    const davos = mem.occurrences.get(result.outcomes[0].occurrenceId!)!
    expect(davos.performers).toEqual(['Elina Duni'])
    expect(davos.relevance.albanian.verdict).toBe('relevant')
    expect(davos.venue.name).toBe('Kulturplatz')
  })

  it('a single-event page still takes the single-event path', async () => {
    const mem = memoryStore()
    const neverCalled = scripted([])
    const engine = createEngine(deps(mem.store, neverCalled))
    const result = await engine.observePage({ input: pageInput('https://komplex457.ch/events/albanian-night', { title: 'Albanian Night', jsonld: [PROGRAMME[0]] }) }, { criteria: albanian })
    expect(result.kind).toBe('single')
    expect(result.outcomes[0]).toMatchObject({ outcome: 'new', title: 'Albanian Night: Shqip Hits' })
    expect(neverCalled.calls).toBe(0)
  })
})

describe('coerceListing() — the listing reader’s guards', () => {
  const text =
    'Programm November. Sat 07 Nov 2026 Nora Istrefi live, Club Alpha, Basel. ' +
    'Doors and ticket information for all shows follow below. '.repeat(14) +
    'Sat 14 Nov 2026 Club Beta, Basel.'
  const links = [{ text: 'Nora Istrefi', url: 'https://clubalpha.example/e/nora' }]

  it('drops details that sit far from the row’s date, invented links and unquoted dates', () => {
    const reading = coerceListing(
      {
        page_kind: 'event_list',
        events: [
          // The venue quoted here belongs to another row, 800+ characters away.
          { title: 'Nora Istrefi', date: '2026-11-07', venue_name: 'Club Beta', locality: 'Basel', performers: ['Nora Istrefi', 'Ghost DJ'], link: '/e/nora', quotes: { date: 'Sat 07 Nov 2026', venue_name: 'Club Beta', locality: 'Basel' } },
          { title: 'Club Beta Night', date: '2026-11-14', link: 'https://elsewhere.example/x', quotes: { date: 'Sat 14 Nov 2026' } },
          { title: 'Invented', date: '2026-11-21', quotes: { date: 'Sat 21 Nov 2026' } },
        ],
      },
      text,
      links,
      'https://clubalpha.example/programm',
    )
    expect(reading.kind).toBe('event_list')
    expect(reading.issues).toEqual(['items_dropped_2'])
    expect(reading.items).toHaveLength(1)
    const [nora] = reading.items
    expect(nora.x.venue_name).toBeNull()
    expect(nora.x.locality).toBe('Basel') // "Basel" also appears right next to the date
    expect(nora.x.issues).toContain('venue_name_far_from_date')
    expect(nora.x.performers).toEqual(['Nora Istrefi'])
    expect(nora.url).toBe('https://clubalpha.example/e/nora')
    expect(nora.window).toContain('Sat 07 Nov 2026 Nora Istrefi')
  })

  it('unusable model output reads as no events', () => {
    expect(coerceListing(null, text, links, null)).toEqual({ kind: 'no_events', items: [], issues: ['model_output_unusable'] })
  })
})

describe('billing names', () => {
  it('splits a billing into its names and keeps the whole', () => {
    expect(billingNames(['Elina Duni & Rob Luft'])).toEqual(['Elina Duni & Rob Luft', 'Elina Duni', 'Rob Luft'])
    expect(billingNames(['Majk x Noizy feat. Ledri Vula'])).toEqual(['Majk x Noizy feat. Ledri Vula', 'Majk', 'Noizy', 'Ledri Vula'])
    expect(billingNames(['Ava Max'])).toEqual(['Ava Max'])
  })

  it('a known artist inside a billing makes the event relevant', async () => {
    const mem = memoryStore()
    const engine = createEngine(deps(mem.store, scripted([])))
    await engine.entities.ensureAffiliated('performer', ['Elina Duni'], 'albanian')
    const out = await engine.observe(
      pageInput('https://venue.example/e/duni', {
        title: 'Elina Duni & Rob Luft',
        jsonld: [{ '@type': 'MusicEvent', name: 'Elina Duni & Rob Luft', startDate: '2026-11-21T20:00:00+01:00', location: { '@type': 'Place', name: 'AMR', address: { addressLocality: 'Genève', addressCountry: 'CH' } }, performer: [{ name: 'Elina Duni & Rob Luft' }] }],
      }),
      { criteria: albanian },
    )
    expect(mem.occurrences.get(out.occurrenceId!)!.relevance.albanian).toMatchObject({ verdict: 'relevant', signals: [{ kind: 'performer_affiliation', value: 'Elina Duni' }] })
  })
})

describe('a date must state its day', () => {
  // Real case (albanianregistry.org): "Held every year · next: November 2026".
  // Asked for a date, the model picked the 1st on one run and the 28th on the next.
  const page = 'Festa e Flamurit at AAIC Held every year · next: November 2026 Garfield, NJ. Gala Sat, Nov 14 · 5:00 PM South Orange, NJ'

  it('quoteStatesDay accepts the day as its own number only', () => {
    expect(quoteStatesDay('Sat, Nov 14', '2026-11-14')).toBe(true)
    expect(quoteStatesDay('28.11.2026', '2026-11-28')).toBe(true)
    expect(quoteStatesDay('Nov 4th', '2026-11-04')).toBe(true)
    expect(quoteStatesDay('2026-11-28', '2026-11-28')).toBe(true)
    expect(quoteStatesDay('November 2026', '2026-11-01')).toBe(false)
    expect(quoteStatesDay('November 2026', '2026-11-26')).toBe(false)
  })

  it('a listing row with only a month is dropped', () => {
    const reading = coerceListing(
      {
        page_kind: 'event_list',
        events: [
          { title: 'Festa e Flamurit at AAIC', date: '2026-11-28', quotes: { date: 'November 2026' } },
          { title: 'Gala', date: '2026-11-14', quotes: { date: 'Sat, Nov 14' } },
        ],
      },
      page,
      [],
      null,
    )
    expect(reading.items.map((i) => i.x.title)).toEqual(['Gala'])
  })

  it('the single-event reader drops a month-only date too', () => {
    const x = coerceModelExtraction({ is_event: true, title: 'Festa e Flamurit at AAIC', start_date: '2026-11-28', quotes: { start_date: 'November 2026' } }, page)
    expect(x.start_date).toBeNull()
    expect(x.issues).toContain('start_date_without_day')
  })
})
