import { lookup } from 'node:dns/promises'
import net from 'node:net'

/**
 * SSRF protection for server-side fetches of user-supplied URLs.
 *
 * A hostname string blocklist is not enough: `evil.com` can have an A record
 * pointing at 169.254.169.254, and a public page can 302-redirect to an
 * internal host. So we (a) accept only http(s) on standard ports, (b) resolve
 * DNS and reject any answer in a private/link-local/loopback range, and
 * (c) exported `safeFetch` follows redirects MANUALLY, re-validating every hop.
 */

function ipv4IsPrivate(ip: string): boolean {
  const p = ip.split('.').map(Number)
  if (p.length !== 4 || p.some((n) => Number.isNaN(n) || n < 0 || n > 255)) return true
  const [a, b] = p
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 169 && b === 254) || // link-local (cloud metadata)
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 100 && b >= 64 && b <= 127) || // carrier-grade NAT
    a >= 224 // multicast / reserved
  )
}

function ipv6IsPrivate(ip: string): boolean {
  const norm = ip.toLowerCase().replace(/^\[|\]$/g, '')
  if (norm === '::1' || norm === '::') return true
  if (norm.startsWith('fe80') || norm.startsWith('fc') || norm.startsWith('fd')) return true
  // IPv4-mapped (::ffff:127.0.0.1) — validate the embedded v4.
  const mapped = norm.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/)
  if (mapped) return ipv4IsPrivate(mapped[1])
  return false
}

function isPrivateAddress(ip: string): boolean {
  const v = net.isIP(ip)
  if (v === 4) return ipv4IsPrivate(ip)
  if (v === 6) return ipv6IsPrivate(ip)
  return true // not a parseable IP → refuse
}

/** Structural check: http(s) only, standard ports, hostname not a private literal. */
export function isPublicHttpUrl(raw: string): URL | null {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    return null
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
  // Only default/standard web ports — no pointing at internal service ports.
  if (url.port && url.port !== '80' && url.port !== '443') return null
  // Strip the brackets URL keeps around IPv6 literals so net.isIP sees them.
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, '')
  if (
    !host ||
    host === 'localhost' ||
    host === '0.0.0.0' ||
    host.endsWith('.local') ||
    host.endsWith('.internal') ||
    host.endsWith('.localhost')
  ) {
    return null
  }
  // If the host is already an IP literal, it must be public. Non-IP hostnames
  // are checked via DNS at fetch time.
  if (net.isIP(host) && isPrivateAddress(host)) return null
  return url
}

/** Resolve a hostname and reject if ANY resolved address is private. */
async function hostResolvesPublic(rawHostname: string): Promise<boolean> {
  const hostname = rawHostname.replace(/^\[|\]$/g, '')
  if (net.isIP(hostname)) return !isPrivateAddress(hostname)
  try {
    const results = await lookup(hostname, { all: true })
    if (results.length === 0) return false
    return results.every((r) => !isPrivateAddress(r.address))
  } catch {
    return false
  }
}

export type SafeFetchOptions = {
  headers?: Record<string, string>
  timeoutMs?: number
  maxRedirects?: number
}

/**
 * fetch() with SSRF protection: validates the URL and its resolved IPs, then
 * follows redirects manually, re-validating every hop. Throws on a blocked
 * hop or too many redirects. Returns the final Response.
 */
export async function safeFetch(
  rawUrl: string,
  { headers, timeoutMs = 8000, maxRedirects = 4 }: SafeFetchOptions = {},
): Promise<Response> {
  let current = isPublicHttpUrl(rawUrl)
  if (!current) throw new Error('blocked_url')

  for (let hop = 0; hop <= maxRedirects; hop++) {
    if (!(await hostResolvesPublic(current.hostname))) throw new Error('blocked_url')

    const res = await fetch(current.toString(), {
      headers,
      redirect: 'manual',
      signal: AbortSignal.timeout(timeoutMs),
    })

    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get('location')
      if (!location) return res
      const next = isPublicHttpUrl(new URL(location, current).toString())
      if (!next) throw new Error('blocked_url')
      current = next
      continue
    }
    return res
  }
  throw new Error('too_many_redirects')
}
