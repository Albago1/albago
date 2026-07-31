import type { PosterReading } from '@/lib/ai/posterReader'
import { titlesMatch } from '@/lib/lens/resolve'

/**
 * Verification loop — pure decision logic. No I/O, no server-only, so it's
 * unit-testable. Given a published event and a FRESH re-read of its official
 * source page, decide what (if anything) to change.
 *
 * SAFETY IS THE WHOLE POINT. A scraper re-reading a page is not authoritative
 * enough to CANCEL an event — a transient block, a site redesign, or a thin
 * re-read must never wipe a real listing. So the only status the loop ever
 * writes automatically is the NEUTRAL `updated` flag (public banner: "details
 * updated"), and only when the same event is clearly still there but its date
 * moved. Everything more consequential — cancellations, a source that has gone
 * dark, a different event now on the page — is REPORTED for a human, never
 * auto-applied. Freshness stamping (last_verified_at) is the safe default win.
 */

export type VerifyAction =
  | 'verified' // same event, same date, still live → stamp last_verified_at
  | 'date_changed' // same event, date moved → stamp + neutral `updated` flag
  | 'flag_changed' // a DIFFERENT event is on the page now → report, no write
  | 'flag_missing' // page no longer presents an event → report, no write
  | 'unreadable' // couldn't re-read (transient/block) → report, no write

export type VerifyVerdict = {
  action: VerifyAction
  /** Whether to stamp last_verified_at = now (only when we positively re-saw it). */
  stampVerified: boolean
  /** A listing_status to write, or null to leave it untouched. Only ever `updated`. */
  newListingStatus: 'updated' | null
  /** The date the re-read now shows, when it differs — for the admin to reconcile. */
  observedDate?: string
  note: string
}

/**
 * Decide the verdict for one event.
 * @param event    the stored event's identifying facts
 * @param reading  the fresh re-read of its source, or null if it couldn't be read
 */
export function decideVerify(
  event: { title: string; date: string },
  reading: PosterReading | null,
): VerifyVerdict {
  // Couldn't fetch/extract — could be a transient block or a JS-only page. Never
  // punish the listing for that; leave everything, let it resurface next run.
  if (!reading) {
    return {
      action: 'unreadable',
      stampVerified: false,
      newListingStatus: null,
      note: 'Source could not be re-read (blocked, JavaScript-only, or offline). Left unchanged.',
    }
  }

  // The page no longer looks like an event. This is the "maybe cancelled/removed"
  // signal — but a redesign or moved page looks identical, so we only FLAG it.
  if (reading.is_event === false) {
    return {
      action: 'flag_missing',
      stampVerified: false,
      newListingStatus: null,
      note: 'The source page no longer presents an event — verify whether it was cancelled or the page moved.',
    }
  }

  // A real event is on the page, but is it THIS one? A different event now living
  // at the same URL means the source recycled the page; don't touch our listing.
  if (reading.title && !titlesMatch(event.title, reading.title)) {
    return {
      action: 'flag_changed',
      stampVerified: false,
      newListingStatus: null,
      observedDate: reading.date || undefined,
      note: `The source now shows a different event ("${reading.title}") — review before trusting the re-read.`,
    }
  }

  // Same event, still there. If the date moved, flag it neutrally (never cancel);
  // otherwise it's a clean re-verification.
  if (reading.date && reading.date !== event.date) {
    return {
      action: 'date_changed',
      stampVerified: true,
      newListingStatus: 'updated',
      observedDate: reading.date,
      note: `Still live, but the source date changed from ${event.date} to ${reading.date}. Flagged as updated — reconcile the date.`,
    }
  }

  return {
    action: 'verified',
    stampVerified: true,
    newListingStatus: null,
    note: 'Re-confirmed live and unchanged.',
  }
}
