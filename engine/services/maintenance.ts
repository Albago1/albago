import type { RelevanceCriteriaV1 } from '../contract/goal'
import { DEFAULT_EXPIRY, ExpiryRunV1, ExpirySettingsV1 } from '../contract/settings'
import { billingNames } from '../core/match'
import { evaluateRelevance } from '../core/relevance'
import type { EngineDeps } from '../ports'

/**
 * Housekeeping. Pending suggestions are only worth a reviewer's time while
 * the event is still ahead, so once an event is over (plus the configured
 * grace) its pending suggestion is deleted. Verified and rejected
 * occurrences are kept: they are the engine's history and its corrections.
 * Observations survive the delete (their link is cleared), so the engine
 * still remembers the page and does not rediscover it as new.
 */

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

export function createMaintenance(deps: EngineDeps) {
  const now = () => deps.now?.() ?? new Date()

  async function getExpiry(): Promise<ExpirySettingsV1> {
    const row = await deps.store.settings.get('expiry')
    const parsed = ExpirySettingsV1.safeParse(row?.value)
    return parsed.success ? parsed.data : DEFAULT_EXPIRY
  }

  async function lastExpiryRun(): Promise<ExpiryRunV1 | null> {
    const row = await deps.store.settings.get('expiry_last_run')
    const parsed = ExpiryRunV1.safeParse(row?.value)
    return parsed.success ? parsed.data : null
  }

  /** First day that is still kept: events whose last day is earlier are expired. */
  function cutoffFor(expiry: ExpirySettingsV1): string {
    return addDays(now().toISOString().slice(0, 10), -expiry.grace_days)
  }

  return {
    getExpiry,
    lastExpiryRun,
    cutoffFor,

    async setExpiry(next: ExpirySettingsV1, actor: string | null): Promise<ExpirySettingsV1> {
      const value = ExpirySettingsV1.parse(next)
      await deps.store.settings.set('expiry', value, actor)
      return value
    },

    /**
     * Re-check relevance of open occurrences with the current rules and the
     * current entity knowledge (e.g. an artist confirmed since the event was
     * found). A human decision is never touched. Safe to run any number of times.
     */
    async reassessRelevance(criteria: RelevanceCriteriaV1): Promise<{ checked: number; changed: number; now_relevant: number }> {
      const rows = [
        ...(await deps.store.occurrences.listByReviewStatus('needs_review', 1000)),
        ...(await deps.store.occurrences.listByReviewStatus('verified', 1000)),
      ]
      // One read of the affiliated names instead of a query per occurrence.
      const known = new Map<string, 'performer' | 'other'>()
      for (const kind of ['performer', 'organizer', 'institution'] as const) {
        for (const e of await deps.store.entities.list(kind, criteria.affiliation)) {
          if (e.affiliations[criteria.affiliation]?.state !== 'confirmed') continue
          for (const n of [e.name, ...e.aliases]) known.set(n.toLowerCase(), kind === 'performer' ? 'performer' : 'other')
        }
      }
      const at = now().toISOString()
      let changed = 0
      let nowRelevant = 0
      for (const o of rows) {
        const before = o.relevance[criteria.id]
        if (before?.assessed_by === 'human') continue
        const names = billingNames([...o.performers, ...(o.organizer_name ? [o.organizer_name] : [])])
        const verdict = evaluateRelevance(
          criteria,
          {
            country_code: o.location.country_code,
            locality: o.location.locality,
            promotion_languages: o.promotion_languages,
            audience_statements: o.audience_statements,
            cultural_occasion: o.cultural_occasion,
            affiliated_performers: names.filter((n) => known.get(n.toLowerCase()) === 'performer'),
            affiliated_organizers: names.filter((n) => known.get(n.toLowerCase()) === 'other'),
            title: o.title,
            description: o.description,
            organizer_name: o.organizer_name,
            performers: o.performers,
          },
          before?.signals[0]?.observation_id ?? null,
          at,
        )
        const sig = (v: typeof verdict | undefined) => JSON.stringify([v?.verdict, ...(v?.signals ?? []).map((x) => `${x.kind}:${x.value}`)])
        if (sig(before) === sig(verdict)) continue
        await deps.store.occurrences.update(o.id, { relevance: { ...o.relevance, [criteria.id]: verdict } })
        changed++
        if (verdict.verdict === 'relevant' && before?.verdict !== 'relevant') nowRelevant++
      }
      return { checked: rows.length, changed, now_relevant: nowRelevant }
    },

    /** Delete pending suggestions for events that are over. Safe to run any number of times. */
    async expireEnded(): Promise<{ enabled: boolean; removed: number; cutoff: string }> {
      const expiry = await getExpiry()
      const cutoff = cutoffFor(expiry)
      if (!expiry.enabled) return { enabled: false, removed: 0, cutoff }
      const removed = await deps.store.occurrences.deletePendingEndedBefore(cutoff)
      await deps.store.settings.set('expiry_last_run', { at: now().toISOString(), removed, cutoff } satisfies ExpiryRunV1, null)
      return { enabled: true, removed, cutoff }
    },
  }
}

export type Maintenance = ReturnType<typeof createMaintenance>
