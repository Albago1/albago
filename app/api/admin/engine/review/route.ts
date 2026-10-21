import { NextResponse } from 'next/server'
import type { ReviewEdits } from '@/engine/server'
import { isRequestAdmin, currentUserId } from '@/lib/admin/apiAuth'
import { createAdminClient } from '@/lib/supabase/admin'
import { albagoEngine } from '@/integrations/albago/wiring'
import { deliverToAlbago, retractFromAlbago } from '@/integrations/albago/adapter'
import { ALBANIAN_RELEVANCE } from '@/integrations/albago/goals'

/**
 * Event Engine review (admin only).
 * POST { id, action: 'verify', edits? } → engine verifies the occurrence (truth),
 *   then the AlbaGo adapter decides and publishes (customer policy).
 * POST { id, action: 'reject', reason } → engine rejects; any AlbaGo copy is unpublished.
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

const EDITABLE = ['title', 'event_type', 'start_date', 'start_time', 'end_date', 'end_time', 'venue_name', 'venue_address', 'locality', 'country_code', 'price', 'ticket_url', 'description', 'status', 'media'] as const

export async function POST(request: Request) {
  if (!(await isRequestAdmin())) return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 })

  let body: { id?: unknown; action?: unknown; edits?: unknown; reason?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'bad_json' }, { status: 400 })
  }
  const id = typeof body.id === 'string' ? body.id : ''
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ ok: false, error: 'bad_id' }, { status: 400 })

  const engine = albagoEngine()
  const actor = await currentUserId()

  try {
    if (body.action === 'reject') {
      const reason = typeof body.reason === 'string' && body.reason.trim() ? body.reason.trim() : 'rejected in review'
      await engine.review.reject(id, reason, actor)
      await retractFromAlbago(createAdminClient(), id)
      return NextResponse.json({ ok: true, rejected: true })
    }

    if (body.action === 'verify') {
      const raw = (typeof body.edits === 'object' && body.edits ? body.edits : {}) as Record<string, unknown>
      const edits: ReviewEdits = {}
      for (const key of EDITABLE) {
        if (key in raw) (edits as Record<string, unknown>)[key] = raw[key] === '' ? null : raw[key]
      }
      // The reviewer's call on Albanian relevance (publishing on AlbaGo confirms it).
      const rel = raw.relevance as { verdict?: unknown } | undefined
      if (rel && (rel.verdict === 'relevant' || rel.verdict === 'not_relevant')) {
        edits.relevance = { criteria_id: ALBANIAN_RELEVANCE.id, verdict: rel.verdict }
      }
      const verified = await engine.review.verify(id, edits, actor)
      // Learning from the decision: the performers of a confirmed Albanian event become artists to confirm.
      if (edits.relevance?.verdict === 'relevant' && verified.performers.length) {
        await engine.entities
          .propose('performer', verified.performers, ALBANIAN_RELEVANCE.affiliation, { occurrence_id: verified.id, title: verified.title })
          .catch((e) => console.error('[engine review] learn failed', e))
      }
      const delivery = await deliverToAlbago(createAdminClient(), verified, new Date().toISOString())
      return NextResponse.json({ ok: true, verified: true, delivery })
    }

    return NextResponse.json({ ok: false, error: 'bad_action' }, { status: 400 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'review_failed'
    console.error('[engine review]', message)
    return NextResponse.json({ ok: false, error: 'review_failed', message: message.slice(0, 300) }, { status: 500 })
  }
}
