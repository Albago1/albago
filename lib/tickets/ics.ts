/**
 * Minimal iCalendar (.ics) builder for ticket confirmation emails (Phase 33).
 * Times are written with the event's IANA TZID (Google/Apple resolve
 * well-known zones without an embedded VTIMEZONE); no time → all-day event.
 */

export type IcsEventInput = {
  /** Stable UID, e.g. `${orderId}@albago.org`. */
  uid: string
  title: string
  description: string | null
  date: string // YYYY-MM-DD
  time: string | null // HH:MM[:SS]
  endDate: string | null
  endTime: string | null
  timezone: string | null
  location: string | null
  lat: number | null
  lng: number | null
  url: string
}

function esc(raw: string): string {
  return raw
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n')
}

function compact(date: string): string {
  return date.replace(/-/g, '')
}

function compactTime(time: string): string {
  const [h = '00', m = '00'] = time.split(':')
  return `${h.padStart(2, '0')}${m.padStart(2, '0')}00`
}

/** time + 3h fallback end, rolling the date when it crosses midnight. */
function plusThreeHours(date: string, time: string): { date: string; time: string } {
  const dt = new Date(`${date}T${time.slice(0, 5)}:00`)
  dt.setHours(dt.getHours() + 3)
  const pad = (n: number) => String(n).padStart(2, '0')
  return {
    date: `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`,
    time: `${pad(dt.getHours())}:${pad(dt.getMinutes())}`,
  }
}

export function buildEventIcs(input: IcsEventInput): string {
  const tz = input.timezone?.trim() || 'Europe/Tirane'
  const stamp = new Date()
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}Z$/, 'Z')

  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//AlbaGo//Tickets//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${esc(input.uid)}`,
    `DTSTAMP:${stamp}`,
    `SUMMARY:${esc(input.title)}`,
  ]

  if (input.time) {
    const end =
      input.endTime != null
        ? { date: input.endDate ?? input.date, time: input.endTime }
        : plusThreeHours(input.endDate ?? input.date, input.time)
    lines.push(
      `DTSTART;TZID=${tz}:${compact(input.date)}T${compactTime(input.time)}`,
      `DTEND;TZID=${tz}:${compact(end.date)}T${compactTime(end.time)}`,
    )
  } else {
    lines.push(`DTSTART;VALUE=DATE:${compact(input.date)}`)
    if (input.endDate && input.endDate > input.date) {
      lines.push(`DTEND;VALUE=DATE:${compact(input.endDate)}`)
    }
  }

  if (input.location) lines.push(`LOCATION:${esc(input.location)}`)
  if (input.lat != null && input.lng != null) {
    lines.push(`GEO:${input.lat.toFixed(6)};${input.lng.toFixed(6)}`)
  }
  if (input.description) lines.push(`DESCRIPTION:${esc(input.description)}`)
  lines.push(`URL:${esc(input.url)}`, 'END:VEVENT', 'END:VCALENDAR')

  return lines.join('\r\n')
}
