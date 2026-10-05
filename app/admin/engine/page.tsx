import type { Metadata } from 'next'
import type { SupabaseClient } from '@supabase/supabase-js'
import { toContract, type ReviewItem } from '@/engine/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { albagoEngine } from '@/integrations/albago/wiring'
import { deliveryDecision } from '@/integrations/albago/policy'
import { artistCandidates, discoveryOverview } from '@/integrations/albago/runner'
import EngineReviewClient, { type ReviewCard, type RunSummary } from './EngineReviewClient'
import DiscoveryPanel from './DiscoveryPanel'

export const metadata: Metadata = { title: 'Admin · Event Engine' }

// Auth + admin role are enforced by app/admin/layout.tsx. The engine is read
// with the service-role client inside albagoEngine(), only behind that guard.
export const dynamic = 'force-dynamic'

export default async function EngineReviewPage() {
  const engine = albagoEngine()
  const [queue, verified, runs, overview, candidates] = await Promise.all([
    engine.review.queue(60),
    engine.review.queue(60, 'verified'),
    engine.runs.recent(6),
    discoveryOverview(),
    artistCandidates(),
  ])
  const targetLabels = new Map(overview.plan.map((p) => [p.id, p.label]))

  // Approved events split by whether AlbaGo has them: not yet (held back by
  // AlbaGo's rules, or the publish step failed) → fix and publish; live and
  // upcoming → correct and save, which updates the AlbaGo page.
  const albagoSlugs = new Map<string, string>()
  if (verified.length) {
    const db: SupabaseClient = createAdminClient() // engine_* columns aren't in the generated types yet
    const { data } = await db
      .from('events')
      .select('engine_occurrence_id, slug')
      .in(
        'engine_occurrence_id',
        verified.map((v) => v.occurrence.id),
      )
    for (const r of data ?? []) albagoSlugs.set(r.engine_occurrence_id as string, r.slug as string)
  }
  const today = new Date().toISOString().slice(0, 10)
  const approved = verified.filter((v) => !albagoSlugs.has(v.occurrence.id))
  const published = verified.filter((v) => albagoSlugs.has(v.occurrence.id) && (v.occurrence.end.date ?? v.occurrence.start.date) >= today)

  const toCard = (item: ReviewItem, stage: ReviewCard['stage']): ReviewCard => {
    const o = item.occurrence
    // What AlbaGo would do if this were approved as-is.
    const asVerified = deliveryDecision({
      ...toContract(o),
      review_status: 'verified',
    })
    return {
      id: o.id,
      version: o.version,
      stage,
      albagoSlug: albagoSlugs.get(o.id) ?? null,
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
  const cards = [...approved.map((i) => toCard(i, 'approved')), ...queue.map((i) => toCard(i, 'review')), ...published.map((i) => toCard(i, 'published'))]

  const recentRuns: RunSummary[] = runs.map((r) => {
    const goal = (
      r.goal as {
        goal?: {
          id?: string
          expansion?: { entities?: { performers?: string[] } }
        }
      } | null
    )?.goal
    const performers = goal?.expansion?.entities?.performers ?? []
    return {
      id: r.id,
      goal: performers.length ? `Artists: ${performers.join(', ')}` : (targetLabels.get(goal?.id ?? '') ?? goal?.id ?? 'run'),
      status: r.status,
      startedAt: r.started_at,
      stats: r.stats ?? {},
    }
  })

  return (
    <div className="px-4 py-6 sm:px-6">
      <EngineReviewClient initialCards={cards} recentRuns={recentRuns} discovery={<DiscoveryPanel overview={overview} candidates={candidates} />} />
    </div>
  )
}
