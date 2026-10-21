/**
 * Is this picture stored in AlbaGo's own Supabase Storage? Only those go
 * through Next's image optimizer (resized, cached by Vercel). Everything
 * else — including other projects' Supabase buckets and organizer posters
 * the Event Engine found — is shown straight from where it lives, never
 * fetched or copied on AlbaGo's side.
 */
const OWN_HOST = (() => {
  try {
    return process.env.NEXT_PUBLIC_SUPABASE_URL ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname : null
  } catch {
    return null
  }
})()

export function isOwnImage(src: string | null | undefined): boolean {
  if (!src || !OWN_HOST) return false
  try {
    const url = new URL(src)
    return url.hostname === OWN_HOST && url.pathname.startsWith('/storage/v1/object/public/')
  } catch {
    return false
  }
}
