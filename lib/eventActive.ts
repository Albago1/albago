/**
 * Rule for hiding past events from public surfaces.
 *
 *   One-off event (recurrence none/null):
 *     - Hide once `date` is in the past.
 *     - On `date == today`, stay visible until `end_time` passes. If there's
 *       no `end_time`, stay visible all day (we don't know the duration).
 *
 *   Recurring event (daily / weekly):
 *     - Stay visible as long as there's any future occurrence — i.e.
 *       `recurrence_until` is null or `>= today`, and the series isn't
 *       fully covered by exceptions before today.
 *
 * Used as a post-fetch filter; the Supabase wire filter
 * (see `activeEventsOrFilter`) handles the bulk of past-event culling but
 * can't easily express the recurrence-with-end-date and end-time cases, so
 * the JS check is the last word.
 *
 * Admin surfaces (and event detail pages) bypass this so historical events
 * remain editable / viewable by URL — only the public list views call it.
 */

import {
  addDays,
  isOvernight,
  nextOccurrence,
  recurrenceKind,
  todayIso,
} from '@/lib/recurrence'

export type ActiveEventShape = {
  date: string
  end_date?: string | null
  time?: string | null
  end_time?: string | null
  recurrence?: string | null
  recurrence_until?: string | null
  recurrence_days_of_week?: number[] | null
  recurrence_exceptions?: string[] | null
}

function localNowHHMM(): string {
  const d = new Date()
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

/** True iff this event should still appear on public surfaces. */
export function isEventActive(ev: ActiveEventShape): boolean {
  const kind = recurrenceKind({
    date: ev.date,
    recurrence: ev.recurrence ?? null,
  })
  const today = todayIso()

  if (kind === 'none') {
    // Multi-day continuous events (festivals) run through end_date.
    const lastDay =
      ev.end_date && ev.end_date > ev.date ? ev.end_date : ev.date
    // Overnight events (end_time <= time, e.g. 22:00–04:00) actually finish
    // the morning after their last day — the cutoff day shifts by one.
    const cutoffDay = isOvernight(ev.time, ev.end_time)
      ? addDays(lastDay, 1)
      : lastDay
    if (cutoffDay > today) return true
    if (cutoffDay < today) return false
    // Cutoff-day check: respect end_time when set; otherwise stay up all day.
    if (!ev.end_time) return true
    const now = localNowHHMM()
    // Compare 'HH:MM' lexicographically — works because both are zero-padded.
    return now <= ev.end_time
  }

  // Recurring — visible as long as the helper can still find a next run.
  return (
    nextOccurrence(
      {
        date: ev.date,
        time: ev.time ?? null,
        recurrence: ev.recurrence ?? null,
        recurrence_until: ev.recurrence_until ?? null,
        recurrence_days_of_week: ev.recurrence_days_of_week ?? null,
        recurrence_exceptions: ev.recurrence_exceptions ?? null,
      },
      today,
    ) !== null
  )
}

/**
 * Wire-side filter for Supabase `.or(...)`.
 *
 * Keeps a row if either:
 *   - `date >= today`  (covers all upcoming one-offs and recurring series
 *     whose stored start date is still ahead), OR
 *   - `end_date >= today` (multi-day continuous events still in progress), OR
 *   - the row is daily / weekly (recurring with a possibly past start date
 *     but live occurrences ahead — refined client-side by `isEventActive`).
 *
 * Past one-off events are dropped at the wire so we don't pull them over
 * the network on busy list pages.
 */
export function activeEventsOrFilter(today: string = todayIso()): string {
  // date/end_date >= *yesterday*, not today: an overnight event (22:00–04:00)
  // is still live the morning after its stored last day, and PostgREST can't
  // compare end_time to time at the wire. The one extra day of finished rows
  // this lets through is culled client-side by `isEventActive`.
  const yesterday = addDays(today, -1)
  return `date.gte.${yesterday},end_date.gte.${yesterday},recurrence.in.(daily,weekly)`
}
