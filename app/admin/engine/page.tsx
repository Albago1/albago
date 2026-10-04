import type { Metadata } from 'next'
import { toContract } from '@/engine/server'
import { albagoEngine } from '@/integrations/albago/wiring'
import { deliveryDecision } from '@/integrations/albago/policy'
import EngineReviewClient, { type ReviewCard, type RunSummary } from './EngineReviewClient'

export const metadata: Metadata = { title: 'Admin · Event Engine' }

// Auth + admin role are enforced by app/admin/layout.tsx. The engine is read
// with the service-role client inside albagoEngine(), only behind that guard.
export const dynamic = 'force-dynamic'

export default async function EngineReviewPage() {
  const engine = albagoEngine()
  const [queue, runs] = await Promise.all([engine.review.queue(60), engine.runs.recent(5)])

  const cards: ReviewCard[] = queue.map((item) => {
    const o = item.occurrence
    // What AlbaGo would do if this were approved as-is.
    const asVerified = deliveryDecision({ ...toContract(o), review_status: 'verified' })
    return {
      id: o.id,
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
  })

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
