import { DEFAULT_EXPIRY, ExpiryRunV1, ExpirySettingsV1 } from '../contract/settings'
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
