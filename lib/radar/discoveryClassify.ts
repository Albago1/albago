import type { CandidateStatus } from './candidate'

/**
 * Discovery Agent — pure outcome classification. No I/O, no server-only, so the
 * self-test suite can load it directly. `discovery.ts` (server-only) imports
 * from here; keeping the mapping pure is what makes the counts the admin sees
 * deterministically testable.
 */

export type DiscoveryOutcome =
  | 'imported' // a new scored candidate landed in the review queue
  | 'duplicate' // already imported (same normalized_url) — skipped
  | 'not_event' // read fine, but the page isn't an event — dropped, not queued
  | 'unreadable' // page couldn't be read; persisted as a retryable `failed` candidate
  | 'error' // the import itself errored (db/invalid) — nothing stored

// A discovered page is only kept if the reader is confident it's a real event.
// Junk links (nav/section pages that merely contain an event-ish word) come back
// is_event:false or with a thin confidence and are dropped before they can clog
// the queue. Mirrors the crawler's own autonomous-find bar (CRAWL_MIN_CONFIDENCE).
export const DISCOVERY_MIN_CONFIDENCE = 0.35

/** Does an extracted reading clear the bar to become a real candidate? */
export function isKeepableEvent(reading: {
  is_event: boolean
  confidence: number
} | null): boolean {
  if (!reading) return false
  return reading.is_event === true && reading.confidence >= DISCOVERY_MIN_CONFIDENCE
}

/** The minimal structural shape of `importFromUrl`'s result this needs. */
export type ImportOutcomeInput =
  | { ok: true; duplicate: boolean; candidate: { id: string; status: CandidateStatus; error: string | null } }
  | { ok: false; code: string; message: string }

export type ClassifiedOutcome = {
  outcome: DiscoveryOutcome
  candidateId?: string
  message?: string
}

/**
 * Map one import result to a discovery outcome. The ordering matters:
 *  - a hard error (bad url / db) wins first — nothing was stored;
 *  - an idempotent hit (duplicate) is a skip, not a new find;
 *  - a persisted `failed` candidate is "unreadable" (visible + retryable);
 *  - anything else is a genuine new scored candidate.
 */
export function classifyImportOutcome(result: ImportOutcomeInput): ClassifiedOutcome {
  if (!result.ok) return { outcome: 'error', message: result.message }
  if (result.duplicate) return { outcome: 'duplicate', candidateId: result.candidate.id }
  if (result.candidate.status === 'failed') {
    return {
      outcome: 'unreadable',
      candidateId: result.candidate.id,
      message: result.candidate.error ?? undefined,
    }
  }
  return { outcome: 'imported', candidateId: result.candidate.id }
}
