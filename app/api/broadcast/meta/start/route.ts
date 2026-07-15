import { NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import { createClient } from '@/lib/supabase/server'

/**
 * BC-1: kick off the Meta OAuth dance. Admin-only. Redirects to the Facebook
 * login dialog; the callback route stores the connected IG account.
 *
 * Business-type Meta apps use "Facebook Login for Business" configurations
 * (META_LOGIN_CONFIG_ID); classic apps use a scope list. We support both.
 */

const SCOPES = [
  'pages_show_list',
  'instagram_basic',
  'instagram_content_publish',
  'pages_read_engagement',
  'business_management',
].join(',')

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

  const appId = process.env.META_APP_ID
  if (!appId) {
    return NextResponse.redirect(
      new URL('/admin/broadcast?error=meta_env_missing', request.url),
    )
  }

  const origin = new URL(request.url).origin
  const redirectUri = `${origin}/api/broadcast/meta/callback`
  const state = randomBytes(16).toString('hex')

  const dialog = new URL('https://www.facebook.com/v21.0/dialog/oauth')
  dialog.searchParams.set('client_id', appId)
  dialog.searchParams.set('redirect_uri', redirectUri)
  dialog.searchParams.set('state', state)
  dialog.searchParams.set('response_type', 'code')
  const configId = process.env.META_LOGIN_CONFIG_ID
  if (configId) {
    dialog.searchParams.set('config_id', configId)
  } else {
    dialog.searchParams.set('scope', SCOPES)
  }

  const response = NextResponse.redirect(dialog.toString())
  response.cookies.set('bc_meta_state', state, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: 600,
    path: '/',
  })
  return response
}
