import { NextResponse } from 'next/server'
import { isAuthorizedIngest } from '@/lib/ingest/auth'
import { ingestEvents } from '@/lib/ingest/service'
import { MAX_BODY_BYTES, MAX_EVENTS_PER_REQUEST } from '@/lib/ingest/schema'

/**
 * POST /api/ingest/events — the GPT ingest door (Phase 38).
 *
 * The only route on AlbaGo an outside machine may write through. What it can do
 * is deliberately tiny: create `needs_review` rows in event_import_candidates.
 * It cannot publish, cannot approve, cannot touch `events`, and cannot read a
 * single user record. The worst a leaked key achieves is a cluttered review
 * queue that an admin clears in one click.
 *
 * Auth:  Authorization: Bearer <INGEST_API_KEY>   (fails closed — see lib/ingest/auth)
 * Body:  { verify_source?: boolean, events: [ … ] }
 * Reply: { ok, summary, results[] } — one result per submitted event, in order.
 *
 * The reply is intentionally verbose. It is the agent's correction loop: it
 * carries the REAL resolved city slug (so the agent stops guessing), the missing
 * fields, the warnings, and every conflict between what the agent claimed and
 * what the source page actually says.
 */

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

function unauthorized() {
  // No detail: a caller without the key learns nothing about why.
  return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
}

export async function POST(request: Request) {
  if (!isAuthorizedIngest(request)) return unauthorized()

  // Reject an oversized body before parsing it. content-length is advisory, so
  // the check is a cheap first line, not the only one — MAX_EVENTS_PER_REQUEST
  // caps the real work regardless.
  const declared = Number(request.headers.get('content-length') ?? '0')
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) {
    return NextResponse.json(
      { ok: false, error: 'payload_too_large', max_bytes: MAX_BODY_BYTES },
      { status: 413 },
    )
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 })
  }

  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return NextResponse.json(
      { ok: false, error: 'invalid_body', message: 'Send an object with an "events" array.' },
      { status: 400 },
    )
  }
  const payload = body as Record<string, unknown>
  const events = payload.events

  if (!Array.isArray(events) || events.length === 0) {
    return NextResponse.json(
      {
        ok: false,
        error: 'no_events',
        message: `Send 1–${MAX_EVENTS_PER_REQUEST} events in an "events" array.`,
      },
      { status: 400 },
    )
  }

  try {
    const { summary, results } = await ingestEvents(events, {
      verifySource: payload.verify_source !== false,
    })
    return NextResponse.json({ ok: true, summary, results })
  } catch (err) {
    console.error('[ingest] request failed:', err)
    return NextResponse.json({ ok: false, error: 'ingest_failed' }, { status: 500 })
  }
}

/** A cheap liveness/auth probe, so the GPT (or you) can confirm the key works
 *  without creating anything. */
export async function GET(request: Request) {
  if (!isAuthorizedIngest(request)) return unauthorized()
  return NextResponse.json({
    ok: true,
    service: 'albago-ingest',
    max_events_per_request: MAX_EVENTS_PER_REQUEST,
  })
}
