import { z } from 'zod'

/**
 * Engine settings a deployment can change at runtime (stored by the engine,
 * edited by an operator). Every setting has a safe default, so a missing row
 * never breaks a run.
 */

/** Housekeeping: pending suggestions disappear once their event is over. */
export const ExpirySettingsV1 = z.object({
  enabled: z.boolean(),
  /** Days after the event's last day before it is removed (0 = the next day). */
  grace_days: z.int().min(0).max(30),
})
export type ExpirySettingsV1 = z.infer<typeof ExpirySettingsV1>

export const DEFAULT_EXPIRY: ExpirySettingsV1 = { enabled: true, grace_days: 0 }

/** What the last automatic clean-up did, for the operator's settings screen. */
export const ExpiryRunV1 = z.object({
  at: z.string(),
  removed: z.int().min(0),
  cutoff: z.iso.date(),
})
export type ExpiryRunV1 = z.infer<typeof ExpiryRunV1>
