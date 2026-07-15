import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { decryptCredentials } from '@/lib/social/crypto'
import {
  publishInstagramImage,
  type InstagramCredentials,
} from '@/lib/social/instagram'

/**
 * BC-1: publish a queued social post now. Admin-only. Claims the post via
 * RPC (status → publishing, attempts+1), runs the platform adapter, records
 * the outcome. The scheduler tick (BC-3) reuses this exact claim/finish
 * contract, so "publish now" and "publish on time" can never drift apart.
 */

export const maxDuration = 60

type ClaimedPost = {
  id: string
  kind: string
  caption: string
  asset_urls: string[]
  platform: string
  credentials: string
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ ok: false, error: 'not_authenticated' }, { status: 401 })
  }
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()
  if (profile?.role !== 'admin') {
    return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 })
  }

  let body: { postId?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_request' }, { status: 400 })
  }
  if (typeof body.postId !== 'string') {
    return NextResponse.json({ ok: false, error: 'missing_post_id' }, { status: 400 })
  }

  const { data, error: claimError } = await supabase.rpc('broadcast_claim_post', {
    p_id: body.postId,
  })
  if (claimError) {
    console.error('[broadcast/publish] claim failed:', claimError.message)
    return NextResponse.json({ ok: false, error: 'claim_failed' }, { status: 500 })
  }
  const post = (Array.isArray(data) ? data[0] : data) as ClaimedPost | null
  if (!post) {
    return NextResponse.json(
      { ok: false, error: 'not_claimable' },
      { status: 409 },
    )
  }

  const finish = async (
    status: 'published' | 'failed',
    externalId: string | null,
    externalUrl: string | null,
    errorMessage: string | null,
  ) => {
    const { error } = await supabase.rpc('broadcast_finish_post', {
      p_id: post.id,
      p_status: status,
      p_external_id: externalId,
      p_external_url: externalUrl,
      p_error: errorMessage,
    })
    if (error) console.error('[broadcast/publish] finish failed:', error.message)
  }

  try {
    if (post.platform !== 'instagram') {
      await finish('failed', null, null, `no adapter for ${post.platform} yet`)
      return NextResponse.json({ ok: false, error: 'unsupported_platform' }, { status: 400 })
    }
    if (!post.asset_urls?.[0]) {
      await finish('failed', null, null, 'post has no asset')
      return NextResponse.json({ ok: false, error: 'no_asset' }, { status: 400 })
    }

    const creds = decryptCredentials<InstagramCredentials>(post.credentials)
    const result = await publishInstagramImage({
      creds,
      imageUrl: post.asset_urls[0],
      caption: post.caption,
      story: post.kind === 'story',
    })

    await finish('published', result.externalId, result.url, null)
    return NextResponse.json({ ok: true, externalUrl: result.url })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'publish failed'
    await finish('failed', null, null, message)
    return NextResponse.json({ ok: false, error: message }, { status: 502 })
  }
}
