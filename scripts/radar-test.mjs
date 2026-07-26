// Event Radar (RADAR-1) self-test — run with:
//   node --import ./scripts/radar-register.mjs scripts/radar-test.mjs
// (radar-register.mjs installs the '@/...' alias resolve hook; Node ≥23 strips
// the TS types so the real project libs load unchanged.)
//
// Covers the two novel pure modules: the transparent assessment engine
// (confidence + warnings + missing fields) and URL normalization / dedup.

const { assessReading, scoreConfidence } = await import('../lib/radar/assess.ts')
const { normalizeImportUrl, sourceNameFromUrl } = await import('../lib/radar/normalizeUrl.ts')

const TODAY = '2026-07-27'

let failed = 0
function check(name, cond) {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}`)
  if (!cond) failed++
}

// --- fixtures ---------------------------------------------------------------

function reading(overrides = {}) {
  return {
    is_event: true,
    confidence: 0.9,
    title: 'Summer Jazz Festival',
    description: 'Three nights of live jazz on the waterfront.',
    category: 'music',
    is_civic: false,
    date: '2026-12-01',
    time: '20:00',
    end_time: '23:00',
    venue_name: 'Amphitheater',
    address: 'Rruga e Durresit 1',
    city: 'Tirana',
    country: 'Albania',
    price: '1000 lekë',
    language: 'sq',
    tags: ['jazz', 'live'],
    artists: [],
    organizer_name: 'City Culture',
    organizer_website: '',
    recurrence: 'none',
    recurrence_until: '',
    recurrence_days_of_week: [],
    ...overrides,
  }
}

function resolution(overrides = {}) {
  return {
    city: { status: 'matched', slug: 'tirana', label: 'Tirana', country: 'Albania', ...(overrides.city || {}) },
    venue:
      overrides.venue ||
      { status: 'matched', place: { id: 'p1', name: 'Amphitheater', slug: 'amph', address: null, lat: 41.3, lng: 19.8, city: 'Tirana', location_slug: 'tirana' } },
    geocode: overrides.geocode || { status: 'none' },
    duplicate: overrides.duplicate || { status: 'none' },
  }
}

// --- assessment: the happy path is clean -----------------------------------

const clean = assessReading(reading(), resolution(), TODAY)
check('complete future event → high confidence', clean.confidence === 'high')
check('complete event → no warnings', clean.warnings.length === 0)
check('complete event → no missing fields', clean.missingFields.length === 0)

// --- missing / bad date is critical → low ----------------------------------

const noDate = assessReading(reading({ date: '' }), resolution(), TODAY)
check('missing date → warning', noDate.warnings.some((w) => w.code === 'no_date'))
check('missing date → listed as missing field', noDate.missingFields.includes('date'))
check('missing date → low confidence', noDate.confidence === 'low')

const past = assessReading(reading({ date: '2020-01-01' }), resolution(), TODAY)
check('past date → warning', past.warnings.some((w) => w.code === 'past_date'))
check('past date → low confidence', past.confidence === 'low')

// --- not-an-event is critical → low ----------------------------------------

const notEvent = assessReading(reading({ is_event: false }), resolution(), TODAY)
check('is_event false → warning', notEvent.warnings.some((w) => w.code === 'not_single_event'))
check('is_event false → low confidence', notEvent.confidence === 'low')

// --- duplicate is critical → low -------------------------------------------

const dup = assessReading(
  reading(),
  resolution({ duplicate: { status: 'live', event: { slug: 'x', title: 'X', date: '2026-12-01' } } }),
  TODAY,
)
check('live duplicate → warning', dup.warnings.some((w) => w.code === 'duplicate_live'))
check('live duplicate → low confidence', dup.confidence === 'low')

// --- soft signals cap at medium --------------------------------------------

const suggested = assessReading(
  reading(),
  resolution({ venue: { status: 'suggested', place: { id: 'p', name: 'A', slug: 'a', address: null, lat: null, lng: null, city: 'Tirana', location_slug: 'tirana' } }, geocode: { status: 'none' } }),
  TODAY,
)
check('suggested venue → venue_suggested warning', suggested.warnings.some((w) => w.code === 'venue_suggested'))
check('suggested venue (no critical) → medium', suggested.confidence === 'medium')

const noCity = assessReading(
  reading(),
  resolution({ city: { status: 'none', slug: '', label: '', country: '' }, geocode: { status: 'none' } }),
  TODAY,
)
check('unmatched city → city_unmatched warning', noCity.warnings.some((w) => w.code === 'city_unmatched'))
check('unmatched city (no critical) → medium', noCity.confidence === 'medium')

// --- scoreConfidence direct -------------------------------------------------

check('scoreConfidence: clean → high', scoreConfidence([], []) === 'high')
check('scoreConfidence: core missing → medium', scoreConfidence([], ['title']) === 'medium')
check('scoreConfidence: critical warning → low', scoreConfidence([{ code: 'no_date', message: '' }], []) === 'low')

// --- URL normalization / dedup ---------------------------------------------

check('rejects loopback (SSRF)', normalizeImportUrl('http://localhost/event') === null)
check('rejects private ip (SSRF)', normalizeImportUrl('http://192.168.0.1/e') === null)
check('rejects non-http protocol', normalizeImportUrl('ftp://example.com/e') === null)
check('rejects junk', normalizeImportUrl('not a url') === null)

const a = normalizeImportUrl('https://Example.AL/Event/Jazz/?utm_source=fb&fbclid=123&id=7#tickets')
const b = normalizeImportUrl('https://example.al/Event/Jazz?id=7')
check('lowercases host + strips tracking/fragment', a === 'https://example.al/Event/Jazz?id=7')
check('two shares of the same page dedup to one key', a === b)

check('trailing slash trimmed', normalizeImportUrl('https://x.al/a/') === 'https://x.al/a')
check('root slash kept', normalizeImportUrl('https://x.al/') === 'https://x.al/')
check('source name strips www', sourceNameFromUrl('https://www.Tirana.al/events') === 'tirana.al')

process.exit(failed === 0 ? 0 : 1)
