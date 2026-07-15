import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { encryptCredentials } from '@/lib/social/crypto'
import {
  exchangeCodeForToken,
  getLongLivedToken,
  listPagesWithInstagram,
} from '@/lib/social/instagram'

/**
 * BC-1: Meta OAuth callback. Exchanges the code for a long-lived token,
 * finds the Page-linked Instagram professional account, and stores it
 * (encrypted) via the broadcast_upsert_account RPC. Admin-only.
 */

export const maxDuration = 60

function backTo(request: Request, query: string) {
  return NextResponse.redirect(
    new URL(`/admin/broadcast?${query}`, new URL(request.url).origin),
  )
}

export async function GET(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.redirect(new URL('/sign-in', request.url))
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()
  if (profile?.role !== 'admin') {
    return NextResponse.redirect(new URL('/', request.url))
  }

  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  const cookieStore = await cookies()
  const expectedState = cookieStore.get('bc_meta_state')?.value

  if (url.searchParams.get('error')) {
    return backTo(request, `error=meta_denied`)
  }
  if (!code || !state || !expectedState || state !== expectedState) {
    return backTo(request, `error=meta_state`)
  }

  try {
    const redirectUri = `${url.origin}/api/broadcast/meta/callback`
    const shortToken = await exchangeCodeForToken(code, redirectUri)
    const userToken = await getLongLivedToken(shortToken)
    const pages = await listPagesWithInstagram(userToken)

    if (pages.length === 0) {
      return backTo(request, `error=no_ig_account`)
    }

    // BC-1 keeps it simple: connect the first Page-linked IG account.
    // Multi-account selection lands with the bulk composer if ever needed.
    const pick = pages[0]
    const credentials = encryptCredentials({
      ig_user_id: pick.igUserId,
      page_id: pick.pageId,
      page_token: pick.pageToken,
      user_token: userToken,
      username: pick.igUsername,
    })

    const { error } = await supabase.rpc('broadcast_upsert_account', {
      p_platform: 'instagram',
      p_label: `Instagram @${pick.igUsername}`,
      p_handle: pick.igUsername,
      p_credentials: credentials,
      p_meta: {
        ig_user_id: pick.igUserId,
        page_id: pick.pageId,
        page_name: pick.pageName,
        // Long-lived user tokens last ~60 days; reconnecting refreshes.
        token_obtained_at: new Date().toISOString(),
      },
    })
    if (error) {
      console.error('[broadcast/meta/callback] upsert failed:', error.message)
      return backTo(request, `error=store_failed`)
    }

    const response = backTo(request, `connected=instagram`)
    response.cookies.delete('bc_meta_state')
    return response
  } catch (err) {
    console.error('[broadcast/meta/callback]', err)
    return backTo(request, `error=meta_exchange`)
  }
}
