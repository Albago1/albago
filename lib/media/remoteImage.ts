import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import { safeFetch } from '@/lib/ssrfGuard'

/**
 * Taking a copy of somebody else's picture, safely.
 *
 * An imported event's image starts life as a URL on the source's server. Left as
 * a hotlink it breaks the day they rotate the file, it can't pass through
 * next/image, and it leaks our readers' requests to a third party. So before an
 * import becomes a real event we adopt the bytes into our own `event-covers`
 * bucket.
 *
 * The fetch+validate half is shared (extracted from the admin adopt-image route
 * it was first proven in) because there are now two callers with different
 * identities: an admin clicking Adopt uploads as themselves into their own UID
 * folder, while the Phase 38 ingest API has no user at all and uploads with the
 * service-role client. Same rules, different hands.
 *
 * Rules, in order of how often they save us:
 *   - SSRF-guarded fetch, every redirect hop re-validated.
 *   - Type comes from the SERVED content-type, never the URL's extension — CDNs
 *     routinely serve /poster.jpg as WebP. An unlisted type is a "no", not a guess.
 *   - Read fully, then measure. content-length is optional and lies.
 *   - 8 MB cap, matching the browser upload path so both surfaces agree.
 */

export const IMAGE_MAX_BYTES = 8 * 1024 * 1024
export const IMAGE_FETCH_TIMEOUT_MS = 10_000
export const EVENT_COVERS_BUCKET = 'event-covers'

export const IMAGE_TYPE_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/avif': 'avif',
}

export type ImageFetchError =
  | 'blocked_url'
  | 'fetch_failed'
  | 'unsupported_type'
  | 'empty_image'
  | 'too_large'

export type ImageFetchResult =
  | { ok: true; bytes: Uint8Array; contentType: string; ext: string }
  | { ok: false; error: ImageFetchError }

/** Fetch and validate a remote image. Never throws — a blocked or broken URL is
 *  a returned reason, because "no cover" must never abort an import. */
export async function fetchRemoteImage(
  url: string,
  timeoutMs = IMAGE_FETCH_TIMEOUT_MS,
): Promise<ImageFetchResult> {
  let res: Response
  try {
    res = await safeFetch(url, { timeoutMs })
  } catch {
    // blocked_url, timeout, too_many_redirects — all mean "no cover", not "stop".
    return { ok: false, error: 'blocked_url' }
  }
  if (!res.ok) return { ok: false, error: 'fetch_failed' }

  const contentType = (res.headers.get('content-type') ?? '')
    .split(';')[0]
    .trim()
    .toLowerCase()
  const ext = IMAGE_TYPE_EXT[contentType]
  if (!ext) return { ok: false, error: 'unsupported_type' }

  let bytes: Uint8Array
  try {
    bytes = new Uint8Array(await res.arrayBuffer())
  } catch {
    return { ok: false, error: 'fetch_failed' }
  }
  if (bytes.byteLength === 0) return { ok: false, error: 'empty_image' }
  if (bytes.byteLength > IMAGE_MAX_BYTES) return { ok: false, error: 'too_large' }

  return { ok: true, bytes, contentType, ext }
}

export type AdoptImageResult =
  /** The bytes are ours now; `url` is a public URL in our bucket. */
  | { status: 'adopted'; url: string }
  /** We could not take a copy, but the remote URL is at least a usable http(s)
   *  image reference — the candidate keeps it and the admin sees why. */
  | { status: 'hotlinked'; url: string; reason: ImageFetchError | 'upload_failed' }
  | { status: 'none'; reason: ImageFetchError | 'upload_failed' | 'no_image' }

/**
 * Adopt a remote image using the SERVICE-ROLE client — for callers with no
 * signed-in user (the ingest API). Files land under `agent/`, which keeps
 * machine-adopted covers visually separable from `<uid>/` admin uploads in
 * storage without needing a new bucket or policy.
 *
 * Degrades, never fails: on any problem the caller is told to keep the hotlink
 * (still a working picture) or to proceed with no picture at all.
 */
export async function adoptRemoteImage(
  imageUrl: string | null,
  keyHint: string,
): Promise<AdoptImageResult> {
  if (!imageUrl) return { status: 'none', reason: 'no_image' }

  const fetched = await fetchRemoteImage(imageUrl)
  if (!fetched.ok) {
    // An unsupported type or an oversized file is still a real, loadable image
    // for a browser — keep the reference rather than losing the picture.
    const keepable = fetched.error === 'unsupported_type' || fetched.error === 'too_large'
    return keepable
      ? { status: 'hotlinked', url: imageUrl, reason: fetched.error }
      : { status: 'none', reason: fetched.error }
  }

  const safeHint = keyHint.replace(/[^a-z0-9-]/gi, '').slice(0, 40) || 'event'
  const path = `agent/${safeHint}-${crypto.randomUUID().slice(0, 8)}.${fetched.ext}`

  try {
    const db = createAdminClient()
    const { error } = await db.storage
      .from(EVENT_COVERS_BUCKET)
      .upload(path, fetched.bytes, { contentType: fetched.contentType, upsert: false })
    if (error) {
      console.warn('[remoteImage] upload failed:', error.message)
      return { status: 'hotlinked', url: imageUrl, reason: 'upload_failed' }
    }
    const { data } = db.storage.from(EVENT_COVERS_BUCKET).getPublicUrl(path)
    return { status: 'adopted', url: data.publicUrl }
  } catch (err) {
    console.warn('[remoteImage] adopt failed:', err)
    return { status: 'hotlinked', url: imageUrl, reason: 'upload_failed' }
  }
}
