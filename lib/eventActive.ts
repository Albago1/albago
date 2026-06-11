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

import { nextOccurrence, recurrenceKind, todayIso } from '@/lib/recurrence'

export type ActiveEventShape = {
  date: string
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
    if (ev.date > today) return true
    if (ev.date < today) return false
    // Same-day cutoff: respect end_time when set; otherwise stay up all day.
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
 *   - the row is daily / weekly (recurring with a possibly past start date
 *     but live occurrences ahead — refined client-side by `isEventActive`).
 *
 * Past one-off events are dropped at the wire so we don't pull them over
 * the network on busy list pages.
 */
export function activeEventsOrFilter(today: string = todayIso()): string {
  return `date.gte.${today},recurrence.in.(daily,weekly)`
}
