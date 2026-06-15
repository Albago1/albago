// Build "Add to calendar" links and ICS content for an event.
//
// Time semantics: events are stored as wall-clock times at the event location.
// If a timezone is set, we tag start/end with it (Google &ctz, ICS TZID). If
// not, we emit floating times — the user's calendar app will interpret them
// in its own zone, which is the standard fallback used by most event apps.

export type CalendarEventInput = {
  id: string
  slug: string
  title: string
  description: string | null
  date: string // YYYY-MM-DD
  time: string | null // HH:MM (24h)
  end_time: string | null // HH:MM (24h)
  timezone: string | null // IANA TZ, e.g. "Europe/Berlin"
  is_online: boolean | null
  online_url: string | null
  address: string | null
  venueName?: string | null
  venueAddress?: string | null
  city: string
  country: string | null
  pageUrl: string // canonical event URL
}

type Block = {
  startLocal: string // YYYYMMDDTHHmmss (no Z)
  endLocal: string
  allDay: boolean
  startDate: string // YYYYMMDD (used when allDay)
  endDate: string
  timezone: string | null
}

const DEFAULT_DURATION_HOURS = 2

function pad(n: number) {
  return n.toString().padStart(2, '0')
}

function toCompactDate(iso: string): string {
  return iso.replace(/-/g, '')
}

function addHours(date: string, time: string, hours: number): { date: string; time: string } {
  const [y, m, d] = date.split('-').map(Number)
  const [hh, mm] = time.split(':').map(Number)
  const local = new Date(y, m - 1, d, hh, mm, 0)
  local.setHours(local.getHours() + hours)
  return {
    date: `${local.getFullYear()}-${pad(local.getMonth() + 1)}-${pad(local.getDate())}`,
    time: `${pad(local.getHours())}:${pad(local.getMinutes())}`,
  }
}

function buildBlock(ev: CalendarEventInput): Block {
  const allDay = !ev.time
  if (allDay) {
    // Calendars expect end date to be the day *after* the last day for
    // all-day events (exclusive end).
    const [y, m, d] = ev.date.split('-').map(Number)
    const startD = new Date(y, m - 1, d)
    const endD = new Date(y, m - 1, d + 1)
    const endDate = `${endD.getFullYear()}-${pad(endD.getMonth() + 1)}-${pad(endD.getDate())}`
    return {
      startLocal: `${toCompactDate(ev.date)}T000000`,
      endLocal: `${toCompactDate(endDate)}T000000`,
      allDay: true,
      startDate: toCompactDate(ev.date),
      endDate: toCompactDate(endDate),
      timezone: ev.timezone ?? null,
    }
  }

  const start = `${ev.date}T${ev.time}`
  let endDate = ev.date
  let endTime = ev.end_time
  if (!endTime) {
    const shifted = addHours(ev.date, ev.time!, DEFAULT_DURATION_HOURS)
    endDate = shifted.date
    endTime = shifted.time
  }
  const startCompact = start.replace(/[-:]/g, '').replace('T', 'T') + '00'
  const endCompact = `${endDate}T${endTime}`.replace(/[-:]/g, '').replace('T', 'T') + '00'
  return {
    startLocal: startCompact,
    endLocal: endCompact,
    allDay: false,
    startDate: toCompactDate(ev.date),
    endDate: toCompactDate(endDate),
    timezone: ev.timezone ?? null,
  }
}

function locationText(ev: CalendarEventInput): string {
  if (ev.is_online && ev.online_url) return ev.online_url
  if (ev.address && ev.address.trim()) return ev.address.trim()
  if (ev.venueAddress && ev.venueAddress.trim()) {
    return ev.venueName ? `${ev.venueName}, ${ev.venueAddress.trim()}` : ev.venueAddress.trim()
  }
  if (ev.venueName) return ev.venueName
  return ev.country ? `${ev.city}, ${ev.country}` : ev.city
}

function detailsText(ev: CalendarEventInput): string {
  const parts: string[] = []
  if (ev.description && ev.description.trim()) parts.push(ev.description.trim())
  parts.push(`More info: ${ev.pageUrl}`)
  if (ev.is_online && ev.online_url) parts.push(`Join online: ${ev.online_url}`)
  if (!ev.timezone) {
    parts.push(
      `Time shown is local to ${ev.country ? `${ev.city}, ${ev.country}` : ev.city}.`,
    )
  }
  return parts.join('\n\n')
}

