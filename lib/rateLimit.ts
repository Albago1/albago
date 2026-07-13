type RateEntry = { windowStart: number; count: number }

/**
 * Sliding-window in-memory rate limiter (per serverless instance). Returns a
 * `limited(key)` function; call it once per request with e.g. the client IP.
 *
 * Extracted from the hand-rolled copies in the lens/AI routes so sibling
 * endpoints can share ONE bucket (import a shared instance) instead of each
 * granting a separate quota.
 */
export function createRateLimiter(
  windowMs: number,
  max: number,
  mapMax = 5000,
): (key: string) => boolean {
  const map = new Map<string, RateEntry>()
  return function limited(key: string): boolean {
    const now = Date.now()
    const entry = map.get(key)
    if (!entry || now - entry.windowStart > windowMs) {
      if (map.size >= mapMax) {
        const oldestKey = map.keys().next().value
        if (oldestKey) map.delete(oldestKey)
      }
      map.set(key, { windowStart: now, count: 1 })
      return false
    }
    entry.count += 1
    return entry.count > max
  }
}
