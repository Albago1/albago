// Resolves the IANA timezone for an event from its country + location_slug,
// and converts a wall-clock date/time at that zone into a real UTC instant so
// countdowns line up for every viewer regardless of where they are browsing.
//
// We do this client-side from a static map because `cities.timezone` is NULL
// for every row today (see schema-reference.md §cities) and the protest data
// set is small. Country fallback covers ~95% of cases; per-slug overrides
// handle the US (where country alone isn't enough — Michigan is Eastern, but
// Phoenix is on its own).

const COUNTRY_TIMEZONES: Record<string, string> = {
  albania: 'Europe/Tirane',
  kosovo: 'Europe/Belgrade',
  germany: 'Europe/Berlin',
  'united kingdom': 'Europe/London',
  uk: 'Europe/London',
  england: 'Europe/London',
  scotland: 'Europe/London',
  wales: 'Europe/London',
  france: 'Europe/Paris',
  netherlands: 'Europe/Amsterdam',
  holland: 'Europe/Amsterdam',
  italy: 'Europe/Rome',
  switzerland: 'Europe/Zurich',
  greece: 'Europe/Athens',
  austria: 'Europe/Vienna',
  belgium: 'Europe/Brussels',
  spain: 'Europe/Madrid',
  usa: 'America/New_York',
  'united states': 'America/New_York',
  us: 'America/New_York',
  canada: 'America/Toronto',
  australia: 'Australia/Sydney',
  'north macedonia': 'Europe/Skopje',
  macedonia: 'Europe/Skopje',
  serbia: 'Europe/Belgrade',
  montenegro: 'Europe/Podgorica',
  bosnia: 'Europe/Sarajevo',
  'bosnia and herzegovina': 'Europe/Sarajevo',
  croatia: 'Europe/Zagreb',
  hungary: 'Europe/Budapest',
  czechia: 'Europe/Prague',
  'czech republic': 'Europe/Prague',
  slovenia: 'Europe/Ljubljana',
  sweden: 'Europe/Stockholm',
  norway: 'Europe/Oslo',
  denmark: 'Europe/Copenhagen',
  finland: 'Europe/Helsinki',
  ireland: 'Europe/Dublin',
  portugal: 'Europe/Lisbon',
  turkey: 'Europe/Istanbul',
}

// Per-slug overrides where the country fallback would land in the wrong zone.
// Most relevant for the US — Michigan is Eastern (Detroit), Chicago is Central,
// Denver is Mountain, LA/SF/Seattle are Pacific, Phoenix doesn't observe DST.
const SLUG_TIMEZONES: Record<string, string> = {
  troy: 'America/Detroit',
  'mount-clemens': 'America/Detroit',
  detroit: 'America/Detroit',
  'michigan-troy': 'America/Detroit',
  'michigan-mount-clemens': 'America/Detroit',
  chicago: 'America/Chicago',
  houston: 'America/Chicago',
  dallas: 'America/Chicago',
  'new-orleans': 'America/Chicago',
  denver: 'America/Denver',
  'salt-lake-city': 'America/Denver',
  phoenix: 'America/Phoenix',
  'los-angeles': 'America/Los_Angeles',
  'san-francisco': 'America/Los_Angeles',
  'san-diego': 'America/Los_Angeles',
  seattle: 'America/Los_Angeles',
  portland: 'America/Los_Angeles',
}

export function getEventTimezone(
  locationSlug: string | null | undefined,
  country: string | null | undefined,
): string {
  if (locationSlug) {
    const key = locationSlug.toLowerCase()
    if (SLUG_TIMEZONES[key]) return SLUG_TIMEZONES[key]
  }
  if (country) {
    const key = country.trim().toLowerCase()
    if (COUNTRY_TIMEZONES[key]) return COUNTRY_TIMEZONES[key]
  }
  return 'UTC'
}

// Convert a wall-clock date+time in `timeZone` into a UTC ms timestamp.
// Uses an Intl.DateTimeFormat round-trip so any zone (and any DST transition)
// is handled by the browser's tz database instead of a hand-rolled offset.
//
// dateStr: "YYYY-MM-DD"     timeStr: "HH:MM" or "HH:MM:SS"     timeZone: IANA
export function zonedWallClockToUtcMs(
  dateStr: string,
  timeStr: string,
  timeZone: string,
): number {
  const [yStr, mStr, dStr] = dateStr.split('-')
  const [hStr, miStr] = timeStr.split(':')
  const y = Number(yStr)
  const m = Number(mStr)
  const d = Number(dStr)
  const h = Number(hStr)
  const mi = Number(miStr)
  if (!y || !m || !d || Number.isNaN(h) || Number.isNaN(mi)) return NaN

  // Step 1: pretend the wall-clock is UTC so we have a starting instant.
  const naiveUtcMs = Date.UTC(y, m - 1, d, h, mi)

  // Step 2: ask `timeZone` what wall-clock it sees at that same instant.
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
  const parts = fmt.formatToParts(new Date(naiveUtcMs))
  const pick = (t: string) => Number(parts.find((p) => p.type === t)?.value)
  const ty = pick('year')
  const tm = pick('month')
  const td = pick('day')
  let th = pick('hour')
  if (th === 24) th = 0 // Chrome/V8 emit "24" for midnight under hour12:false
  const tmin = pick('minute')

  const zoneAsUtcMs = Date.UTC(ty, tm - 1, td, th, tmin)

  // Step 3: the gap is the zone's offset from UTC at that moment; subtract it.
  const offset = zoneAsUtcMs - naiveUtcMs
  return naiveUtcMs - offset
}
