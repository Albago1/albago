/**
 * Cron authorization. Vercel Cron invokes the scheduled path with the header
 * `Authorization: Bearer <CRON_SECRET>` when CRON_SECRET is set in the project
 * env. We verify it so these routes can't be triggered by anyone who guesses the
 * path. Fail CLOSED: if no secret is configured, every call is rejected — a cron
 * job that mutates data must never run wide open.
 */
export function isAuthorizedCron(request: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const header = request.headers.get('authorization') ?? ''
  return header === `Bearer ${secret}`
}
