// Scout (Phase 39) self-test — run with:
//   node --import ./scripts/radar-register.mjs scripts/scout-test.mjs
//
// Covers the pure brief logic only. The search itself is a live grounded model
// call and the ingest half is already covered by scripts/ingest-test.mjs.

const {
  buildBriefs,
  parseAreasEnv,
  clampDays,
  windowEnd,
  fullBeat,
  rotateBriefs,
  dayIndexFor,
  HOME_AREAS,
  DIASPORA_AREAS,
  DEFAULT_DAYS,
  DEFAULT_BRIEFS_PER_RUN,
} = await import('../lib/scout/brief.ts')

let failed = 0
function check(name, cond) {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}`)
  if (!cond) failed++
}

// --- the window -------------------------------------------------------------

check('window end is days ahead of today', windowEnd('2026-08-24', 21) === '2026-09-14')
check('window crosses a month boundary', windowEnd('2026-08-31', 1) === '2026-09-01')
check('window crosses a year boundary', windowEnd('2026-12-31', 1) === '2027-01-01')
check('leap day is handled', windowEnd('2028-02-28', 1) === '2028-02-29')

// --- day clamping -----------------------------------------------------------

check('days default when absent', clampDays(undefined) === DEFAULT_DAYS)
check('days default when unparseable', clampDays('soon') === DEFAULT_DAYS)
check('days clamp above the max', clampDays(9999) === 90)
check('days clamp below the min', clampDays(0) === 1)
check('negative days clamp to the min', clampDays(-5) === 1)
check('a normal value passes through', clampDays(30) === 30)
check('a numeric string is accepted', clampDays('14') === 14)

// --- the area env override --------------------------------------------------

check('empty env yields no areas', parseAreasEnv('').length === 0)
check('undefined env yields no areas', parseAreasEnv(undefined).length === 0)

{
  const parsed = parseAreasEnv('Tirana, Albania (anywhere), Germany')
  check('env splits on commas', parsed.length === 3)
  check('env trims entries', parsed[2] === 'Germany')
}

{
  // A stray comma must degrade, never throw — the nightly run depends on it.
  const parsed = parseAreasEnv('Tirana,,  , Vlorë')
  check('blank entries are skipped, not fatal', parsed.length === 2)
  check('the good entries survive', parsed.join() === 'Tirana,Vlorë')
}

// --- the beat ---------------------------------------------------------------

{
  const beat = fullBeat()
  check('the default beat covers home and diaspora', beat.length === HOME_AREAS.length + DIASPORA_AREAS.length)
  check('home areas are scoped local', beat[0].scope === 'local')
  check('diaspora areas are scoped diaspora', beat[beat.length - 1].scope === 'diaspora')
  check('the beat includes a nationwide brief', beat.some((b) => b.area.startsWith('Albania (')))
  check('the beat includes Kosovo', beat.some((b) => b.area.includes('Kosovo')))
  check('the beat includes Germany as diaspora', beat.some((b) => b.area === 'Germany' && b.scope === 'diaspora'))
}

{
  const beat = fullBeat({ areas: 'Berat', diaspora: 'Sweden' })
  check('env replaces both halves', beat.length === 2)
  check('env home area is local', beat[0].area === 'Berat' && beat[0].scope === 'local')
  check('env diaspora area is diaspora', beat[1].area === 'Sweden' && beat[1].scope === 'diaspora')
}

{
  const beat = fullBeat({ diaspora: 'none' })
  check('diaspora can be switched off', beat.every((b) => b.scope === 'local'))
  check('…without touching the home half', beat.length === HOME_AREAS.length)
}

// --- rotation ---------------------------------------------------------------

{
  const beat = fullBeat()
  const a = rotateBriefs(beat, 5, 0)
  const b = rotateBriefs(beat, 5, 5)
  check('a run takes only its slice', a.length === 5)
  check('a different day gets a different slice', a[0].area !== b[0].area)
  check('the slice is stable for the same day', rotateBriefs(beat, 5, 0)[0].area === a[0].area)
}

{
  const beat = fullBeat()
  // Walk a full cycle and confirm every area is eventually visited — the point
  // of rotating without a stored cursor is that nothing can starve.
  const seen = new Set()
  for (let day = 0; day < beat.length; day++) {
    for (const b of rotateBriefs(beat, DEFAULT_BRIEFS_PER_RUN, day)) seen.add(b.area)
  }
  check('every area in the beat comes round', seen.size === beat.length)
}

{
  const beat = fullBeat()
  check('wrapping past the end works', rotateBriefs(beat, 3, beat.length - 1).length === 3)
  check('a negative day index is handled', rotateBriefs(beat, 3, -1).length === 3)
  check('asking for more than exists returns all', rotateBriefs(beat, 999, 0).length === beat.length)
  check('an empty beat yields nothing', rotateBriefs([], 5, 0).length === 0)
}

check('day index advances by one per day', dayIndexFor('2026-08-25') - dayIndexFor('2026-08-24') === 1)

// --- brief assembly ---------------------------------------------------------

{
  const briefs = buildBriefs({ todayIso: '2026-08-24' })
  check('a run defaults to one rotated slice', briefs.length === DEFAULT_BRIEFS_PER_RUN)
  check('briefs carry the default window', briefs[0].days === DEFAULT_DAYS)
}

{
  const briefs = buildBriefs({ areas: ['Sarandë, Albania'], days: 7 })
  check('an explicit area runs alone', briefs.length === 1 && briefs[0].area === 'Sarandë, Albania')
  check('an explicit window is honoured', briefs[0].days === 7)
  check('an explicit area defaults to local scope', briefs[0].scope === 'local')
}

{
  const briefs = buildBriefs({ areas: ['Germany'], scope: 'diaspora' })
  check('an explicit diaspora search keeps its scope', briefs[0].scope === 'diaspora')
}

{
  const briefs = buildBriefs({ days: 500, todayIso: '2026-08-24' })
  check('an absurd window is clamped before it reaches a brief', briefs[0].days === 90)
}

console.log(failed === 0 ? '\nAll scout tests passed.' : `\n${failed} test(s) failed.`)
process.exit(failed === 0 ? 0 : 1)
