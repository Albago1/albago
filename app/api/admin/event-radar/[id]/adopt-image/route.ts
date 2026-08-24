import { NextResponse } from 'next/server'
import { isRequestAdmin } from '@/lib/admin/apiAuth'
import { createClient } from '@/lib/supabase/server'
import { getCandidate } from '@/lib/radar/service'
import { EVENT_COVERS_BUCKET, fetchRemoteImage } from '@/lib/media/remoteImage'

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

/** Fetch/validate rules live in lib/media/remoteImage.ts — shared with the
 *  Phase 38 ingest API so both adoption paths obey identical limits. This route
 *  keeps the upload half, because an admin's copy belongs in their own folder. */
const FETCH_ERROR_STATUS: Record<string, number> = {
  blocked_url: 502,
  fetch_failed: 502,
  unsupported_type: 415,
  empty_image: 502,
  too_large: 413,
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

    const fetched = await fetchRemoteImage(candidate.image_url)
    if (!fetched.ok) {
      return NextResponse.json(
        { ok: false, error: fetched.error },
        { status: FETCH_ERROR_STATUS[fetched.error] ?? 502 },
      )
    }
    const { bytes, contentType, ext } = fetched

    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 })
    }

    const path = `${user.id}/imported-${id}-${crypto.randomUUID().slice(0, 8)}.${ext}`
    const { error: uploadErr } = await supabase.storage
      .from(EVENT_COVERS_BUCKET)
      .upload(path, bytes, { contentType, upsert: false })

    if (uploadErr) {
      console.warn('[adopt-image] upload failed:', uploadErr.message)
      return NextResponse.json(
        { ok: false, error: 'upload_failed', message: uploadErr.message },
        { status: 502 },
      )
    }

    const { data } = supabase.storage.from(EVENT_COVERS_BUCKET).getPublicUrl(path)
    return NextResponse.json({ ok: true, url: data.publicUrl })
  } catch (err) {
    // blocked_url, timeout, too_many_redirects — all mean "no cover", not "stop".
    console.warn('[adopt-image] failed:', err)
    return NextResponse.json({ ok: false, error: 'adopt_failed' }, { status: 502 })
  }
}
