/**
 * Internal event lifecycle status, named after the schema.org EventStatusType
 * vocabulary so the internal state and the SEO markup never drift apart.
 *
 *   EventScheduled  → live/upcoming (still has a future occurrence)
 *   EventCompleted  → happened as planned and is now in the past
 *   EventCancelled  → row status 'cancelled' (kept for history/SEO)
 *   EventPostponed  → row status 'postponed' (date no longer trustworthy)
 *
 * Derivation order: an explicit row status (cancelled/postponed) always wins;
 * otherwise the date decides scheduled vs completed via `isEventActive`, so
 * this stays consistent with what the public list surfaces show.
 *
 * Note: schema.org has no "completed" member of EventStatusType — a finished
 * event is expressed as EventScheduled with a past startDate. The internal
 * EventCompleted therefore maps back to EventScheduled in the JSON-LD.
 */

import { isEventActive, type ActiveEventShape } from '@/lib/eventActive'
import { isRecurring } from '@/lib/recurrence'

export type EventLifecycleStatus =
  | 'EventScheduled'
  | 'EventCompleted'
  | 'EventCancelled'
  | 'EventPostponed'

export type LifecycleEventShape = ActiveEventShape & {
  status?: string | null
}

export function getEventLifecycleStatus(
  ev: LifecycleEventShape,
): EventLifecycleStatus {
  if (ev.status === 'cancelled') return 'EventCancelled'
  if (ev.status === 'postponed') return 'EventPostponed'
  return isEventActive(ev) ? 'EventScheduled' : 'EventCompleted'
}

/** True when the page should render the "this event has ended" treatment. */
export function isEventEnded(status: EventLifecycleStatus): boolean {
  return status === 'EventCompleted' || status === 'EventCancelled'
}

/**
 * The calendar date an ended event finished on. For a one-off that is the
 * event date; for an ended recurring series it is the series end date.
 */
export function endedOnIso(ev: LifecycleEventShape): string {
  if (isRecurring({ date: ev.date, recurrence: ev.recurrence ?? null })) {
    return ev.recurrence_until ?? ev.date
  }
  // Multi-day continuous events finish on their end_date.
  return ev.end_date && ev.end_date > ev.date ? ev.end_date : ev.date
}

export function schemaOrgEventStatus(status: EventLifecycleStatus): string {
  switch (status) {
    case 'EventCancelled':
      return 'https://schema.org/EventCancelled'
    case 'EventPostponed':
      return 'https://schema.org/EventPostponed'
    // EventCompleted intentionally falls through — see file header.
    default:
      return 'https://schema.org/EventScheduled'
  }
}
