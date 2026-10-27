import type { Metadata } from 'next'
import type { SupabaseClient } from '@supabase/supabase-js'
import { toContract, type ReviewItem } from '@/engine/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { albagoEngine } from '@/integrations/albago/wiring'
import { ALBAGO_CATEGORY, deliveryDecision } from '@/integrations/albago/policy'
import { posterUrl, sharedImageUrls } from '@/integrations/albago/poster'
import { artistCandidates, discoveryOverview, engineSettings, sourcesOverview } from '@/integrations/albago/runner'
import EngineReviewClient, { type ReviewCard, type RunSummary } from './EngineReviewClient'
import DiscoveryPanel from './DiscoveryPanel'
import SettingsPanel from './SettingsPanel'
import SourcesPanel from './SourcesPanel'

const COUNTRY_NAMES = new Intl.DisplayNames(['en'], { type: 'region' })
const lastDay = (o: ReviewItem['occurrence']) => o.end.date ?? o.start.date

// Why the engine counts an event as Albanian, in plain words.
const SIGNAL_LABEL: Record<string, string> = {
  location: 'takes place in',
  performer_affiliation: 'Albanian artist',
  organizer_affiliation: 'Albanian organizer',
  audience_statement: 'the page says',
  promotion_language: 'promoted in',
  cultural_occasion: 'occasion:',
  title_keyword: 'title:',
  organizer_keyword: 'organizer:',
  description_keyword: 'description mentions',
  place_mention: 'named after',
  reviewer: 'you:',
}

export const metadata: Metadata = { title: 'Admin · Event Engine' }

// Auth + admin role are enforced by app/admin/layout.tsx. The engine is read
// with the service-role client inside albagoEngine(), only behind that guard.
export const dynamic = 'force-dynamic'

export default async function EngineReviewPage() {
  const engine = albagoEngine()
  const [queue, verified, runs, overview, candidates, settings, known] = await Promise.all([
    engine.review.queue(60),
    engine.review.queue(60, 'verified'),
    engine.runs.recent(6),
    discoveryOverview(),
    artistCandidates(),
    engineSettings(),
    sourcesOverview(),
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
  // With automatic removal on, nothing that is over shows here — even between
  // two clean-up runs. With it off, ended events stay, marked "Ended".
  const current = (item: ReviewItem) => !settings.expiry.enabled || lastDay(item.occurrence) >= settings.cutoff
  const approved = verified.filter((v) => !albagoSlugs.has(v.occurrence.id) && current(v))
  const published = verified.filter((v) => albagoSlugs.has(v.occurrence.id) && lastDay(v.occurrence) >= today)
  const pending = queue.filter(current)
  // A picture several events share is the source site's generic image, not a poster.
  const shared = sharedImageUrls([...queue, ...verified].map((i) => ({ id: i.occurrence.id, media: i.occurrence.media })))

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
      relevanceByHuman: o.relevance.albanian?.assessed_by === 'human',
      relevanceSignals: (o.relevance.albanian?.signals ?? []).map((s) => `${SIGNAL_LABEL[s.kind] ?? s.kind} ${s.value.length > 40 ? `${s.value.slice(0, 40)}…` : s.value}`),
      sources: o.source_urls,
      issues: item.issues,
      possibleDuplicates: item.possibleDuplicates.length,
      provenance: Object.fromEntries(Object.entries(o.provenance).map(([k, v]) => [k, v.status])),
      wouldPublish: asVerified.deliver ? [] : asVerified.reasons.filter((r) => r !== 'not verified'),
      albagoCategory: ALBAGO_CATEGORY[o.event_type] ?? null,
      countryName: o.location.country_code ? (COUNTRY_NAMES.of(o.location.country_code) ?? o.location.country_code) : null,
      description: o.description,
      organizer: o.organizer_name,
      ended: lastDay(o) < today,
      poster: posterUrl(o.media, shared),
    }
  }
  const cards = [...approved.map((i) => toCard(i, 'approved')), ...pending.map((i) => toCard(i, 'review')), ...published.map((i) => toCard(i, 'published'))]

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
    const label =
      r.lane === 'monitoring'
        ? `Known websites (${r.stats?.sources ?? 0} read)`
        : performers.length
          ? `Artists: ${performers.join(', ')}`
          : (targetLabels.get(goal?.id ?? '') ?? goal?.id ?? 'run')
    return {
      id: r.id,
      goal: label,
      status: r.status,
      startedAt: r.started_at,
      stats: r.stats ?? {},
    }
  })

  return (
    <div className="px-4 py-6 sm:px-6">
      <EngineReviewClient
        initialCards={cards}
        recentRuns={recentRuns}
        panels={
          <>
            <DiscoveryPanel overview={overview} candidates={candidates} />
            <SourcesPanel sources={known.sources} limits={known.limits} usage={known.usage} />
            <SettingsPanel settings={{ expiry: settings.expiry, lastRun: settings.lastRun }} />
          </>
        }
      />
    </div>
  )
}
