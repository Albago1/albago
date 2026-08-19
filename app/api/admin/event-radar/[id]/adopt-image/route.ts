import { NextResponse } from 'next/server'
import { isRequestAdmin } from '@/lib/admin/apiAuth'
import { createClient } from '@/lib/supabase/server'
import { getCandidate } from '@/lib/radar/service'
import { safeFetch } from '@/lib/ssrfGuard'

/**
 * Adopt an imported candidate's poster into our own storage.
 *
 * A candidate's `image_url` is a hotlink to the source site: it breaks the day
 * they rotate the file, it can't pass through next/image, and it leaks our
 * readers' requests to a third party. So before a candidate becomes a real
 * event, we take a copy — this route fetches the bytes (SSRF-guarded, same as
 * every other outbound hop in Radar) and re-uploads them to `event-covers`.
 *
 * Uploads run as the signed-in admin into their own UID folder, which is
 * exactly what the existing storage policy allows (docs/seeds/phase-13-storage.sql)
 * — no new bucket, no new policy, no migration.
 *
 * POST → { ok: true, url } | { ok: false, error }
 * Failure is never fatal to the caller: the wizard just opens without a cover.
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 30

const MAX_BYTES = 8 * 1024 * 1024
const TYPE_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/avif': 'avif',
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await isRequestAdmin())) {
    return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 })
  }
  const { id } = await params

  try {
    const candidate = await getCandidate(id)
    if (!candidate) {
      return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 })
    }
    if (!candidate.image_url) {
      return NextResponse.json({ ok: false, error: 'no_image' }, { status: 404 })
    }

    const res = await safeFetch(candidate.image_url, { timeoutMs: 10000 })
    if (!res.ok) {
      return NextResponse.json({ ok: false, error: 'fetch_failed' }, { status: 502 })
    }

    // Trust the served type over the URL's extension — CDNs routinely serve
    // /poster.jpg as WebP. An unlisted type is a "no", not a guess.
    const contentType = (res.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase()
    const ext = TYPE_EXT[contentType]
    if (!ext) {
      return NextResponse.json({ ok: false, error: 'unsupported_type' }, { status: 415 })
    }

    // Read fully, then check size: content-length is optional and lies. The
    // 8 MB cap matches the browser upload path so both surfaces agree.
    const bytes = new Uint8Array(await res.arrayBuffer())
    if (bytes.byteLength === 0) {
      return NextResponse.json({ ok: false, error: 'empty_image' }, { status: 502 })
    }
    if (bytes.byteLength > MAX_BYTES) {
      return NextResponse.json({ ok: false, error: 'too_large' }, { status: 413 })
    }

    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 })
    }

    const path = `${user.id}/imported-${id}-${crypto.randomUUID().slice(0, 8)}.${ext}`
    const { error: uploadErr } = await supabase.storage
      .from('event-covers')
      .upload(path, bytes, { contentType, upsert: false })

    if (uploadErr) {
      console.warn('[adopt-image] upload failed:', uploadErr.message)
      return NextResponse.json(
        { ok: false, error: 'upload_failed', message: uploadErr.message },
        { status: 502 },
      )
    }

    const { data } = supabase.storage.from('event-covers').getPublicUrl(path)
    return NextResponse.json({ ok: true, url: data.publicUrl })
  } catch (err) {
    // blocked_url, timeout, too_many_redirects — all mean "no cover", not "stop".
    console.warn('[adopt-image] failed:', err)
    return NextResponse.json({ ok: false, error: 'adopt_failed' }, { status: 502 })
  }
}
