import { timingSafeEqual } from 'node:crypto'

/**
 * Ingest API authorization (Phase 38).
 *
 * The GPT ingest endpoint is the only route on AlbaGo that a non-human, non-admin
 * caller may write through, so its gate is deliberately its own: a dedicated
 * INGEST_API_KEY rather than a reused CRON_SECRET. Different credential, different
 * blast radius — a leaked ingest key can spam the admin review queue and nothing
 * else, and rotating it never touches the cron jobs.
 *
 * Fails CLOSED, exactly like lib/cron/auth.ts: no key configured means every call
 * is rejected. A write endpoint must never stand open because an env var is
 * missing on a fresh environment.
 */

/** Constant-time string compare. Length is compared first (and leaks, harmlessly
 *  — the key length is not the secret); the bytes never short-circuit. */
function secretsMatch(provided: string, expected: string): boolean {
  const a = Buffer.from(provided, 'utf8')
  const b = Buffer.from(expected, 'utf8')
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

export function isAuthorizedIngest(request: Request): boolean {
  const secret = process.env.INGEST_API_KEY
  if (!secret) return false

  const header = request.headers.get('authorization') ?? ''
  const prefix = 'Bearer '
  if (!header.startsWith(prefix)) return false

  return secretsMatch(header.slice(prefix.length).trim(), secret)
}
