import { createRateLimiter } from '@/lib/rateLimit'

/**
 * ONE shared per-IP scan bucket for both Lens inputs (photo /api/lens and
 * URL /api/lens/url). When each route kept its own limiter a single client
 * got 2× the intended free-tier Gemini quota; sharing the instance restores
 * the real cap: 10 scans per 10 minutes total.
 */
export const scanLimited = createRateLimiter(10 * 60_000, 10)
