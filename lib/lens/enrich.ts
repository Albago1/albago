import { resolvePoster, type LensResolution } from '@/lib/lens/resolve'
import { translateEventText, type EventTranslation } from '@/lib/ai/translateEvent'
import type { PosterReading } from '@/lib/ai/posterReader'

/**
 * LENS-2 resolution + LENS-3 translation for a successful reading, run in
 * parallel. Both fail-open by contract: any error degrades that enrichment to
 * null — the scan itself must never fail because a downstream layer broke.
 * Shared by the photo route and the URL route so the contract can't drift.
 */
export async function resolveAndTranslate(
  reading: PosterReading,
  logPrefix: string,
): Promise<{ resolution: LensResolution | null; translation: EventTranslation | null }> {
  const [resolutionResult, translationResult] = await Promise.allSettled([
    resolvePoster(reading),
    translateEventText({
      title: reading.title,
      description: reading.description,
      sourceLanguage: reading.language,
    }),
  ])

  let resolution: LensResolution | null = null
  if (resolutionResult.status === 'fulfilled') {
    resolution = resolutionResult.value
  } else {
    console.error(`[${logPrefix}] resolution failed (non-fatal):`, resolutionResult.reason)
  }

  let translation: EventTranslation | null = null
  if (translationResult.status === 'fulfilled') {
    translation = translationResult.value
  } else {
    console.error(`[${logPrefix}] translation failed (non-fatal):`, translationResult.reason)
  }

  return { resolution, translation }
}
