import type { RelevanceCriteriaV1 } from '../contract/goal'
import type { ObservationInputV1 } from '../contract/observation'
import { normalizeImportUrl } from '../core/url'
import { distillPage, type DistilledPage } from '../extract/page'
import type { EngineDeps, EngineStore, OccurrenceRecord, SourceRecord } from '../ports'
import type { ObserveOutcome } from './observe'
import { observePage, type ObservePageResult } from './observePage'

/**
 * The monitoring lane: websites a human approved once are re-read on a
 * schedule. It spends no searches; an unchanged page costs nothing, and a page
 * with structured event data needs no AI. Every visit updates the source's
 * scorecard, and a source that keeps failing pauses itself with the reason.
 * Nothing here publishes: found events wait in review like any other.
 */

/** Kept in `sources.evaluation`, next to why the source was proposed. */
export type SourceScorecard = {
  visits: number
  /** New suggestions this source produced. */
  events_found: number
  /** …of which relevant under the caller's criteria. */
  relevant_found: number
  errors_in_row: number
  /** Last time every item was read, changed page or not (items' window moves). */
  last_full_read: string | null
  last_visit: { at: string; result: SourceVisit['result']; new: number; known: number; not_relevant: number; skipped: number } | null
}

export const DEFAULT_INTERVAL_HOURS = 72
export const PAUSE_AFTER_ERRORS = 5
const DAY = 86_400_000

export function scorecard(s: Pick<SourceRecord, 'evaluation'>): SourceScorecard {
  const e = s.evaluation as Partial<SourceScorecard>
  return {
    visits: e.visits ?? 0,
    events_found: e.events_found ?? 0,
    relevant_found: e.relevant_found ?? 0,
    errors_in_row: e.errors_in_row ?? 0,
    last_full_read: e.last_full_read ?? null,
    last_visit: e.last_visit ?? null,
  }
}

/** An active source whose interval has passed (30 min slack: a daily slot may fire a little early). */
export function isDue(s: SourceRecord, now: number): boolean {
  if (s.status !== 'active') return false
  if (!s.last_checked_at) return true
  return now - Date.parse(s.last_checked_at) >= (s.check_interval_hours ?? DEFAULT_INTERVAL_HOURS) * 3_600_000 - 30 * 60_000
}

export type MonitorOptions = {
  criteria?: RelevanceCriteriaV1
  /** Events up to this many days ahead are taken. */
  horizonDays: number
  maxSources: number
  /** Stop starting new visits after this long (the caller's function limit). */
  timeBudgetMs: number
  /** Read an unchanged page's items again after this many days. */
  recheckDays: number
  triggeredBy: string | null
}

export type SourceVisit = {
  id: string
  label: string
  result: 'events' | 'no_events' | 'unchanged' | 'error'
  new: number
  known: number
  not_relevant: number
  skipped: number
  error: string | null
}

export type MonitorReport = { runId: string; status: 'completed' | 'stopped_budget'; visits: SourceVisit[]; stats: Record<string, number> }

export type PreviewEvent = { title: string | null; date: string | null; time: string | null; place: string | null; country: string | null; relevance: string | null; known: boolean }
export type SourcePreview =
  | { ok: true; kind: ObservePageResult['kind']; events: PreviewEvent[]; notRelevant: number; skipped: number }
  | { ok: false; reason: 'bad_url' | 'unreadable' }

const errorText = (e: unknown) => (e instanceof Error ? e.message : String(e)).slice(0, 300)

function pageInput(page: DistilledPage, finalUrl: string, retrievedAt: string, sourceId: string | null, runId: string | null, connector: string): ObservationInputV1 {
  return {
    connector,
    source_id: sourceId,
    source_url: finalUrl,
    retrieved_at: retrievedAt,
    evidence: {
      title: page.title,
      text_excerpt: page.text,
      jsonld: page.jsonld.slice(0, 50),
      meta: page.description ? { description: page.description } : {},
      media: page.imageUrl ? [{ url: page.imageUrl, role: 'poster', rights: 'unknown' }] : [],
    },
    lead: null,
    run_id: runId,
  }
}

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

