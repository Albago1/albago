/**
 * Instagram adapter (BC track §2.3) — Meta Graph API Content Publishing.
 *
 * Publishing is a two-step dance: create a media container from a PUBLIC
 * image URL, poll until Meta finishes ingesting it, then publish the
 * container. Works in a Development Mode app for accounts that hold a role
 * on the app (our own) — no App Review needed for the admin-only system.
 *
 * Budget note: IG allows 50 API publishes per rolling 24h per IG user.
 */

const GRAPH = 'https://graph.facebook.com/v21.0'

export type InstagramCredentials = {
  ig_user_id: string
  page_id: string
  page_token: string
  user_token: string
  username?: string
}

type GraphError = { error?: { message?: string; code?: number } }

async function graphFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init)
  const json = (await res.json()) as T & GraphError
  if (!res.ok || json.error) {
    throw new Error(json.error?.message || `Graph API error (HTTP ${res.status})`)
  }
  return json
}

/** OAuth step 1 → 2: exchange the login code for a short-lived user token. */
export async function exchangeCodeForToken(
  code: string,
  redirectUri: string,
): Promise<string> {
  const url = new URL(`${GRAPH}/oauth/access_token`)
  url.searchParams.set('client_id', process.env.META_APP_ID ?? '')
  url.searchParams.set('client_secret', process.env.META_APP_SECRET ?? '')
  url.searchParams.set('redirect_uri', redirectUri)
  url.searchParams.set('code', code)
  const json = await graphFetch<{ access_token: string }>(url.toString())
  return json.access_token
}

/** Short-lived → long-lived user token (~60 days). */
export async function getLongLivedToken(shortToken: string): Promise<string> {
  const url = new URL(`${GRAPH}/oauth/access_token`)
  url.searchParams.set('grant_type', 'fb_exchange_token')
  url.searchParams.set('client_id', process.env.META_APP_ID ?? '')
  url.searchParams.set('client_secret', process.env.META_APP_SECRET ?? '')
  url.searchParams.set('fb_exchange_token', shortToken)
  const json = await graphFetch<{ access_token: string }>(url.toString())
  return json.access_token
}

export type PageWithInstagram = {
  pageId: string
  pageName: string
  pageToken: string
  igUserId: string
  igUsername: string
}

/** List the user's Pages that have an Instagram professional account linked. */
export async function listPagesWithInstagram(
  userToken: string,
): Promise<PageWithInstagram[]> {
  const url = new URL(`${GRAPH}/me/accounts`)
  url.searchParams.set(
    'fields',
    'id,name,access_token,instagram_business_account{id,username}',
  )
  url.searchParams.set('access_token', userToken)
  const json = await graphFetch<{
    data: Array<{
      id: string
      name: string
      access_token: string
      instagram_business_account?: { id: string; username: string }
    }>
  }>(url.toString())

  return (json.data ?? [])
    .filter((p) => p.instagram_business_account?.id)
    .map((p) => ({
      pageId: p.id,
      pageName: p.name,
      pageToken: p.access_token,
      igUserId: p.instagram_business_account!.id,
      igUsername: p.instagram_business_account!.username,
    }))
}

export type PublishResult = { externalId: string; url: string | null }

/**
 * Publish a JPEG (public URL) to the IG account as a feed post or a story.
 * Stories don't support captions — the caption is silently dropped there.
 */
export async function publishInstagramImage(opts: {
  creds: InstagramCredentials
  imageUrl: string
  caption: string
  story?: boolean
}): Promise<PublishResult> {
  const { creds, imageUrl, caption, story } = opts
  const token = creds.page_token || creds.user_token

  // 1. Create the media container.
  const createUrl = new URL(`${GRAPH}/${creds.ig_user_id}/media`)
  createUrl.searchParams.set('image_url', imageUrl)
  if (story) {
    createUrl.searchParams.set('media_type', 'STORIES')
  } else if (caption) {
    createUrl.searchParams.set('caption', caption)
  }
  createUrl.searchParams.set('access_token', token)
  const container = await graphFetch<{ id: string }>(createUrl.toString(), {
    method: 'POST',
  })

  // 2. Poll until Meta finishes ingesting the image (usually 1–3s).
  for (let attempt = 0; attempt < 20; attempt++) {
    const statusUrl = new URL(`${GRAPH}/${container.id}`)
    statusUrl.searchParams.set('fields', 'status_code')
    statusUrl.searchParams.set('access_token', token)
    const status = await graphFetch<{ status_code: string }>(statusUrl.toString())
    if (status.status_code === 'FINISHED') break
    if (status.status_code === 'ERROR') {
      throw new Error('Instagram could not process the image (container ERROR)')
    }
    await new Promise((r) => setTimeout(r, 1500))
  }

  // 3. Publish the container.
  const publishUrl = new URL(`${GRAPH}/${creds.ig_user_id}/media_publish`)
  publishUrl.searchParams.set('creation_id', container.id)
  publishUrl.searchParams.set('access_token', token)
  const published = await graphFetch<{ id: string }>(publishUrl.toString(), {
    method: 'POST',
  })

  // 4. Fetch the permalink for the queue UI (best-effort).
  let permalink: string | null = null
  try {
    const linkUrl = new URL(`${GRAPH}/${published.id}`)
    linkUrl.searchParams.set('fields', 'permalink')
    linkUrl.searchParams.set('access_token', token)
    const link = await graphFetch<{ permalink?: string }>(linkUrl.toString())
    permalink = link.permalink ?? null
  } catch {
    // Permalink is cosmetic — publishing already succeeded.
  }

  return { externalId: published.id, url: permalink }
}
