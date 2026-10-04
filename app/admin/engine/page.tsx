import type { Metadata } from 'next'
import type { SupabaseClient } from '@supabase/supabase-js'
import { toContract, type ReviewItem } from '@/engine/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { albagoEngine } from '@/integrations/albago/wiring'
import { deliveryDecision } from '@/integrations/albago/policy'
import EngineReviewClient, { type ReviewCard, type RunSummary } from './EngineReviewClient'

export const metadata: Metadata = { title: 'Admin · Event Engine' }

// Auth + admin role are enforced by app/admin/layout.tsx. The engine is read
// with the service-role client inside albagoEngine(), only behind that guard.
export const dynamic = 'force-dynamic'

export default async function EngineReviewPage() {
  const engine = albagoEngine()
  const [queue, verified, runs] = await Promise.all([engine.review.queue(60), engine.review.queue(60, 'verified'), engine.runs.recent(5)])

  // Approved in the engine but not on AlbaGo (held back by AlbaGo's rules, or
  // the publish step failed) — kept visible so they can be fixed and published.
  let approved: ReviewItem[] = []
  if (verified.length) {
    const db: SupabaseClient = createAdminClient() // engine_* columns aren't in the generated types yet
    const { data } = await db
      .from('events')
      .select('engine_occurrence_id')
      .in('engine_occurrence_id', verified.map((v) => v.occurrence.id))
    const onAlbago = new Set((data ?? []).map((r) => r.engine_occurrence_id as string))
    approved = verified.filter((v) => !onAlbago.has(v.occurrence.id))
  }

  const toCard = (item: ReviewItem, stage: ReviewCard['stage']): ReviewCard => {
    const o = item.occurrence
    // What AlbaGo would do if this were approved as-is.
    const asVerified = deliveryDecision({ ...toContract(o), review_status: 'verified' })
    return {
      id: o.id,
      version: o.version,
      stage,
      title: o.title,
      eventType: o.event_type,
      date: o.start.date,
      time: o.start.time,
      endDate: o.end.date,
      endTime: o.end.time,
      venue: o.venue.name,
      address: o.venue.address,
      locality: o.location.locality,
      countryCode: o.location.country_code,
      price: o.price,
      performers: o.performers,
      relevance: o.relevance.albanian?.verdict ?? null,
      relevanceSignals: (o.relevance.albanian?.signals ?? []).map((s) => `${s.kind}: ${s.value}`),
      sources: o.source_urls,
      issues: item.issues,
      possibleDuplicates: item.possibleDuplicates.length,
      provenance: Object.fromEntries(Object.entries(o.provenance).map(([k, v]) => [k, v.status])),
      wouldPublish: asVerified.deliver ? [] : asVerified.reasons.filter((r) => r !== 'not verified'),
    }
  }
  const cards = [...approved.map((i) => toCard(i, 'approved')), ...queue.map((i) => toCard(i, 'review'))]

  const recentRuns: RunSummary[] = runs.map((r) => ({
    id: r.id,
    status: r.status,
    startedAt: r.started_at,
    stats: r.stats ?? {},
  }))

  return (
    <div className="px-4 py-6 sm:px-6">
      <EngineReviewClient initialCards={cards} recentRuns={recentRuns} />
    </div>
  )
}
