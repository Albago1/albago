import { z } from 'zod'

/** ISO calendar date, YYYY-MM-DD. */
export const IsoDate = z.iso.date()
/** Wall-clock time at the event's location, HH:MM (24h). */
export const WallTime = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'expected HH:MM (24h)')
/** ISO 3166-1 alpha-2 country code, e.g. AL, XK, DE. */
export const CountryCode = z.string().regex(/^[A-Z]{2}$/, 'expected ISO 3166-1 alpha-2, e.g. AL')
/** ISO 639-1 language code, e.g. sq, en, de. */
export const LanguageCode = z.string().regex(/^[a-z]{2}$/, 'expected ISO 639-1, e.g. sq')
/** ISO 4217 currency code, e.g. EUR, ALL. */
export const CurrencyCode = z.string().regex(/^[A-Z]{3}$/, 'expected ISO 4217, e.g. EUR')
export const HttpUrl = z.url({ protocol: /^https?$/ })

/** How the engine knows a field's value — never a probability. */
export const FieldStatusV1 = z.enum(['stated', 'derived', 'missing', 'conflicting'])
export type FieldStatusV1 = z.infer<typeof FieldStatusV1>

export const FieldProvenanceV1 = z.object({
  status: FieldStatusV1,
  /** Observation the current value came from; null when missing. */
  observation_id: z.uuid().nullable(),
  /** How many observations agree with the current value. */
  agree: z.int().min(0),
})
export type FieldProvenanceV1 = z.infer<typeof FieldProvenanceV1>
