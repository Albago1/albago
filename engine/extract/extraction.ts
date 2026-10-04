import { z } from 'zod'
import { EventTypeV1 } from '../contract/taxonomy'

/**
 * The engine's internal extraction shape — what a single piece of evidence
 * (JSON-LD, or the AI reading the page text) says about ONE event, before
 * normalization. Every value is nullable: unknown stays unknown.
 *
 * `field_status` records how each populated field is known:
 *   stated  — written in the evidence (JSON-LD, or the AI quoted it and the
 *             quote was found in the page text)
 *   derived — computed deterministically from stated data
 * A field the AI returned but could not back with a quote is dropped to null.
 */
export const ExtractionV1 = z.object({
  is_event: z.boolean(),
  title: z.string().nullable(),
  description: z.string().nullable(),
  language: z.string().nullable(),
  event_type: EventTypeV1.nullable(),
  tags: z.array(z.string()),
  start_date: z.string().nullable(),
  start_time: z.string().nullable(),
  end_date: z.string().nullable(),
  end_time: z.string().nullable(),
  status: z.enum(['scheduled', 'cancelled', 'postponed', 'rescheduled']).nullable(),
  venue_name: z.string().nullable(),
  address: z.string().nullable(),
  locality: z.string().nullable(),
  country: z.string().nullable(),
  organizer_name: z.string().nullable(),
  performers: z.array(z.string()),
  promotion_languages: z.array(z.string()),
  audience_statements: z.array(z.string()),
  cultural_occasion: z.string().nullable(),
  price_text: z.string().nullable(),
  price_min: z.number().nullable(),
  price_currency: z.string().nullable(),
  ticket_url: z.string().nullable(),
  image_url: z.string().nullable(),
  field_status: z.record(z.string(), z.enum(['stated', 'derived'])),
  /** Deterministic problems found while reading (never shown as facts). */
  issues: z.array(z.string()),
})
export type ExtractionV1 = z.infer<typeof ExtractionV1>

export function emptyExtraction(): ExtractionV1 {
  return {
    is_event: false,
    title: null,
    description: null,
    language: null,
    event_type: null,
    tags: [],
    start_date: null,
    start_time: null,
    end_date: null,
    end_time: null,
    status: null,
    venue_name: null,
    address: null,
    locality: null,
    country: null,
    organizer_name: null,
    performers: [],
    promotion_languages: [],
    audience_statements: [],
    cultural_occasion: null,
    price_text: null,
    price_min: null,
    price_currency: null,
    ticket_url: null,
    image_url: null,
    field_status: {},
    issues: [],
  }
}
