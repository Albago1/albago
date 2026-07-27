// Event Radar (RADAR-1) self-test — run with:
//   node --import ./scripts/radar-register.mjs scripts/radar-test.mjs
// (radar-register.mjs installs the '@/...' alias resolve hook; Node ≥23 strips
// the TS types so the real project libs load unchanged.)
//
// Covers the two novel pure modules: the transparent assessment engine
// (confidence + warnings + missing fields) and URL normalization / dedup.

const { assessReading, scoreConfidence } = await import('../lib/radar/assess.ts')
const { normalizeImportUrl, sourceNameFromUrl } = await import('../lib/radar/normalizeUrl.ts')
const { missingApprovalFields, canApprove, translateSubmissionError } = await import(
  '../lib/radar/approvalValidation.ts'
)
const { crawlReadingToSubmission } = await import('../lib/crawl/toSubmission.ts')

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

// --- assessment: required-time + broad-source warnings (§5) ----------------

const noTime = assessReading(reading({ time: '' }), resolution(), TODAY)
check('missing time → time_required warning', noTime.warnings.some((w) => w.code === 'time_required'))

const broad = assessReading(reading(), resolution(), TODAY, { broadSource: true })
check('broad source → broad_source warning', broad.warnings.some((w) => w.code === 'broad_source'))
check('clean event, not broad → no broad_source warning', !clean.warnings.some((w) => w.code === 'broad_source'))

// --- approval pre-validation (the production bug) --------------------------

check('missing time blocks approval', missingApprovalFields(reading({ time: '' })).some((b) => b.field === 'time'))
check('missing time → not approvable', canApprove(reading({ time: '' })) === false)
check('complete reading → approvable', canApprove(reading()) === true)
check('midnight 00:00 is a valid time (not blank)', canApprove(reading({ time: '00:00' })) === true)
check('whitespace time is treated as blank', canApprove(reading({ time: '   ' })) === false)
check('blank title blocks approval', missingApprovalFields(reading({ title: '' })).some((b) => b.field === 'title'))
check('blank date blocks approval', missingApprovalFields(reading({ date: '' })).some((b) => b.field === 'date'))
check(
  'missing time+date+title → all three reported',
  missingApprovalFields(reading({ title: '', date: '', time: '' })).length === 3,
)
check('price is never a required approval field', !missingApprovalFields(reading({ price: '' })).some((b) => b.field === 'price'))

// --- DB error translation (safe, useful; §7) -------------------------------

check(
  'not-null time error → friendly',
  translateSubmissionError({ code: '23502', message: 'null value in column "time"' }) ===
    'Start time is required by the event submission workflow.',
)
check(
  'unique violation → duplicate message',
  /already been sent/.test(translateSubmissionError({ code: '23505', message: 'dup' })),
)
check(
  'invalid datetime → date/time message',
  /not a valid value/.test(translateSubmissionError({ code: '22007', message: 'bad ts' })),
)
check(
  'unknown error → generic (no raw sql leaked)',
  translateSubmissionError({ code: 'XX999', message: 'secret internal detail' }) ===
    'Could not create the submission. The issue was logged for the team.',
)

// --- crawlReadingToSubmission mapping (root cause + crawler-not-broken) -----

const mapped = (over) => crawlReadingToSubmission(reading(over), resolution())

check('empty time maps to NULL (this is the root cause)', mapped({ time: '' }).time === null)
check('valid start time is preserved', mapped({ time: '20:30' }).time === '20:30')
check('midnight 00:00 is preserved, not nulled', mapped({ time: '00:00' }).time === '00:00')
check('overnight end_time is preserved', mapped({ time: '20:30', end_time: '01:00' }).end_time === '01:00')

const festival = mapped({
  date: '2026-08-12',
  time: '20:30',
  end_time: '01:00',
  recurrence: 'daily',
  recurrence_until: '2026-08-16',
})
check('multi-day festival keeps first day as date', festival.date === '2026-08-12')
check('multi-day festival keeps recurrence daily', festival.recurrence === 'daily')
check('multi-day festival keeps last day as recurrence_until', festival.recurrence_until === '2026-08-16')

check('free admission text is preserved (not zeroed)', mapped({ price: 'Free entry' }).price === 'Free entry')
check('blank price maps to NULL (price is nullable)', mapped({ price: '' }).price === null)
check('venue always has a non-null fallback', typeof mapped({ venue_name: '' }).venue_name === 'string')

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
