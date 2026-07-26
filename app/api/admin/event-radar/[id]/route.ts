import { NextResponse } from 'next/server'
import { isRequestAdmin, currentUserId } from '@/lib/admin/apiAuth'
import {
  approveCandidate,
  rejectCandidate,
  retryCandidate,
  saveCandidateReading,
  deleteCandidate,
} from '@/lib/radar/service'
import { LENS_CATEGORIES, type PosterReading } from '@/lib/ai/posterReader'

/**
 * Event Radar (RADAR-1): act on one candidate.
 *
 * POST { action: 'approve' | 'reject' | 'retry' | 'save', note?, patch? }
 *   - approve → mint a pending event_submissions row (does NOT publish)
 *   - reject  → mark rejected (+ optional note)
 *   - retry   → re-read the source from scratch (fresh extraction)
 *   - save    → persist admin edits to the draft (whitelisted fields only)
 * DELETE → remove the candidate entirely.
 *
 * Admin session required on every method; retry re-fetches, so the budget
 * matches the import route.
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

// Only these draft fields are editable from the review UI. Everything else on a
// PosterReading (confidence, is_event, recurrence internals) is derived, never
// hand-set here.
const STRING_FIELDS = [
  'title',
  'description',
  'date',
  'time',
  'end_time',
  'venue_name',
  'address',
  'city',
  'country',
  'price',
  'organizer_name',
  'organizer_website',
] as const

/** Coerce an untrusted patch body into a safe partial reading. */
function coercePatch(raw: unknown): Partial<PosterReading> {
  if (!raw || typeof raw !== 'object') return {}
  const r = raw as Record<string, unknown>
  const patch: Partial<PosterReading> = {}

  for (const key of STRING_FIELDS) {
    if (typeof r[key] === 'string') {
      ;(patch as Record<string, unknown>)[key] = (r[key] as string).trim().slice(0, 1500)
    }
  }
  if (typeof r.category === 'string') {
    const c = r.category.toLowerCase()
    if (c === '' || (LENS_CATEGORIES as readonly string[]).includes(c)) {
      patch.category = c as PosterReading['category']
    }
  }
  if (Array.isArray(r.tags)) {
    patch.tags = r.tags
      .filter((t): t is string => typeof t === 'string')
      .map((t) => t.trim().toLowerCase().slice(0, 30))
      .filter(Boolean)
      .slice(0, 5)
  }
  if (typeof r.is_civic === 'boolean') patch.is_civic = r.is_civic
  return patch
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await isRequestAdmin())) {
    return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 })
  }
  const { id } = await params

  let body: { action?: unknown; note?: unknown; patch?: unknown }
  try {
    body = (await request.json()) as typeof body
  } catch {
    return NextResponse.json({ ok: false, error: 'bad_json' }, { status: 400 })
  }

  const action = typeof body.action === 'string' ? body.action : ''
  const userId = await currentUserId()

  try {
    switch (action) {
      case 'approve': {
        const res = await approveCandidate(id, userId)
        return res.ok
          ? NextResponse.json({ ok: true, submissionId: res.submissionId })
          : NextResponse.json({ ok: false, error: 'approve_failed', message: res.message }, { status: 400 })
      }
      case 'reject': {
        const note = typeof body.note === 'string' ? body.note : null
        const res = await rejectCandidate(id, note, userId)
        return res.ok
          ? NextResponse.json({ ok: true })
          : NextResponse.json({ ok: false, error: 'reject_failed', message: res.message }, { status: 400 })
      }
      case 'retry': {
        const res = await retryCandidate(id)
        return res.ok
          ? NextResponse.json({ ok: true, candidateId: res.candidate.id, status: res.candidate.status })
          : NextResponse.json({ ok: false, error: 'retry_failed', message: res.message }, { status: 400 })
      }
      case 'save': {
        const res = await saveCandidateReading(id, coercePatch(body.patch))
        return res.ok
          ? NextResponse.json({ ok: true })
          : NextResponse.json({ ok: false, error: 'save_failed', message: res.message }, { status: 400 })
      }
      default:
        return NextResponse.json({ ok: false, error: 'unknown_action' }, { status: 400 })
    }
  } catch (err) {
    console.error('[api/admin/event-radar/:id] action failed:', err)
    return NextResponse.json({ ok: false, error: 'action_failed' }, { status: 500 })
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await isRequestAdmin())) {
    return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 })
  }
  const { id } = await params
  const res = await deleteCandidate(id)
  return res.ok
    ? NextResponse.json({ ok: true })
    : NextResponse.json({ ok: false, error: 'delete_failed', message: res.message }, { status: 400 })
}