/**
 * The engine's store with every write kept in memory: reads see the real
 * data (so "already known" events show as known), nothing is saved. Built
 * method by method so a new write in the store contract can't slip through.
 */
function dryRun(deps: EngineDeps) {
  const real = deps.store
  const created = new Map<string, OccurrenceRecord>()
  let n = 0
  const fakeId = async () => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`
  const nowIso = (deps.now?.() ?? new Date()).toISOString()
  const store: EngineStore = {
    runs: { create: fakeId, finish: async () => {}, get: (id) => real.runs.get(id), recent: (l) => real.runs.recent(l) },
    sources: {
      findByNormalizedUrl: (u) => real.sources.findByNormalizedUrl(u),
      propose: fakeId,
      list: () => real.sources.list(),
      get: (id) => real.sources.get(id),
      update: async () => {},
      verifiedCounts: () => real.sources.verifiedCounts(),
    },
    observations: {
      findByUrlAndHash: async () => null,
      insert: fakeId,
      update: async () => {},
      listForOccurrence: async () => [],
      countRecentForUrl: (u) => real.observations.countRecentForUrl(u),
    },
    occurrences: {
      async insert(row) {
        const id = await fakeId()
        created.set(id, { ...row, id, created_at: nowIso, updated_at: nowIso, verified_at: null, verified_by: null })
        return id
      },
      update: async () => {},
      get: async (id) => created.get(id) ?? real.occurrences.get(id),
      async findCandidates(q) {
        const mine = [...created.values()].filter((o) => o.start.date === q.start_date && o.location.country_code === q.country_code)
        return [...(await real.occurrences.findCandidates(q)), ...mine]
      },
      findBySourceUrl: (u) => real.occurrences.findBySourceUrl(u),
      listByReviewStatus: (s, l) => real.occurrences.listByReviewStatus(s, l),
      deletePendingEndedBefore: async () => 0,
    },
    settings: { get: (k) => real.settings.get(k), set: async () => {} },
    venues: { findInLocality: (c, l) => real.venues.findInLocality(c, l), insert: fakeId },
    entities: {
      findAffiliated: (names, a) => real.entities.findAffiliated(names, a),
      list: (k, a) => real.entities.list(k, a),
      findByName: (k, name) => real.entities.findByName(k, name),
      insert: fakeId,
      setAffiliation: async () => {},
    },
    reviewActions: { insert: async () => {} },
  }
  return { deps: { ...deps, store } satisfies EngineDeps, created }
}

export function createSources(deps: EngineDeps) {
  const now = () => deps.now?.() ?? new Date()

  async function get(id: string): Promise<SourceRecord> {
    const s = await deps.store.sources.get(id)
    if (!s) throw new Error('source not found')
    return s
  }

  async function verdict(o: ObserveOutcome, criteria: RelevanceCriteriaV1 | undefined): Promise<string | null> {
    if (!criteria || !o.occurrenceId) return null
    return (await deps.store.occurrences.get(o.occurrenceId))?.relevance[criteria.id]?.verdict ?? null
  }

  async function visit(source: SourceRecord, opts: MonitorOptions, runId: string): Promise<SourceVisit> {
    const at = now().toISOString()
    const card = scorecard(source)
    const visitOf = (result: SourceVisit['result'], c: Partial<SourceVisit> = {}): SourceVisit => ({
      id: source.id, label: source.label ?? source.url, result, new: 0, known: 0, not_relevant: 0, skipped: 0, error: null, ...c,
    })

    const fail = async (error: string): Promise<SourceVisit> => {
      const errors = card.errors_in_row + 1
      const pause = errors >= PAUSE_AFTER_ERRORS
      await deps.store.sources.update(source.id, {
        last_checked_at: at,
        last_status: 'error',
        last_error: error,
        evaluation: { ...source.evaluation, ...card, visits: card.visits + 1, errors_in_row: errors, last_visit: { at, result: 'error', new: 0, known: 0, not_relevant: 0, skipped: 0 } },
        ...(pause ? { status: 'paused' as const, status_reason: `Paused after ${errors} failed reads in a row: ${error}`.slice(0, 300) } : {}),
      })
      return visitOf('error', { error })
    }

    let fetched
    try {
      fetched = await deps.fetcher.fetchHtml(source.url)
    } catch (e) {
      return fail(errorText(e))
    }
    if (!fetched) return fail('Could not read the page (robots.txt refuses AlbaGoBot, the site is down, or it is not a web page).')

    const page = distillPage(fetched.html, fetched.finalUrl)
    const today = at.slice(0, 10)
    const force = !card.last_full_read || Date.parse(at) - Date.parse(card.last_full_read) > opts.recheckDays * DAY
    let result: ObservePageResult
    try {
      result = await observePage(
        deps,
        { input: pageInput(page, fetched.finalUrl, at, source.id, runId, 'monitor'), links: page.links },
        { criteria: opts.criteria, window: { from: today, to: addDays(today, opts.horizonDays) } },
        'event_list',
        { force },
      )
    } catch (e) {
      return fail(errorText(e))
    }

    const count = (k: ObserveOutcome['outcome']) => result.outcomes.filter((o) => o.outcome === k).length
    const created = result.outcomes.filter((o) => o.outcome === 'new' || o.outcome === 'possible_duplicate')
    let relevant = 0
    for (const o of created) if (!opts.criteria || (await verdict(o, opts.criteria)) === 'relevant') relevant++
    const skipped = result.skipped.past + result.skipped.outside_window
    // An unchanged page reports nothing new; items seen before on a re-read count as known.
    const c =
      result.kind === 'unchanged'
        ? { new: 0, known: 0, not_relevant: 0, skipped: 0 }
        : { new: created.length, known: count('attached') + count('unchanged'), not_relevant: count('not_relevant'), skipped }
    const any = result.outcomes.some((o) => o.outcome !== 'not_event' && o.outcome !== 'failed') || skipped > 0
    const label: SourceVisit['result'] = result.kind === 'unchanged' ? 'unchanged' : any ? 'events' : 'no_events'

    await deps.store.sources.update(source.id, {
      last_checked_at: at,
      last_status: label === 'no_events' ? 'empty' : 'ok',
      last_error: null,
      evaluation: {
        ...source.evaluation,
        ...card,
        visits: card.visits + 1,
        events_found: card.events_found + c.new,
        relevant_found: card.relevant_found + relevant,
        errors_in_row: 0,
        last_full_read: result.kind === 'unchanged' ? card.last_full_read : at,
        last_visit: { at, result: label, ...c },
      },
    })
    return visitOf(label, c)
  }

  return {
    /** Every source with its scorecard, how many of its events a human verified, and whether it is due. */
    async overview() {
      const [sources, verified] = await Promise.all([deps.store.sources.list(), deps.store.sources.verifiedCounts()])
      const t = now().getTime()
      return sources.map((s) => ({ ...s, card: scorecard(s), verified: verified[s.id] ?? 0, due: isDue(s, t) }))
    },

    /** A human decision: approve (monitor it), reject (never propose again), or pause. */
    async decide(id: string, decision: 'approve' | 'reject' | 'pause', actor: string | null, reason: string | null = null): Promise<void> {
      const s = await get(id)
      const card = scorecard(s)
      await deps.store.sources.update(id, {
        status: decision === 'approve' ? 'active' : decision === 'reject' ? 'rejected' : 'paused',
        status_reason: decision === 'approve' ? null : (reason?.slice(0, 300) ?? null),
        check_interval_hours: s.check_interval_hours ?? DEFAULT_INTERVAL_HOURS,
        // Approving again gives a paused source a fresh start.
        evaluation: { ...s.evaluation, ...(decision === 'approve' ? { errors_in_row: 0 } : { errors_in_row: card.errors_in_row }), decided: { decision, by: actor, at: now().toISOString() } },
      })
    },

    async setInterval(id: string, hours: number): Promise<void> {
      if (!Number.isInteger(hours) || hours < 6 || hours > 24 * 30) throw new Error('interval must be 6 hours to 30 days')
      await get(id)
      await deps.store.sources.update(id, { check_interval_hours: hours })
    },

    /** Read a page now and show what the engine would take from it. Nothing is saved. */
    async preview(url: string, criteria: RelevanceCriteriaV1 | undefined, horizonDays: number): Promise<SourcePreview> {
      if (!normalizeImportUrl(url)) return { ok: false, reason: 'bad_url' }
      const fetched = await deps.fetcher.fetchHtml(url).catch(() => null)
      if (!fetched) return { ok: false, reason: 'unreadable' }
      const page = distillPage(fetched.html, fetched.finalUrl)
      const at = now().toISOString()
      const dry = dryRun(deps)
      const result = await observePage(
        dry.deps,
        { input: pageInput(page, fetched.finalUrl, at, null, null, 'preview'), links: page.links },
        { criteria, window: { from: at.slice(0, 10), to: addDays(at.slice(0, 10), horizonDays) } },
        'event_list',
      )
      const events: PreviewEvent[] = []
      for (const o of result.outcomes) {
        if (!['new', 'possible_duplicate', 'attached'].includes(o.outcome) || !o.occurrenceId) continue
        const occ = await dry.deps.store.occurrences.get(o.occurrenceId)
        events.push({
          title: occ?.title ?? o.title,
          date: occ?.start.date ?? o.start_date,
          time: occ?.start.time ?? null,
          place: [occ?.venue.name, occ?.location.locality].filter(Boolean).join(', ') || null,
          country: occ?.location.country_code ?? null,
          relevance: criteria ? (occ?.relevance[criteria.id]?.verdict ?? null) : null,
          known: o.outcome === 'attached',
        })
      }
      return {
        ok: true,
        kind: result.kind,
        events,
        notRelevant: result.outcomes.filter((o) => o.outcome === 'not_relevant').length,
        skipped: result.skipped.past + result.skipped.outside_window,
      }
    },

    /** Re-read the most overdue approved sources, within the caller's budget. */
    async monitor(opts: MonitorOptions): Promise<MonitorReport> {
      const started = Date.now()
      const t = now().getTime()
      const due = (await deps.store.sources.list())
        .filter((s) => isDue(s, t))
        .sort((a, b) => Date.parse(a.last_checked_at ?? '1970-01-01') - Date.parse(b.last_checked_at ?? '1970-01-01'))
        .slice(0, Math.max(opts.maxSources, 0))
      const runId = await deps.store.runs.create('monitoring', { sources: due.map((s) => ({ id: s.id, url: s.url })) }, opts.triggeredBy)
      const visits: SourceVisit[] = []
      let status: MonitorReport['status'] = 'completed'
      for (const source of due) {
        if (Date.now() - started > opts.timeBudgetMs) {
          status = 'stopped_budget'
          break
        }
        visits.push(await visit(source, opts, runId))
      }
      const sum = (k: 'new' | 'known' | 'not_relevant' | 'skipped') => visits.reduce((n, v) => n + v[k], 0)
      const stats = {
        sources: visits.length,
        pages_read: visits.filter((v) => v.result !== 'error').length,
        unchanged: visits.filter((v) => v.result === 'unchanged').length,
        errors: visits.filter((v) => v.result === 'error').length,
        new: sum('new'),
        known: sum('known'),
        not_relevant: sum('not_relevant'),
        skipped: sum('skipped'),
      }
      await deps.store.runs.finish(runId, { status, stats, log: visits.map((v) => ({ t: 'visit', ...v })), error: null })
      return { runId, status, visits, stats }
    },
  }
}

export type Sources = ReturnType<typeof createSources>
