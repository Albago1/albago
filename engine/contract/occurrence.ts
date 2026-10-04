import { z } from 'zod'
import { EventTypeV1 } from './taxonomy'
import {
  CountryCode,
  CurrencyCode,
  FieldProvenanceV1,
  HttpUrl,
  IsoDate,
  LanguageCode,
  WallTime,
} from './primitives'

export const PriceV1 = z
  .object({
    state: z.enum(['free', 'paid', 'unknown']),
    min: z.number().nonnegative().nullable(),
    max: z.number().nonnegative().nullable(),
    currency: CurrencyCode.nullable(),
    /** Source wording, e.g. "Presale 1,000 ALL / door 1,500 ALL". */
    note: z.string().max(500).nullable(),
  })
  .superRefine((p, ctx) => {
    if (p.min != null && p.max != null && p.min > p.max) {
      ctx.addIssue({ code: 'custom', message: 'price.min must be <= price.max', path: ['min'] })
    }
    if (p.state === 'free' && ((p.min ?? 0) > 0 || (p.max ?? 0) > 0)) {
      ctx.addIssue({ code: 'custom', message: 'a free event cannot have a positive price', path: ['state'] })
    }
    if (p.state === 'paid' && (p.min != null || p.max != null) && p.currency == null) {
      ctx.addIssue({ code: 'custom', message: 'a paid amount needs a currency', path: ['currency'] })
    }
  })
export type PriceV1 = z.infer<typeof PriceV1>

export const MediaRefV1 = z.object({
  url: HttpUrl,
  role: z.enum(['poster', 'gallery']),
  /** A source reference is always 'unknown'; stored copies need an explicit basis. */
  rights: z.enum(['unknown', 'owned', 'licensed', 'organizer_provided']),
})
export type MediaRefV1 = z.infer<typeof MediaRefV1>

export const RelevanceVerdictV1 = z.object({
  verdict: z.enum(['relevant', 'possible', 'not_relevant']),
  signals: z.array(
    z.object({
      kind: z.string().min(1),
      value: z.string(),
      strength: z.enum(['strong', 'medium', 'weak']),
      observation_id: z.uuid().nullable(),
    }),
  ),
  assessed_by: z.enum(['rules', 'ai', 'human']),
  at: z.iso.datetime({ offset: true }),
})
export type RelevanceVerdictV1 = z.infer<typeof RelevanceVerdictV1>

/**
 * Canonical Occurrence v1 — what the engine believes about ONE start at ONE
 * place. Customer-neutral: no consumer ids, categories or slugs. Unknown
 * stays null; every populated field should be traceable through `provenance`.
 */
export const CanonicalOccurrenceV1 = z
  .object({
    contract: z.literal('1'),
    id: z.uuid(),
    version: z.int().min(1),

    title: z.string().trim().min(1).max(300),
    description: z.string().max(10_000).nullable(),
    language: LanguageCode.nullable(),
    event_type: EventTypeV1,
    tags: z.array(z.string().min(1).max(40)).max(20),

    start: z.object({
      date: IsoDate,
      time: WallTime.nullable(),
      /** IANA zone, e.g. Europe/Tirane. */
      timezone: z.string().min(1).nullable(),
    }),
    end: z.object({ date: IsoDate.nullable(), time: WallTime.nullable() }),
    status: z.enum(['scheduled', 'cancelled', 'postponed', 'rescheduled']),

    venue: z.object({
      venue_id: z.uuid().nullable(),
      name: z.string().max(200).nullable(),
      address: z.string().max(300).nullable(),
    }),
    location: z
      .object({
        locality: z.string().max(120).nullable(),
        country_code: CountryCode.nullable(),
        lat: z.number().min(-90).max(90).nullable(),
        lng: z.number().min(-180).max(180).nullable(),
      })
      .refine((l) => (l.lat == null) === (l.lng == null), {
        message: 'lat and lng come together',
        path: ['lat'],
      }),

    organizer_name: z.string().max(200).nullable(),
    performers: z.array(z.string().min(1).max(200)).max(50),
    /** Relevance FACTS (neutral): how and to whom the event is promoted, as stated. */
    promotion_languages: z.array(LanguageCode).max(10),
    audience_statements: z.array(z.string().max(300)).max(10),
    cultural_occasion: z.string().max(200).nullable(),

    price: PriceV1,
    ticket_url: HttpUrl.nullable(),
    media: z.array(MediaRefV1).max(20),
    source_urls: z.array(HttpUrl).max(50),

    provenance: z.record(z.string(), FieldProvenanceV1),
    /** Relevance VERDICTS, keyed by the consumer's criteria id. */
    relevance: z.record(z.string(), RelevanceVerdictV1),

    review_status: z.enum(['needs_review', 'verified', 'rejected']),
    updated_at: z.iso.datetime({ offset: true }),
  })
  .superRefine((o, ctx) => {
    const { start, end } = o
    if (end.date && end.date < start.date) {
      ctx.addIssue({ code: 'custom', message: 'end.date is before start.date', path: ['end', 'date'] })
    }
    // Same explicit day: the end time cannot precede the start time. When the
    // end date is unknown, an earlier end time means "past midnight" and is fine.
    if (end.date && end.date === start.date && start.time && end.time && end.time < start.time) {
      ctx.addIssue({ code: 'custom', message: 'end is before start on the same day', path: ['end', 'time'] })
    }
  })
export type CanonicalOccurrenceV1 = z.infer<typeof CanonicalOccurrenceV1>
