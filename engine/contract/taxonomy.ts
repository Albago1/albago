import { z } from 'zod'

/**
 * Neutral event taxonomy v1 — owned by the engine, deliberately coarse.
 * Consumers map these to their own categories (AlbaGo's mapping lives in
 * integrations/albago/). Classification is a fact the engine records;
 * whether a consumer publishes a type is that consumer's policy.
 */
export const EVENT_TYPES = [
  'concert',
  'club_night',
  'party_social',
  'festival',
  'theatre',
  'opera_ballet_classical',
  'comedy',
  'film',
  'exhibition',
  'talk_workshop',
  'sports_match',
  'sports_participation',
  'food_drink',
  'family',
  'market_fair',
  'community_civic',
  'other',
] as const

export const EventTypeV1 = z.enum(EVENT_TYPES)
export type EventTypeV1 = z.infer<typeof EventTypeV1>
