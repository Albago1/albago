import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/admin'
import { readEventFromUrl } from '@/lib/ai/urlReader'
import { resolvePoster, type LensResolution } from '@/lib/lens/resolve'
import { crawlReadingToSubmission } from '@/lib/crawl/toSubmission'
import type { PosterReading } from '@/lib/ai/posterReader'
import { assessReading } from './assess'
import {
  missingApprovalFields,
  translateSubmissionError,
  type ApprovalField,
} from './approvalValidation'
import { normalizeImportUrl, sourceNameFromUrl } from './normalizeUrl'
import {
  buildCandidateWrite,
  RADAR_PARSER_VERSION,
  type EventImportCandidate,
} from './candidate'

/**
 * Event Radar (RADAR-1) orchestration — the only module that talks to the DB
 * for candidates. Server-only (service-role client): the crawler-proven path,
 * an admin-triggered read of ONE public URL into a reviewable candidate that
 * feeds the existing moderation queue on approval. Nothing here ever publishes.
 *
 * Reuses end-to-end: safeFetch/SSRF + Lens URL reader (extraction, JSON-LD
 * first), resolvePoster (city/venue/coords/dedup), and crawlReadingToSubmission
 * (the identical mapping the crawler uses to land an event_submissions row).
 */

const TABLE = 'event_import_candidates'
const SELECT = '*'

