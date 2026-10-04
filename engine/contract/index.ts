import { z } from 'zod'
import { CanonicalOccurrenceV1 } from './occurrence'
import { ObservationInputV1 } from './observation'
import { DiscoveryGoalV1, RelevanceCriteriaV1 } from './goal'

export * from './taxonomy'
export * from './primitives'
export * from './occurrence'
export * from './observation'
export * from './goal'

/** Contract major version. Only additive changes within v1. */
export const CONTRACT_VERSION = '1' as const

/** JSON Schemas of the public contract — for future external consumers. */
export function contractJsonSchemas() {
  return {
    CanonicalOccurrenceV1: z.toJSONSchema(CanonicalOccurrenceV1, { unrepresentable: 'any' }),
    ObservationInputV1: z.toJSONSchema(ObservationInputV1, { unrepresentable: 'any' }),
    DiscoveryGoalV1: z.toJSONSchema(DiscoveryGoalV1, { unrepresentable: 'any' }),
    RelevanceCriteriaV1: z.toJSONSchema(RelevanceCriteriaV1, { unrepresentable: 'any' }),
  }
}
