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
const { sanitizeCrawlSubmission } = await import('../lib/crawl/sanitizeSubmission.ts')

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

// --- source image → published cover (banner_url + gallery) -----------------

const withImg = (img) => crawlReadingToSubmission(reading(), resolution(), img)
check('no image → banner_url null', withImg(null).banner_url === null)
check('no image → gallery empty', withImg(null).gallery_urls.length === 0)
const img = withImg('https://cdn.example.al/poster.jpg?v=9')
check('https image → banner_url set', img.banner_url === 'https://cdn.example.al/poster.jpg?v=9')
check('https image → gallery mirrors the banner', img.gallery_urls.length === 1 && img.gallery_urls[0] === img.banner_url)
check('http image accepted', withImg('http://x.al/p.png').banner_url === 'http://x.al/p.png')
check('data: URL rejected (never a banner)', withImg('data:image/png;base64,AAAA').banner_url === null)
check('javascript: URL rejected', withImg('javascript:alert(1)').banner_url === null)
check('blank image string → null', withImg('   ').banner_url === null)

// --- submitted_by_user_id (queue NOT NULL on the direct insert) -------------

check('crawler find (no submitter) → null', crawlReadingToSubmission(reading(), resolution()).submitted_by_user_id === null)
check(
  'Radar approval attributes the row to the admin',
  crawlReadingToSubmission(reading(), resolution(), null, 'admin-uuid-123').submitted_by_user_id === 'admin-uuid-123',
)

// --- error translation names the offending column ---------------------------
check(
  'unknown NOT NULL column is named, not hidden',
  translateSubmissionError({
    code: '23502',
    message: 'null value in column "submitted_by_user_id" of relation "event_submissions" violates not-null constraint',
  }) === 'The submission queue requires a value for "submitted_by_user_id", which this import left empty.',
)

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

// --- queue-selected sanitizer (untrusted client round-trip) ----------------

const goodPreview = () => ({
  title: 'Techno Night',
  date: '2026-09-19',
  time: '22:00',
  venue_name: 'Club X',
  category: 'nightlife',
  country: 'Albania',
  location_slug: 'tirane',
  description: 'A night out',
  banner_url: 'https://cdn.example.al/p.jpg',
  is_civic: false,
})

check('sanitizer keeps a valid preview', !!sanitizeCrawlSubmission(goodPreview(), 'admin-1'))
check('sanitizer forces status=pending', sanitizeCrawlSubmission(goodPreview(), 'admin-1').status === 'pending')
check('sanitizer stamps the submitter', sanitizeCrawlSubmission(goodPreview(), 'admin-1').submitted_by_user_id === 'admin-1')
check('sanitizer null submitter allowed', sanitizeCrawlSubmission(goodPreview(), null).submitted_by_user_id === null)
check('sanitizer drops any client place_id', sanitizeCrawlSubmission({ ...goodPreview(), place_id: 'evil-uuid' }, 'a').place_id === null)
check('sanitizer keeps http banner', sanitizeCrawlSubmission(goodPreview(), 'a').banner_url === 'https://cdn.example.al/p.jpg')
check('sanitizer strips a javascript: banner', sanitizeCrawlSubmission({ ...goodPreview(), banner_url: 'javascript:alert(1)' }, 'a').banner_url === null)
check('sanitizer rejects a missing title', sanitizeCrawlSubmission({ ...goodPreview(), title: '' }, 'a') === null)
check('sanitizer rejects a bad date', sanitizeCrawlSubmission({ ...goodPreview(), date: 'someday' }, 'a') === null)
check('sanitizer coerces an unknown category to culture', sanitizeCrawlSubmission({ ...goodPreview(), category: 'wat' }, 'a').category === 'culture')
check('sanitizer coerces unknown category on civic to civic', sanitizeCrawlSubmission({ ...goodPreview(), category: 'wat', is_civic: true }, 'a').category === 'civic')
check('sanitizer clamps a bad recurrence to none', sanitizeCrawlSubmission({ ...goodPreview(), recurrence: 'hourly' }, 'a').recurrence === 'none')
check('sanitizer ignores non-string title (injection)', sanitizeCrawlSubmission({ ...goodPreview(), title: { $ne: 1 } }, 'a') === null)
check('sanitizer drops out-of-range weekdays', JSON.stringify(sanitizeCrawlSubmission({ ...goodPreview(), recurrence_days_of_week: [1, 9, 'x', 5] }, 'a').recurrence_days_of_week) === '[1,5]')

// --- discovery agent: outcome classification -------------------------------

