import type { MediaRefV1 } from '@/engine'

/**
 * Which picture AlbaGo shows for an engine event. The organizer's own poster
 * (the image their event page publishes for sharing) is rendered straight
 * from their site — never downloaded or stored by AlbaGo. A site-wide image
 * (logo, "og-default") is not a poster, so it is skipped; so is any image
 * that several different events share (the page's generic picture).
 * Pure: used by publishing and by the review preview alike.
 */

// File names that mark a site's generic share image rather than an event poster.
const GENERIC_IMAGE = /(^|[/_.-])(og[-_]?(global|default|image|share|fallback)|default|placeholder|fallback|logo|favicon|share[-_]?image|social[-_]?(share|card|image)|site[-_]?image|no[-_]?image)([._-]|$)/i

export function posterUrl(media: Pick<MediaRefV1, 'url' | 'role'>[], shared?: ReadonlySet<string>): string | null {
  for (const m of media) {
    if (m.role !== 'poster') continue
    let url: URL
    try {
      url = new URL(m.url)
    } catch {
      continue
    }
    if (url.protocol !== 'https:' && url.protocol !== 'http:') continue
    if (GENERIC_IMAGE.test(url.pathname.split('/').pop() ?? '')) continue
    if (shared?.has(m.url)) continue
    // AlbaGo is served over https; an http image would be blocked as mixed content.
    url.protocol = 'https:'
    return url.toString()
  }
  return null
}

/** Image URLs that appear on more than one distinct event (a site's generic picture). */
export function sharedImageUrls(events: Array<{ id: string; media: Pick<MediaRefV1, 'url'>[] }>): Set<string> {
  const seen = new Map<string, Set<string>>()
  for (const e of events) for (const m of e.media) seen.set(m.url, (seen.get(m.url) ?? new Set()).add(e.id))
  return new Set([...seen].filter(([, ids]) => ids.size > 1).map(([url]) => url))
}