export function buildGoogleCalendarUrl(ev: CalendarEventInput): string {
  const block = buildBlock(ev)
  const dates = block.allDay
    ? `${block.startDate}/${block.endDate}`
    : `${block.startLocal}/${block.endLocal}`
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: ev.title,
    dates,
    details: detailsText(ev),
    location: locationText(ev),
  })
  if (block.timezone) params.set('ctz', block.timezone)
  return `https://calendar.google.com/calendar/render?${params.toString()}`
}

export function buildOutlookUrl(ev: CalendarEventInput): string {
  const block = buildBlock(ev)
  // Outlook Web expects ISO-ish local times (no zone).
  const fmt = (compact: string) => {
    // 20260615T190000 → 2026-06-15T19:00:00
    const y = compact.slice(0, 4)
    const m = compact.slice(4, 6)
    const d = compact.slice(6, 8)
    const hh = compact.slice(9, 11)
    const mm = compact.slice(11, 13)
    const ss = compact.slice(13, 15)
    return `${y}-${m}-${d}T${hh}:${mm}:${ss}`
  }
  const params = new URLSearchParams({
    path: '/calendar/action/compose',
    rru: 'addevent',
    subject: ev.title,
    startdt: fmt(block.startLocal),
    enddt: fmt(block.endLocal),
    body: detailsText(ev),
    location: locationText(ev),
  })
  if (block.allDay) params.set('allday', 'true')
  return `https://outlook.live.com/calendar/0/deeplink/compose?${params.toString()}`
}

export function buildYahooUrl(ev: CalendarEventInput): string {
  const block = buildBlock(ev)
  const params = new URLSearchParams({
    v: '60',
    title: ev.title,
    st: block.startLocal,
    et: block.endLocal,
    desc: detailsText(ev),
    in_loc: locationText(ev),
  })
  if (block.allDay) params.set('dur', 'allday')
  return `https://calendar.yahoo.com/?${params.toString()}`
}

function escapeIcs(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/\r?\n/g, '\\n')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;')
}

function nowUtcCompact(): string {
  const d = new Date()
  return (
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}` +
    `T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
  )
}

export function buildIcsContent(ev: CalendarEventInput): string {
  const block = buildBlock(ev)
  const lines: string[] = []
  lines.push('BEGIN:VCALENDAR')
  lines.push('VERSION:2.0')
  lines.push('PRODID:-//AlbaGo//Events//EN')
  lines.push('CALSCALE:GREGORIAN')
  lines.push('METHOD:PUBLISH')
  lines.push('BEGIN:VEVENT')
  lines.push(`UID:${ev.id}@albago.org`)
  lines.push(`DTSTAMP:${nowUtcCompact()}`)
  if (block.allDay) {
    lines.push(`DTSTART;VALUE=DATE:${block.startDate}`)
    lines.push(`DTEND;VALUE=DATE:${block.endDate}`)
  } else if (block.timezone) {
    lines.push(`DTSTART;TZID=${block.timezone}:${block.startLocal}`)
    lines.push(`DTEND;TZID=${block.timezone}:${block.endLocal}`)
  } else {
    // Floating local time — calendar interprets in its own zone.
    lines.push(`DTSTART:${block.startLocal}`)
    lines.push(`DTEND:${block.endLocal}`)
  }
  lines.push(`SUMMARY:${escapeIcs(ev.title)}`)
  lines.push(`DESCRIPTION:${escapeIcs(detailsText(ev))}`)
  lines.push(`LOCATION:${escapeIcs(locationText(ev))}`)
  lines.push(`URL:${ev.pageUrl}`)
  lines.push('END:VEVENT')
  lines.push('END:VCALENDAR')
  // RFC 5545 mandates CRLF line endings.
  return lines.join('\r\n')
}

export function downloadIcsFile(ev: CalendarEventInput): void {
  const ics = buildIcsContent(ev)
  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${ev.slug || 'event'}.ics`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
