// Phase 37 Stage A self-test — run with:
//   node --import ./scripts/radar-register.mjs scripts/agent-test.mjs
//   node --import ./scripts/radar-register.mjs scripts/agent-test.mjs --live
//
// Two tiers, deliberately:
//
//   DEFAULT (free, deterministic, no network) — the tool contract. These are
//   the invariants that make the agent safe: it can't blank a field, it can't
//   overwrite what the human just told it, and it reports what's missing
//   honestly. No model involved, so these can run on every change.
//
//   --live (costs quota, needs .env.local) — the real multi-turn conversation
//   against Gemini + Supabase. This is the Stage A DoD: paste text missing a
//   time, the agent must ASK for it rather than invent one, then accept the
//   answer and complete the draft.

import { readFileSync } from 'fs'

const LIVE = process.argv.includes('--live')

if (LIVE) {
  // The real libs read process.env; .env.local is not loaded automatically
  // outside Next. Same reader as scripts/tix-concurrency-test.mjs.
  for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
    if (!line.includes('=') || line.trim().startsWith('#')) continue
    const key = line.slice(0, line.indexOf('=')).trim()
    const value = line.slice(line.indexOf('=') + 1).trim()
    if (!process.env[key]) process.env[key] = value
  }
}

const { createAgentTools, fillEmpty } = await import('../lib/agent/tools.ts')
const { draftToReading } = await import('../lib/agent/draftReading.ts')
const { defaultEventDraft } = await import('../types/eventDraftBase.ts')

const TODAY = '2026-08-19'

let failed = 0
function check(name, cond) {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}`)
  if (!cond) failed++
}

function newCtx(draft = {}) {
  return {
    draft: { ...defaultEventDraft, ...draft },
    todayIso: TODAY,
    lastResolution: null,
    called: [],
  }
}

// --- draftToReading ---------------------------------------------------------

{
  const reading = draftToReading({
    ...defaultEventDraft,
    title: 'Nata e Jazz-it',
    category: 'music',
    language: 'sq',
    date: '2026-09-04',
    time: '21:00',
  })
  check('draftToReading carries the basics', reading.title === 'Nata e Jazz-it' && reading.date === '2026-09-04')
  check('draftToReading keeps a valid category', reading.category === 'music')
  check('draftToReading keeps a valid language', reading.language === 'sq')
}

{
  const reading = draftToReading({ ...defaultEventDraft, category: 'not-a-category', language: 'xx' })
  check('draftToReading drops an unknown category', reading.category === '')
  check('draftToReading falls back to en for an unknown language', reading.language === 'en')
}

{
  const reading = draftToReading({ ...defaultEventDraft, event_type: 'protest', category: 'music' })
  check('a protest reads as civic regardless of category', reading.is_civic === true && reading.category === 'civic')
}

// --- fillEmpty: extraction must never clobber a human answer -----------------

{
  const draft = { ...defaultEventDraft, title: 'The admin typed this', time: '' }
  const filled = fillEmpty(draft, { title: 'Extracted title', time: '20:00' })
  check('fillEmpty fills an empty field', draft.time === '20:00' && filled.includes('time'))
  check('fillEmpty never overwrites a filled field', draft.title === 'The admin typed this')
  check('fillEmpty reports only what it changed', !filled.includes('title'))
}

{
  const draft = { ...defaultEventDraft, tags: ['jazz'] }
  fillEmpty(draft, { tags: ['rock'] })
  check('fillEmpty treats a non-empty array as filled', draft.tags[0] === 'jazz')
}

{
  const draft = { ...defaultEventDraft }
  fillEmpty(draft, { title: '   ', description: '' })
  check('fillEmpty ignores blank incoming values', draft.title === '')
}

// --- set_fields -------------------------------------------------------------

{
  const ctx = newCtx()
  const tools = createAgentTools(ctx)
  const result = await tools.set_fields.execute({ title: 'Festivali i Birrës', date: '2026-08-22' })
  check('set_fields writes the fields', ctx.draft.title === 'Festivali i Birrës' && ctx.draft.date === '2026-08-22')
  check('set_fields reports what changed', result.changed.includes('title') && result.changed.includes('date'))
  check('set_fields records the call', ctx.called.includes('set_fields'))
}

{
  const ctx = newCtx({ title: 'Kept' })
  const tools = createAgentTools(ctx)
  await tools.set_fields.execute({ title: '' })
  check('set_fields cannot blank a field with an empty string', ctx.draft.title === 'Kept')
}

// --- summarize_draft: honest about what is missing ---------------------------

{
  const ctx = newCtx({ title: 'Only a title' })
  const tools = createAgentTools(ctx)
  const summary = await tools.summarize_draft.execute({})
  check('summarize_draft reports missing fields', Array.isArray(summary.missing) && summary.missing.length > 0)
  check('summarize_draft echoes the draft', summary.draft.title === 'Only a title')
  check('summarize_draft flags no translations yet', summary.draft.has_translations === false)
}

// --- live: the actual conversation ------------------------------------------

if (LIVE) {
  console.log('\n--- live turn (Gemini + Supabase) ---')
  const { runAgentTurn } = await import('../lib/agent/run.ts')

  // Deliberately missing the start time. The agent must ask, not invent.
  const pasted = [
    'Koncert: Elina Duni Quartet',
    'Kino Millennium, Tirana',
    '12 shtator 2026',
    'Bileta 1500 lekë, ne ticketalbania.com',
  ].join('\n')

  const first = await runAgentTurn({
    messages: [{ role: 'user', content: `Create an event from this:\n\n${pasted}` }],
    todayIso: TODAY,
  })

  console.log('tools:', first.toolsCalled.join(', ') || '(none)')
  console.log('tokens:', first.usage.totalTokens)
  console.log('reply:', first.text.trim().slice(0, 400))
  console.log('draft:', JSON.stringify(
    { title: first.draft.title, date: first.draft.date, time: first.draft.time, venue: first.draft.venue_name, city: first.draft.city, price: first.draft.price },
    null, 2,
  ))

  check('live: it read the text', first.toolsCalled.includes('read_text'))
  check('live: it got the title', first.draft.title.toLowerCase().includes('elina'))
  check('live: it got the date', first.draft.date === '2026-09-12')
  check('live: it did NOT invent a time', first.draft.time === '')
  check('live: it asked about the time', /time|ora|start/i.test(first.text))

  const second = await runAgentTurn({
    messages: [
      { role: 'user', content: `Create an event from this:\n\n${pasted}` },
      { role: 'assistant', content: first.text },
      { role: 'user', content: 'It starts at 20:30.' },
    ],
    draft: first.draft,
    todayIso: TODAY,
  })

  console.log('\ntools:', second.toolsCalled.join(', ') || '(none)')
  console.log('reply:', second.text.trim().slice(0, 400))

  check('live: the answer landed in the draft', second.draft.time === '20:30')
  check('live: earlier fields survived the turn', second.draft.title === first.draft.title)
}

console.log(`\n${failed === 0 ? 'ALL PASS' : `${failed} FAILED`}${LIVE ? '' : '  (run with --live for the model + DB turn)'}`)
process.exit(failed === 0 ? 0 : 1)
