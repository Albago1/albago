// GPT Ingest (Phase 38) self-test — run with:
//   node --import ./scripts/radar-register.mjs scripts/ingest-test.mjs
// (reuses the Radar alias hook; Node ≥23 strips the TS types so the real
// project libs load unchanged.)
//
// Covers the pure modules only — no network, no DB. The two things worth
// proving are the ones the whole phase rests on: an agent's location guess can
// never win, and the source page beats the agent on every contested field.

const { validateIngestEvent, mergeAgentAndPage, agentDedupKey, AGENT_ASSERTED_CONFIDENCE } =
  await import('../lib/ingest/schema.ts')
const { scoreConfidence } = await import('../lib/radar/assess.ts')

let failed = 0
function check(name, cond) {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}`)
  if (!cond) failed++
}

// --- fixtures ---------------------------------------------------------------

function agentEvent(overrides = {}) {
  return {
    source_url: 'https://example.org/events/jazz-night?utm_source=chatgpt',
    image_url: 'https://cdn.example.org/poster.jpg',
    title: 'Jazz Night',
    description: 'Nje mbremje me xhaz.',
    category: 'music',
    date: '2026-09-12',
    time: '21:00',
    venue_name: 'Kinema Millennium',
    address: 'Rruga Murat Toptani',
    city: 'Tirana',
    country: 'Albania',
    price: '1000 Lekë',
    language: 'sq',
    tags: ['Jazz', 'live'],
    suggested_location_slug: 'tirana-albania',
    notes_for_admin: 'Time not confirmed on the flyer.',
    ...overrides,
  }
}

function reading(overrides = {}) {
  return {
    is_event: true,
    confidence: 0.9,
    title: 'Jazz Night',
    description: 'An evening of jazz.',
    category: 'music',
    is_civic: false,
    date: '2026-09-12',
    time: '22:00',
    end_time: '',
    venue_name: 'Kinema Millennium',
    address: '',
    city: 'Tirana',
    country: 'Albania',
    price: '',
    language: 'sq',
    tags: [],
    artists: [],
    organizer_name: '',
    organizer_website: '',
    recurrence: 'none',
    recurrence_until: '',
    recurrence_days_of_week: [],
    ...overrides,
  }
}

// --- validation -------------------------------------------------------------

{
  const v = validateIngestEvent(agentEvent())
  check('valid event is accepted', v.ok === true)
  check('title survives', v.ok && v.item.reading.title === 'Jazz Night')
  check('is_event is forced true (posting here IS the assertion)', v.ok && v.item.reading.is_event === true)
  check(
    'confidence is ours, not the agent\'s',
    v.ok && v.item.reading.confidence === AGENT_ASSERTED_CONFIDENCE,
  )
  check('tags are lowercased by the shared coercion', v.ok && v.item.reading.tags[0] === 'jazz')
  check(
    'tracking params are stripped from the dedup key',
    v.ok && v.item.dedupKey === 'https://example.org/events/jazz-night',
  )
  check('source name is the bare host', v.ok && v.item.sourceName === 'example.org')
  check('agent image url is kept for later fetching', v.ok && v.item.imageUrl === 'https://cdn.example.org/poster.jpg')
}

// The whole point of the phase: the agent's slug is recorded as evidence and
// never becomes data.
{
  const v = validateIngestEvent(agentEvent())
  check('agent slug is kept as evidence only', v.ok && v.item.evidence.suggestedSlug === 'tirana-albania')
  check(
    'agent slug never lands on the reading',
    v.ok && !Object.prototype.hasOwnProperty.call(v.item.reading, 'location_slug'),
  )
  check('agent note is captured', v.ok && v.item.evidence.agentNote?.startsWith('Time not'))
}

// A model that sends lat/lng must not be able to place a pin.
{
  const v = validateIngestEvent(agentEvent({ lat: 41.32, lng: 19.81 }))
  check(
    'agent coordinates are dropped entirely',
    v.ok &&
      !Object.prototype.hasOwnProperty.call(v.item.reading, 'lat') &&
      !Object.prototype.hasOwnProperty.call(v.item.reading, 'lng'),
  )
}

{
  const v = validateIngestEvent(agentEvent({ is_event: false }))
  check('agent cannot self-declare not-an-event to bypass the gate', v.ok && v.item.reading.is_event === true)
}

{
  check('missing title is rejected', validateIngestEvent(agentEvent({ title: '' })).ok === false)
  check('non-object is rejected', validateIngestEvent('an event').ok === false)
  check('null is rejected', validateIngestEvent(null).ok === false)
}

// A thin event is allowed through — the response tells the agent what's missing.
{
  const v = validateIngestEvent({ title: 'Something happening' })
  check('event with only a title is accepted (correction loop, not a wall)', v.ok === true)
  check('no source url → synthetic agent key', v.ok && v.item.dedupKey.startsWith('agent:'))
  check('no source url → agent source name', v.ok && v.item.sourceName === 'GPT agent')
}

{
  const v = validateIngestEvent(agentEvent({ image_url: 'javascript:alert(1)' }))
  check('non-http image url is dropped', v.ok && v.item.imageUrl === null)
}

{
  const v = validateIngestEvent(agentEvent({ source_url: 'http://localhost:3000/x' }))
  check('private/loopback source url does not become a key', v.ok && v.item.dedupKey.startsWith('agent:'))
}

{
  const a = agentDedupKey(reading())
  const b = agentDedupKey(reading({ title: 'Jazz Night' }))
  check('agent dedup key is stable for the same event', a === b)
  check(
    'agent dedup key separates different dates',
    a !== agentDedupKey(reading({ date: '2026-09-13' })),
  )
}

// --- merge: the page wins ---------------------------------------------------

{
  const agent = validateIngestEvent(agentEvent()).item.reading
  const page = reading()
  const { merged, conflicts } = mergeAgentAndPage(agent, page)

  check('page time overrules the agent', merged.time === '22:00')
  const timeConflict = conflicts.find((c) => c.field === 'time')
  check('the disagreement is reported, not hidden', !!timeConflict)
  check('conflict records both claims', timeConflict?.agent === '21:00' && timeConflict?.page === '22:00')
  check('conflict says which value was kept', timeConflict?.used === '22:00')
  check('page description wins', merged.description === 'An evening of jazz.')
  check('agent fills a gap the page left empty (address)', merged.address === 'Rruga Murat Toptani')
  check('agent fills a gap the page left empty (price)', merged.price === '1000 Lekë')
  check('gap-filling is not a conflict', !conflicts.some((c) => c.field === 'address'))
  check('page confidence replaces the agent baseline', merged.confidence === 0.9)
  check('agent tags survive when the page has none', merged.tags[0] === 'jazz')
}

{
  const agent = validateIngestEvent(agentEvent({ is_civic: true, category: 'civic' })).item.reading
  const { merged } = mergeAgentAndPage(agent, reading())
  check('either source raising civic is enough', merged.is_civic === true)
}

{
  const agent = validateIngestEvent(agentEvent()).item.reading
  const { merged, conflicts } = mergeAgentAndPage(agent, reading({ is_event: false }))
  check('a page that reads as not-an-event does not silently delete the event', merged.is_event === true)
  check('that disagreement is surfaced', conflicts.some((c) => c.field === 'is_event'))
}

{
  const agent = validateIngestEvent(
    agentEvent({ recurrence: 'weekly', recurrence_days_of_week: [5] }),
  ).item.reading
  const { merged } = mergeAgentAndPage(agent, reading())
  check('agent recurrence is taken whole when the page states none', merged.recurrence === 'weekly')
  check('…including its weekday list', merged.recurrence_days_of_week.join() === '5')
}

// --- confidence -------------------------------------------------------------

{
  check(
    'an unverified agent claim caps confidence at medium',
    scoreConfidence([{ code: 'source_unverified', message: 'x' }], []) === 'medium',
  )
  check(
    'a clean verified reading can still be high',
    scoreConfidence([], []) === 'high',
  )
  check(
    'a critical warning still wins over unverified',
    scoreConfidence(
      [
        { code: 'source_unverified', message: 'x' },
        { code: 'past_date', message: 'y' },
      ],
      [],
    ) === 'low',
  )
}

console.log(failed === 0 ? '\nAll ingest tests passed.' : `\n${failed} test(s) failed.`)
process.exit(failed === 0 ? 0 : 1)
