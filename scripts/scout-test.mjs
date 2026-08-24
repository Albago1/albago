// Scout (Phase 39) self-test — run with:
//   node --import ./scripts/radar-register.mjs scripts/scout-test.mjs
//
// Covers the pure brief logic only. The search itself is a live grounded model
// call and the ingest half is already covered by scripts/ingest-test.mjs.

const { buildBriefs, parseCitiesEnv, clampDays, windowEnd, DEFAULT_CITIES, DEFAULT_DAYS } =
  await import('../lib/scout/brief.ts')

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

// --- the city env override --------------------------------------------------

check('empty env yields no cities', parseCitiesEnv('').length === 0)
check('undefined env yields no cities', parseCitiesEnv(undefined).length === 0)

{
  const parsed = parseCitiesEnv('Tirana:Albania, Prishtina:Kosovo')
  check('env parses both pairs', parsed.length === 2)
  check('env keeps the city', parsed[0].city === 'Tirana')
  check('env keeps the country', parsed[1].country === 'Kosovo')
}

{
  const parsed = parseCitiesEnv('Vlorë')
  check('a bare city defaults to Albania', parsed[0]?.country === 'Albania')
  check('a bare city keeps its diacritics', parsed[0]?.city === 'Vlorë')
}

{
  // A typo in an env var must degrade, never throw — the nightly run depends on it.
  const parsed = parseCitiesEnv('Tirana:Albania,,  ,:Kosovo, Durrës:Albania')
  check('malformed entries are skipped, not fatal', parsed.length === 2)
  check('the good entries survive', parsed.map((c) => c.city).join() === 'Tirana,Durrës')
}

// --- brief assembly ---------------------------------------------------------

{
  const briefs = buildBriefs({})
  check('no input falls back to the default beat', briefs.length === DEFAULT_CITIES.length)
  check('default briefs carry the default window', briefs[0].days === DEFAULT_DAYS)
}

{
  const briefs = buildBriefs({ citiesEnv: 'Berat:Albania' })
  check('env overrides the default beat', briefs.length === 1 && briefs[0].city === 'Berat')
}

{
  const briefs = buildBriefs({
    cities: [{ city: 'Sarandë', country: 'Albania' }],
    citiesEnv: 'Berat:Albania',
    days: 7,
  })
  check('an explicit city beats the env', briefs.length === 1 && briefs[0].city === 'Sarandë')
  check('an explicit window is honoured', briefs[0].days === 7)
}

{
  const briefs = buildBriefs({ days: 500 })
  check('an absurd window is clamped before it reaches a brief', briefs[0].days === 90)
}

console.log(failed === 0 ? '\nAll scout tests passed.' : `\n${failed} test(s) failed.`)
process.exit(failed === 0 ? 0 : 1)
