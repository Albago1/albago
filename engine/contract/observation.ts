import { z } from 'zod'
import { HttpUrl } from './primitives'
import { MediaRefV1 } from './occurrence'

/**
 * What any input connector hands the engine: EVIDENCE that was actually
 * fetched — a page, feed item or API record. A search result or a model's
 * claim is only a `lead` explaining how we got here; it is never evidence.
 */
export const ObservationInputV1 = z.object({
  connector: z.string().min(1),
  source_id: z.uuid().nullable(),
  source_url: HttpUrl.nullable(),
  retrieved_at: z.iso.datetime({ offset: true }),
  evidence: z.object({
    title: z.string().max(500).nullable(),
    text_excerpt: z.string().max(20_000).nullable(),
    jsonld: z.array(z.unknown()).max(50),
    meta: z.record(z.string(), z.string()),
    media: z.array(MediaRefV1).max(20),
  }),
  lead: z
    .object({ query: z.string().max(500).nullable(), snippet: z.string().max(2000).nullable() })
    .nullable(),
  run_id: z.uuid().nullable(),
})
export type ObservationInputV1 = z.infer<typeof ObservationInputV1>
