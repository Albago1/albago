/**
 * Pure helpers for the Phase 15 recurrence model.
 *
 * The DB shape on an `events` row:
 *   date                    text  (YYYY-MM-DD)     — first occurrence
 *   time                    text  (HH:MM)           — local time
 *   recurrence              text                    — 'none' | 'daily' | 'weekly'
 *   recurrence_until        text  (YYYY-MM-DD)|null — last day the series runs
 *   recurrence_days_of_week int[] (ISO 1=Mon..7=Sun)
 *   recurrence_exceptions   text[](YYYY-MM-DD)      — skipped dates
 *
 * All dates are kept as ISO date strings (no timezone math) so the same code
 * works in Server Components and the browser.
 */

export type RecurrenceKind = 'none' | 'daily' | 'weekly'

export type Recurring = {
  date: string
  time?: string | null
  recurrence?: string | null
  recurrence_until?: string | null
  recurrence_days_of_week?: number[] | null
  recurrence_exceptions?: string[] | null
}

// ---------------------------------------------------------------------------
// Date helpers (work in YYYY-MM-DD strings)
// ---------------------------------------------------------------------------

export function todayIso(): string {
  const d = new Date()
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
  ].join('-')
}

function parseIso(iso: string): Date | null {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null
  const [y, m, d] = iso.split('-').map(Number)
  // Local-midnight construction avoids UTC offset surprises.
  return new Date(y, m - 1, d)
}

function toIso(d: Date): string {
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
  ].join('-')
}

function addDays(iso: string, n: number): string {
  const d = parseIso(iso)
  if (!d) return iso
  d.setDate(d.getDate() + n)
  return toIso(d)
}

/** ISO weekday: Mon=1..Sun=7. */
function isoWeekday(iso: string): number {
  const d = parseIso(iso)
  if (!d) return 1
  const dow = d.getDay() // 0=Sun..6=Sat
  return dow === 0 ? 7 : dow
}

// ---------------------------------------------------------------------------
// Recurrence kind + classifiers
// ---------------------------------------------------------------------------

export function recurrenceKind(ev: Recurring): RecurrenceKind {
  const r = (ev.recurrence ?? 'none').toLowerCase()
  return r === 'daily' || r === 'weekly' ? r : 'none'
}

export function isRecurring(ev: Recurring): boolean {
  return recurrenceKind(ev) !== 'none'
}

// ---------------------------------------------------------------------------
// Match a single date
// ---------------------------------------------------------------------------

/** True iff the event runs on the given ISO date. */
export function eventMatchesDate(ev: Recurring, iso: string): boolean {
  if (!iso) return false
  const kind = recurrenceKind(ev)
  if (kind === 'none') {
    return ev.date === iso
  }
  // Series start must be on or before the queried date.
  if (ev.date > iso) return false
  // Series end honoured if present.
  if (ev.recurrence_until && iso > ev.recurrence_until) return false
  // Exceptions skip individual dates.
  if (ev.recurrence_exceptions?.includes(iso)) return false

  if (kind === 'daily') return true

  // Weekly — must match one of the picked weekdays.
  const dows = ev.recurrence_days_of_week ?? []
  if (dows.length === 0) {
    // Fallback: if nothing was picked, run on the same weekday as `date`.
    return isoWeekday(iso) === isoWeekday(ev.date)
  }
  return dows.includes(isoWeekday(iso))
}

// ---------------------------------------------------------------------------
// Next / next-N occurrences
// ---------------------------------------------------------------------------

/** Next ISO date the event runs (>= `from`). null if the series has ended. */
export function nextOccurrence(
  ev: Recurring,
  from: string = todayIso(),
): string | null {
  const kind = recurrenceKind(ev)
  if (kind === 'none') {
    return ev.date >= from ? ev.date : null
  }
  let cursor = from < ev.date ? ev.date : from
  // Cap the scan so a misconfigured event can't loop forever.
  for (let i = 0; i < 366; i++) {
    if (ev.recurrence_until && cursor > ev.recurrence_until) return null
    if (eventMatchesDate(ev, cursor)) return cursor
    cursor = addDays(cursor, 1)
  }
  return null
}

export function upcomingOccurrences(
  ev: Recurring,
  count: number,
  from: string = todayIso(),
): string[] {
  const out: string[] = []
  let cursor = from
  for (let i = 0; i < 730 && out.length < count; i++) {
    const hit = nextOccurrence(ev, cursor)
    if (!hit) break
    out.push(hit)
    cursor = addDays(hit, 1)
  }
  return out
}

// ---------------------------------------------------------------------------
// Within a [from, to] window
// ---------------------------------------------------------------------------

export function hasOccurrenceInRange(
  ev: Recurring,
  from: string,
  to: string,
): boolean {
  if (from > to) return false
  const hit = nextOccurrence(ev, from)
  if (!hit) return false
  return hit <= to
}

// ---------------------------------------------------------------------------
// Human label
// ---------------------------------------------------------------------------

const WEEKDAY_SHORT: Record<number, string> = {
  1: 'Mon',
  2: 'Tue',
  3: 'Wed',
  4: 'Thu',
  5: 'Fri',
  6: 'Sat',
  7: 'Sun',
}

const MONTH_SHORT = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
]

function isoToShort(iso: string): string {
  const d = parseIso(iso)
  if (!d) return iso
  return `${MONTH_SHORT[d.getMonth()]} ${d.getDate()}`
}

/**
 * Short label for the cadence. Examples:
 *   Daily
 *   Daily · until Aug 14
 *   Mon Wed Fri
 *   Mon Wed Fri · until Aug 14
 *   "" (returned for non-recurring events)
 */
export function recurrenceLabel(ev: Recurring): string {
  const kind = recurrenceKind(ev)
  if (kind === 'none') return ''
  let head: string
  if (kind === 'daily') {
    head = 'Daily'
  } else {
    const dows = (ev.recurrence_days_of_week ?? []).slice().sort()
    head =
      dows.length === 0
        ? `Weekly · ${WEEKDAY_SHORT[isoWeekday(ev.date)]}`
        : dows.map((d) => WEEKDAY_SHORT[d] ?? '').join(' ')
  }
  if (ev.recurrence_until) {
    return `${head} · until ${isoToShort(ev.recurrence_until)}`
  }
  return head
}

/**
 * Friendly "Next: …" string for a recurring event card. Returns null for
 * non-recurring events or fully-elapsed series.
 */
export function nextOccurrenceLabel(
  ev: Recurring,
  from: string = todayIso(),
): string | null {
  const next = nextOccurrence(ev, from)
  if (!next) return null
  const time = ev.time && ev.time.length >= 5 ? ev.time.slice(0, 5) : ev.time
  if (next === from) return time ? `Today · ${time}` : 'Today'
  if (next === addDays(from, 1)) {
    return time ? `Tomorrow · ${time}` : 'Tomorrow'
  }
  return time ? `${isoToShort(next)} · ${time}` : isoToShort(next)
}
