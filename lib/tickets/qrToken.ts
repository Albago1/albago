import { createHmac, timingSafeEqual } from 'crypto'

/**
 * Signed ticket QR tokens — SERVER ONLY. Never import from a client component.
 *
 * Token layout (docs/master-plan/02-ticketing.md §3):
 *
 *   ALBGO1.<ticket_id 16B base64url>.<qr_version>.<HMAC-SHA256(k_event,
 *       ticket_id || '.' || qr_version) truncated to 16B, base64url>
 *
 *   k_event = HMAC-SHA256(TICKET_QR_SECRET, 'evt:' || event_id)
 *
 * The master secret never leaves the server; door mode receives only its own
 * event's derived key, so the worst a leaked door key enables is forging entry
 * to that one door — which its holder can grant anyway by waving people in.
 * A token from another event fails the signature against k_event, giving the
 * offline scanner a wrong-event/bad-signature verdict with no lookup at all.
 *
 * The HMAC message is delimiter-joined to match the token layout — undelimited
 * concatenation would be ambiguous by construction.
 */

export const TOKEN_PREFIX = 'ALBGO1'
const MAC_BYTES = 16

export type VerifyResult =
  | { ok: true; ticketId: string; qrVersion: number }
  | { ok: false; reason: 'malformed' | 'bad_signature' }

function getMasterSecret(): Buffer {
  const secret = process.env.TICKET_QR_SECRET
  if (!secret || secret.length < 32) {
    throw new Error('TICKET_QR_SECRET missing or too short (min 32 chars)')
  }
  return Buffer.from(secret, 'utf8')
}

/** Per-event door key. Pass to door mode as base64url via deriveEventKeyB64. */
export function deriveEventKey(eventId: string): Buffer {
  return createHmac('sha256', getMasterSecret()).update(`evt:${eventId}`).digest()
}

export function deriveEventKeyB64(eventId: string): string {
  return deriveEventKey(eventId).toString('base64url')
}

/** Canonical lowercase UUID → 16 bytes. Returns null on malformed input. */
function uuidToBytes(uuid: string): Buffer | null {
  const hex = uuid.toLowerCase().replace(/-/g, '')
  if (!/^[0-9a-f]{32}$/.test(hex)) return null
  return Buffer.from(hex, 'hex')
}

function bytesToUuid(buf: Buffer): string {
  const h = buf.toString('hex')
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`
}

function mac(kEvent: Buffer, ticketId: string, qrVersion: number): Buffer {
  return createHmac('sha256', kEvent)
    .update(`${ticketId.toLowerCase()}.${qrVersion}`)
    .digest()
    .subarray(0, MAC_BYTES)
}

/** Sign a ticket into its QR token string. */
export function signTicketToken(eventId: string, ticketId: string, qrVersion: number): string {
  const idBytes = uuidToBytes(ticketId)
  if (!idBytes) throw new Error('signTicketToken: malformed ticket id')
  if (!Number.isInteger(qrVersion) || qrVersion < 1) {
    throw new Error('signTicketToken: bad qr_version')
  }
  const kEvent = deriveEventKey(eventId)
  const sig = mac(kEvent, ticketId, qrVersion)
  return [
    TOKEN_PREFIX,
    idBytes.toString('base64url'),
    String(qrVersion),
    sig.toString('base64url'),
  ].join('.')
}

/**
 * Verify a scanned token against one event's derived key. Pure — no I/O, so it
 * runs identically on the server and inside offline door mode.
 * NOTE: proves the token was genuinely issued; whether qrVersion is CURRENT is
 * decided against the door snapshot / check_in_ticket (rotation semantics).
 */
export function verifyTicketToken(raw: string, kEvent: Buffer): VerifyResult {
  const parts = (raw ?? '').trim().split('.')
  if (parts.length !== 4 || parts[0] !== TOKEN_PREFIX) return { ok: false, reason: 'malformed' }
  const [, idPart, versionPart, sigPart] = parts
  if (!/^[1-9][0-9]{0,5}$/.test(versionPart)) return { ok: false, reason: 'malformed' }
  const qrVersion = Number(versionPart)
  let idBytes: Buffer
  let sig: Buffer
  try {
    idBytes = Buffer.from(idPart, 'base64url')
    sig = Buffer.from(sigPart, 'base64url')
  } catch {
    return { ok: false, reason: 'malformed' }
  }
  if (idBytes.length !== 16 || sig.length !== MAC_BYTES) return { ok: false, reason: 'malformed' }
  const ticketId = bytesToUuid(idBytes)
  const expected = mac(kEvent, ticketId, qrVersion)
  if (!timingSafeEqual(sig, expected)) return { ok: false, reason: 'bad_signature' }
  return { ok: true, ticketId, qrVersion }
}
