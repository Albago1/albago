import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

/**
 * App-layer encryption for social account credentials (BC track §5).
 * AES-256-GCM with a key from SOCIAL_CRED_KEY (base64, 32 bytes). Tokens are
 * encrypted before they touch the database and decrypted only inside server
 * code — they never reach the client, logs, or error messages.
 *
 * Wire format: base64(iv) . base64(authTag) . base64(ciphertext)
 */

function key(): Buffer {
  const raw = process.env.SOCIAL_CRED_KEY
  if (!raw) throw new Error('SOCIAL_CRED_KEY is not set')
  const buf = Buffer.from(raw, 'base64')
  if (buf.length !== 32) throw new Error('SOCIAL_CRED_KEY must be 32 bytes (base64)')
  return buf
}

export function encryptCredentials(payload: Record<string, unknown>): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key(), iv)
  const plaintext = Buffer.from(JSON.stringify(payload), 'utf8')
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()])
  const tag = cipher.getAuthTag()
  return `${iv.toString('base64')}.${tag.toString('base64')}.${encrypted.toString('base64')}`
}

export function decryptCredentials<T = Record<string, unknown>>(blob: string): T {
  const [ivB64, tagB64, dataB64] = blob.split('.')
  if (!ivB64 || !tagB64 || !dataB64) throw new Error('malformed credential blob')
  const decipher = createDecipheriv('aes-256-gcm', key(), Buffer.from(ivB64, 'base64'))
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'))
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(dataB64, 'base64')),
    decipher.final(),
  ])
  return JSON.parse(decrypted.toString('utf8')) as T
}
