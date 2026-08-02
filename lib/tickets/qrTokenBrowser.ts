/**
 * Browser-side ticket token verification (Web Crypto — NO Node 'crypto').
 *
 * Mirrors lib/tickets/qrToken.ts EXACTLY so door mode can reject a forged or
 * wrong-event token INSTANTLY and OFFLINE, before any network round-trip. The
 * door receives only its own event's derived key (k_event); the master
 * TICKET_QR_SECRET never leaves the server, so a leaked door key at worst forges
 * entry to that one door — which its holder can grant by waving people in anyway.
 *
 * check_in_ticket trusts the ticket_id it is handed, so this signature check is
 * the real anti-forgery gate: never call the check-in RPC on a token that does
 * not verify here.
 */

export const TOKEN_PREFIX = 'ALBGO1'
const MAC_BYTES = 16

export type BrowserVerifyResult =
  | { ok: true; ticketId: string; qrVersion: number }
  | { ok: false; reason: 'malformed' | 'bad_signature' }

function b64urlToBytes(s: string): Uint8Array | null {
  try {
    const b64 = s.replace(/-/g, '+').replace(/_/g, '/')
    const pad = b64.length % 4 === 0 ? '' : '='.repeat(4 - (b64.length % 4))
    const bin = atob(b64 + pad)
    const out = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
    return out
  } catch {
    return null
  }
}

function bytesToUuid(b: Uint8Array): string {
  const h = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('')
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`
}

/**
 * Import the per-event door key (base64url of 32 raw HMAC bytes) into a
 * non-extractable CryptoKey for repeated verification. Call once per scanner
 * session and reuse the key across every scan.
 */
export async function importEventKey(kEventB64Url: string): Promise<CryptoKey> {
  const raw = b64urlToBytes(kEventB64Url)
  if (!raw) throw new Error('importEventKey: malformed key')
  return crypto.subtle.importKey(
    'raw',
    raw as BufferSource,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
}

/**
 * Verify a scanned token against one event's key. Async only because Web Crypto
 * is; otherwise identical logic to the server verifyTicketToken. Proves the
 * token was genuinely issued for THIS event — whether qrVersion is current is a
 * separate rotation concern settled by check_in_ticket / the snapshot.
 */
export async function verifyTicketTokenBrowser(
  raw: string,
  kEvent: CryptoKey,
): Promise<BrowserVerifyResult> {
  const parts = (raw ?? '').trim().split('.')
  if (parts.length !== 4 || parts[0] !== TOKEN_PREFIX) return { ok: false, reason: 'malformed' }
  const [, idPart, versionPart, sigPart] = parts
  if (!/^[1-9][0-9]{0,5}$/.test(versionPart)) return { ok: false, reason: 'malformed' }
  const qrVersion = Number(versionPart)

  const idBytes = b64urlToBytes(idPart)
  const sig = b64urlToBytes(sigPart)
  if (!idBytes || !sig || idBytes.length !== 16 || sig.length !== MAC_BYTES) {
    return { ok: false, reason: 'malformed' }
  }

  const ticketId = bytesToUuid(idBytes)
  const msg = new TextEncoder().encode(`${ticketId.toLowerCase()}.${qrVersion}`)
  const full = new Uint8Array(await crypto.subtle.sign('HMAC', kEvent, msg as BufferSource))
  const expected = full.subarray(0, MAC_BYTES)

  // Length is fixed (16); a byte-diff accumulator keeps the compare constant-time.
  let diff = 0
  for (let i = 0; i < MAC_BYTES; i++) diff |= sig[i] ^ expected[i]
  if (diff !== 0) return { ok: false, reason: 'bad_signature' }

  return { ok: true, ticketId, qrVersion }
}