const NONE_RESOLUTION: LensResolution = {
  city: { status: 'none', slug: '', label: '', country: '' },
  venue: { status: 'none' },
  geocode: { status: 'none' },
  duplicate: { status: 'none' },
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

/** A bare-domain / homepage URL (path "/") describes a site, not one event —
 *  worth flagging so the admin verifies the current edition (spec §5). */
function isBroadSource(url: string): boolean {
  try {
    return new URL(url).pathname === '/'
  } catch {
    return false
  }
}

function admin(): SupabaseClient {
  return createAdminClient()
}

/** resolvePoster self-degrades internally, but guard anyway so a resolver throw
 *  never aborts an import — an unresolved (but still usable) candidate is fine. */
async function resolveSafely(reading: PosterReading): Promise<LensResolution> {
  try {
    return await resolvePoster(reading)
  } catch {
    return NONE_RESOLUTION
  }
}

export type ImportResult =
  | { ok: true; candidate: EventImportCandidate; duplicate: boolean }
  | { ok: false; code: 'invalid_url' | 'db_error'; message: string }

/**
 * Import one URL. Idempotent by normalized_url: a URL already imported into a
 * live candidate (needs_review / approved / rejected) is RETURNED, not re-read
 * or clobbered (spec §4.9, §12) — the admin uses Retry to deliberately refresh.
 * A previously-failed URL is re-attempted.
 */
export async function importFromUrl(
  rawUrl: string,
  importedBy: string | null,
): Promise<ImportResult> {
  const normalized = normalizeImportUrl(rawUrl)
  if (!normalized) {
    return {
      ok: false,
      code: 'invalid_url',
      message: 'That is not a valid public http(s) URL.',
    }
  }
  const db = admin()

  const { data: existingRow } = await db
    .from(TABLE)
    .select(SELECT)
    .eq('normalized_url', normalized)
    .maybeSingle()
  const existing = existingRow as EventImportCandidate | null
  if (existing && existing.status !== 'failed') {
    return { ok: true, candidate: existing, duplicate: true }
  }

  const sourceName = sourceNameFromUrl(normalized)
  const baseKeys = {
    source_url: normalized,
    normalized_url: normalized,
    source_name: sourceName,
    imported_by: importedBy,
  }

  // Extraction (SSRF-guarded fetch + Lens). A page we cannot read is persisted
  // as a `failed` candidate — visible and retryable — never a silent drop.
  let read: Awaited<ReturnType<typeof readEventFromUrl>> = null
  try {
    read = await readEventFromUrl(normalized, todayIso())
  } catch {
    read = null
  }

  if (!read) {
    return upsert({
      ...baseKeys,
      status: 'failed',
      error:
        'The page could not be read — it may be login-walled, JavaScript-only, or not reachable. Try pasting the event text into the Queue instead.',
      parser_version: RADAR_PARSER_VERSION,
      updated_at: new Date().toISOString(),
    })
  }

  const resolution = await resolveSafely(read.reading)
  const assessment = assessReading(read.reading, resolution, todayIso(), {
    broadSource: isBroadSource(normalized),
  })
  const write = buildCandidateWrite({
    reading: read.reading,
    resolution,
    assessment,
    imageUrl: read.imageUrl,
    sourceName,
  })

  return upsert({ ...baseKeys, ...write })
}

/** Upsert by normalized_url and return the stored candidate (or a db_error). */
async function upsert(row: Record<string, unknown>): Promise<ImportResult> {
  const { data, error } = await admin()
    .from(TABLE)
    .upsert(row, { onConflict: 'normalized_url' })
    .select(SELECT)
    .single()
  if (error || !data) {
    console.error('[radar] upsert failed:', error?.code ?? '', error?.message ?? '')
    return { ok: false, code: 'db_error', message: 'Could not save the candidate.' }
  }
  return { ok: true, candidate: data as EventImportCandidate, duplicate: false }
}

export async function listCandidates(limit = 50): Promise<EventImportCandidate[]> {
  const { data } = await admin()
    .from(TABLE)
    .select(SELECT)
    .order('created_at', { ascending: false })
    .limit(limit)
  return (data as EventImportCandidate[] | null) ?? []
}

export async function getCandidate(id: string): Promise<EventImportCandidate | null> {
  const { data } = await admin().from(TABLE).select(SELECT).eq('id', id).maybeSingle()
  return (data as EventImportCandidate | null) ?? null
}

/** Re-read a candidate's source from scratch (fresh extraction + resolution +
 *  assessment). Allowed only while it is still open (needs_review / failed) — an
 *  approved candidate already produced a submission and must not be re-read. */
export async function retryCandidate(id: string): Promise<ImportResult> {
  const candidate = await getCandidate(id)
  if (!candidate) return { ok: false, code: 'db_error', message: 'Candidate not found.' }
  if (candidate.status === 'approved' || candidate.status === 'rejected') {
    return { ok: false, code: 'db_error', message: `Cannot retry a ${candidate.status} candidate.` }
  }
  return importFromUrl(candidate.source_url, candidate.imported_by)
}

/**
 * Persist admin edits to the draft. Merges a partial reading over the stored
 * one, then re-runs the transparent assessment against the EXISTING resolution
 * (text edits don't re-resolve — use Retry to re-resolve city/venue/coords).
 */
export async function saveCandidateReading(
  id: string,
  patch: Partial<PosterReading>,
): Promise<ImportResult> {
  const candidate = await getCandidate(id)
  if (!candidate) return { ok: false, code: 'db_error', message: 'Candidate not found.' }
  if (!candidate.reading) {
    return { ok: false, code: 'db_error', message: 'This candidate has no draft to edit.' }
  }
  const reading: PosterReading = { ...candidate.reading, ...patch }
  const resolution = candidate.resolution ?? NONE_RESOLUTION
  const assessment = assessReading(reading, resolution, todayIso(), {
    broadSource: isBroadSource(candidate.source_url),
  })
  const write = buildCandidateWrite({
    reading,
    resolution,
    assessment,
    imageUrl: candidate.image_url,
    sourceName: candidate.source_name,
  })
  const { data, error } = await admin()
    .from(TABLE)
    .update(write)
    .eq('id', id)
    .select(SELECT)
    .single()
  if (error || !data) {
    return { ok: false, code: 'db_error', message: 'Could not save your edits.' }
  }
  return { ok: true, candidate: data as EventImportCandidate, duplicate: false }
}

export type ApproveResult =
  | { ok: true; submissionId: string; alreadyApproved: boolean }
  | { ok: false; reason: 'validation'; blockers: ApprovalField[]; message: string }
  | { ok: false; reason: 'error'; message: string }

/**
 * Approve a candidate: mint a normal `pending` event_submissions row via the
 * crawler's own mapping, then mark the candidate approved and link the two.
 * Approval does NOT publish — the submission still goes through the existing
 * Queue → approve → publish flow (spec §9).
 *
 * Two guarantees the observed production bug demanded:
 *  1. PRE-VALIDATION — the required-for-queue fields (title/date/time) are
 *     checked before any insert, so a known-invalid row never reaches Postgres.
 *     A miss keeps the candidate in needs_review and returns which fields to fill.
 *  2. IDEMPOTENCY — a candidate already linked to a submission returns that
 *     submission instead of inserting again (covers double-clicks and a retry
 *     after a lost response). The submission_id is the idempotency token.
 */
export async function approveCandidate(
  id: string,
  decidedBy: string | null,
): Promise<ApproveResult> {
  const db = admin()
  const candidate = await getCandidate(id)
  if (!candidate) return { ok: false, reason: 'error', message: 'Candidate not found.' }

  // Idempotency: already sent to the queue → return the existing submission.
  if (candidate.submission_id) {
    return { ok: true, submissionId: candidate.submission_id, alreadyApproved: true }
  }
  if (!candidate.reading) {
    return { ok: false, reason: 'error', message: 'This candidate has no extracted event to approve.' }
  }

  // Pre-validate against the queue's required fields — never send a known-bad insert.
  const blockers = missingApprovalFields(candidate.reading)
  if (blockers.length > 0) {
    const names = blockers.map((b) => b.label).join(', ')
    return {
      ok: false,
      reason: 'validation',
      blockers,
      message: `Cannot approve this candidate yet. ${names} ${
        blockers.length === 1 ? 'is' : 'are'
      } required by the current event submission workflow — add ${
        blockers.length === 1 ? 'it' : 'them'
      } and save the draft first.`,
    }
  }

  const submission = crawlReadingToSubmission(
    candidate.reading,
    candidate.resolution ?? NONE_RESOLUTION,
    candidate.image_url,
    // Attribute the queued row to the approving admin — they are the human
    // vouching for this import, and it satisfies submitted_by_user_id NOT NULL.
    decidedBy,
  )
  const { data: subRow, error: subError } = await db
    .from('event_submissions')
    .insert(submission)
    .select('id')
    .single()
  if (subError || !subRow) {
    // Full technical error stays server-side; the client gets a safe sentence.
    console.error('[radar] submission insert failed:', subError?.code ?? '', subError?.message ?? '')
    return { ok: false, reason: 'error', message: translateSubmissionError(subError) }
  }
  const submissionId = (subRow as { id: string }).id

  const { error: updError } = await db
    .from(TABLE)
    .update({
      status: 'approved',
      submission_id: submissionId,
      decided_by: decidedBy,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
  if (updError) {
    // The submission exists but the candidate couldn't be linked. Return success
    // with its id so the admin sees the approved state and won't retry — that's
    // what prevents a duplicate in this narrow window. (A transaction spanning
    // both tables isn't available via supabase-js; see the known-limitations note.)
    console.error('[radar] candidate approve-link failed (submission created):', updError.message)
  }
  return { ok: true, submissionId, alreadyApproved: false }
}

export async function rejectCandidate(
  id: string,
  note: string | null,
  decidedBy: string | null,
): Promise<{ ok: boolean; message?: string }> {
  const { error } = await admin()
    .from(TABLE)
    .update({
      status: 'rejected',
      admin_note: note?.trim() || null,
      decided_by: decidedBy,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
  return error ? { ok: false, message: error.message } : { ok: true }
}

export async function deleteCandidate(id: string): Promise<{ ok: boolean; message?: string }> {
  const { error } = await admin().from(TABLE).delete().eq('id', id)
  return error ? { ok: false, message: error.message } : { ok: true }
}