const { classifyImportOutcome } = await import('../lib/radar/discoveryClassify.ts')

const okCandidate = (over = {}) => ({
  ok: true,
  duplicate: false,
  candidate: { id: 'cand-1', status: 'needs_review', error: null, ...over },
})

check(
  'discovery: a fresh needs_review read is "imported"',
  classifyImportOutcome(okCandidate()).outcome === 'imported',
)
check(
  'discovery: imported carries the candidate id',
  classifyImportOutcome(okCandidate()).candidateId === 'cand-1',
)
check(
  'discovery: an idempotent hit is "duplicate", not a new import',
  classifyImportOutcome({ ...okCandidate(), duplicate: true }).outcome === 'duplicate',
)
check(
  'discovery: a persisted failed candidate is "unreadable"',
  classifyImportOutcome(okCandidate({ status: 'failed', error: 'login-walled' })).outcome === 'unreadable',
)
check(
  'discovery: unreadable surfaces the stored error message',
  classifyImportOutcome(okCandidate({ status: 'failed', error: 'login-walled' })).message === 'login-walled',
)
check(
  'discovery: a hard import failure is "error" with no candidate',
  (() => {
    const r = classifyImportOutcome({ ok: false, code: 'db_error', message: 'nope' })
    return r.outcome === 'error' && r.candidateId === undefined && r.message === 'nope'
  })(),
)
check(
  'discovery: duplicate takes precedence over status inspection',
  classifyImportOutcome({ ok: true, duplicate: true, candidate: { id: 'c', status: 'failed', error: 'x' } }).outcome === 'duplicate',
)

// --- discovery: non-event keep-bar -----------------------------------------

const { isKeepableEvent, DISCOVERY_MIN_CONFIDENCE } = await import('../lib/radar/discoveryClassify.ts')

check('keep-bar: a confident event is kept', isKeepableEvent({ is_event: true, confidence: 0.9 }) === true)
check('keep-bar: is_event false is dropped', isKeepableEvent({ is_event: false, confidence: 0.9 }) === false)
check('keep-bar: thin confidence is dropped', isKeepableEvent({ is_event: true, confidence: 0.2 }) === false)
check('keep-bar: null reading is dropped', isKeepableEvent(null) === false)
check('keep-bar: exactly at threshold is kept', isKeepableEvent({ is_event: true, confidence: DISCOVERY_MIN_CONFIDENCE }) === true)

// --- verification loop: decision logic -------------------------------------

const { decideVerify } = await import('../lib/radar/verifyDecide.ts')

function vreading(over = {}) {
  return {
    is_event: true,
    confidence: 0.9,
    title: 'Summer Jazz Festival',
    date: '2026-12-01',
    time: '20:00',
    ...over,
  }
}
const stored = { title: 'Summer Jazz Festival', date: '2026-12-01' }

check('verify: same event same date → verified + stamped', (() => {
  const v = decideVerify(stored, vreading())
  return v.action === 'verified' && v.stampVerified === true && v.newListingStatus === null
})())
check('verify: unreadable (null) → no write, not stamped', (() => {
  const v = decideVerify(stored, null)
  return v.action === 'unreadable' && v.stampVerified === false && v.newListingStatus === null
})())
check('verify: page no longer an event → flag_missing, NEVER auto-cancel', (() => {
  const v = decideVerify(stored, vreading({ is_event: false }))
  return v.action === 'flag_missing' && v.newListingStatus === null && v.stampVerified === false
})())
check('verify: a different event on the page → flag_changed, no write', (() => {
  const v = decideVerify(stored, vreading({ title: 'Techno Rave Warehouse' }))
  return v.action === 'flag_changed' && v.newListingStatus === null
})())
check('verify: same event, date moved → date_changed + neutral updated flag + stamp', (() => {
  const v = decideVerify(stored, vreading({ date: '2026-12-08' }))
  return v.action === 'date_changed' && v.newListingStatus === 'updated' && v.stampVerified === true && v.observedDate === '2026-12-08'
})())
check('verify: NEVER writes a status other than updated', (() => {
  const cases = [null, vreading({ is_event: false }), vreading({ title: 'Other' }), vreading(), vreading({ date: '2026-12-08' })]
  return cases.every((r) => {
    const s = decideVerify(stored, r).newListingStatus
    return s === null || s === 'updated'
  })
})())
check('verify: reworded-but-same title still verifies (title match)', (() => {
  const v = decideVerify(stored, vreading({ title: 'Summer Jazz Festival 2026' }))
  return v.action === 'verified'
})())

process.exit(failed === 0 ? 0 : 1)
