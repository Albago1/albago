import { z } from 'zod'
import { EventTypeV1 } from './taxonomy'
import { CountryCode, LanguageCode } from './primitives'

const Strength = z.enum(['strong', 'medium', 'weak'])

/** Community / topic / cultural relevance — supplied by the consumer, never hard-coded. */
export const RelevanceCriteriaV1 = z.object({
  id: z.string().regex(/^[a-z0-9_]{2,40}$/),
  description: z.string().min(1).max(300),
  /** Affiliation label used on entities, e.g. 'albanian'. */
  affiliation: z.string().regex(/^[a-z0-9_]{2,40}$/),
  /** Words (any language, accent-insensitive) that mark a stated audience or occasion as matching. */
  keywords: z.array(z.string().min(2)).default([]),
  /** Being located here is enough on its own (e.g. AL, XK for AlbaGo). */
  location_implies: z.object({
    country_codes: z.array(CountryCode),
    localities: z.array(z.string()).default([]),
  }),
  signals: z.object({
    performer_affiliation: Strength.optional(),
    organizer_affiliation: Strength.optional(),
    audience_statement: Strength.optional(),
    promotion_language: z.object({ languages: z.array(LanguageCode).min(1), strength: Strength }).optional(),
    cultural_occasion: Strength.optional(),
    community_venue: Strength.optional(),
  }),
  /** Deterministic combination: relevant when >= min_strong strong signals OR >= or_min_medium medium ones. */
  rule: z.object({ min_strong: z.int().min(1), or_min_medium: z.int().min(1) }),
})
export type RelevanceCriteriaV1 = z.infer<typeof RelevanceCriteriaV1>

/** How a broad (e.g. worldwide) goal fans out into narrower searches. */
export const SearchDimensionsV1 = z.object({
  places: z.array(z.object({ country_code: CountryCode, cities: z.array(z.string()).default([]) })).default([]),
  entities: z
    .object({
      performers: z.array(z.string()).default([]),
      organizers: z.array(z.string()).default([]),
      institutions: z.array(z.string()).default([]),
    })
    .default({ performers: [], organizers: [], institutions: [] }),
  platforms: z.array(z.string()).default([]),
  query_languages: z.array(LanguageCode).default([]),
  learn: z.boolean().default(true),
})
export type SearchDimensionsV1 = z.infer<typeof SearchDimensionsV1>

export const DiscoveryGoalV1 = z.object({
  id: z.string().regex(/^[a-z0-9_-]{2,60}$/),
  label: z.string().min(1).max(200),
  geography: z.union([
    z.object({ scope: z.literal('worldwide') }),
    z.object({ country_codes: z.array(CountryCode).min(1), localities: z.array(z.string()).default([]) }),
  ]),
  /** Omitted = every type. */
  categories: z.array(EventTypeV1).optional(),
  horizon_days: z.int().min(1).max(365),
  relevance: RelevanceCriteriaV1.optional(),
  languages: z.array(LanguageCode).default([]),
  expansion: SearchDimensionsV1.optional(),
  /** Fields a candidate must carry before it is worth a reviewer's time. */
  required_fields: z.array(z.enum(['start.time', 'venue', 'location', 'price', 'ticket_url'])).default([]),
  budget: z.object({
    max_searches: z.int().min(1).max(200),
    max_fetches: z.int().min(1).max(1000),
    max_tokens: z.int().min(1000),
    max_minutes: z.number().positive().max(30),
  }),
})
export type DiscoveryGoalV1 = z.infer<typeof DiscoveryGoalV1>
