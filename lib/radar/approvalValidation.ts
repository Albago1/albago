import type { PosterReading } from '@/lib/ai/posterReader'

/**
 * Event Radar (RADAR-1) approval gate. Pure — no I/O, safe in tests.
 *
 * The queue table `event_submissions` has NOT NULL columns. crawlReadingToSubmission
 * fills most of them with non-null fallbacks ('TBA' venue, 'culture' category,
 * 'Unknown' country, 'unknown' location_slug), so the only columns that can
 * arrive null/empty from an admin's draft are the three that come straight from
 * the reading with no fallback: title, date, and time. Of these, `time` maps
 * through orNull() → NULL and trips `time NOT NULL` (the observed production
 * bug); empty title/date pass the NOT NULL check but are invalid to publish.
 *
 * So these three are the required-before-approval fields. `price` is nullable in
 * the queue schema → never a blocker. Venue/coords are resolution warnings, not
 * blockers (the mapping supplies a 'TBA' venue fallback).
 */

export type RequiredKey = 'title' | 'date' | 'time'
export type ApprovalField = { field: RequiredKey; label: string }

// Ordered as they should be surfaced to the admin.
export const REQUIRED_APPROVAL_FIELDS: ApprovalField[] = [
  { field: 'title', label: 'Title' },
  { field: 'date', label: 'Event date' },
  { field: 'time', label: 'Start time' },
]

function isBlank(value: unknown): boolean {
  return value == null || (typeof value === 'string' && value.trim().length === 0)
}

/**
 * The required fields still missing from a draft. Operates on any reading-like
 * object (the stored reading OR the live edit form), so the server guard and the
 * client button share one source of truth and can never disagree. `00:00` is a
 * real value and passes; only blank/whitespace fails.
 */
export function missingApprovalFields(
  reading: Partial<Pick<PosterReading, RequiredKey>> | null | undefined,
): ApprovalField[] {
  if (!reading) return REQUIRED_APPROVAL_FIELDS
  return REQUIRED_APPROVAL_FIELDS.filter(({ field }) => isBlank(reading[field]))
}

/** True when the draft has every field required to reach the queue. */
export function canApprove(
  reading: Partial<Pick<PosterReading, RequiredKey>> | null | undefined,
): boolean {
  return missingApprovalFields(reading).length === 0
}

/**
 * Final safety net: turn a PostgreSQL insert error into a safe, useful
 * admin-facing sentence. The full technical error stays server-side (the caller
 * logs it) — never expose SQL, columns beyond the friendly mapping, or stack
 * traces to the client.
 */
export function translateSubmissionError(
  err: { code?: string | null; message?: string | null } | null | undefined,
): string {
  const code = err?.code ?? ''
  const msg = err?.message ?? ''

  if (code === '23502') {
    // not_null_violation — name the field when we recognise it.
    if (/"time"/.test(msg)) return 'Start time is required by the event submission workflow.'
    if (/"date"/.test(msg)) return 'The event date is required.'
    if (/"title"/.test(msg)) return 'The event title is required.'
    if (/"venue_name"/.test(msg)) return 'A venue name is required.'
    if (/"category"/.test(msg)) return 'A category is required.'
    // Any other NOT NULL column: surface its name so the gap is never a mystery.
    // PG phrases it: null value in column "X" of relation "..." violates ...
    const col = msg.match(/column "([^"]+)"/)?.[1]
    if (col) return `The submission queue requires a value for "${col}", which this import left empty.`
    return 'A required field is missing for the submission queue.'
  }
  if (code === '23505') return 'This candidate has already been sent to the queue.'
  if (code === '22007' || code === '22008') return 'The event date or time is not a valid value.'
  if (code === '23514') return 'A field failed a validation rule required by the queue.'
  return 'Could not create the submission. The issue was logged for the team.'
}
