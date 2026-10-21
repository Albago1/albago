/**
 * Credit for a picture AlbaGo shows straight from another website (an
 * organizer's poster found by the Event Engine): "Image: eventfrog.ch",
 * linking to the event's source page. Pictures AlbaGo hosts itself (organizer
 * uploads, AI poster art in our storage) need no credit.
 */
export function imageCredit(imageUrl: string | null, sourceUrl: string | null, ownHosts: string[]): { label: string; href: string } | null {
  if (!imageUrl) return null
  let image: URL
  try {
    image = new URL(imageUrl)
  } catch {
    return null
  }
  const own = ownHosts.map((h) => h.toLowerCase())
  if (own.includes(image.hostname.toLowerCase())) return null
  let source: URL | null = null
  try {
    source = sourceUrl ? new URL(sourceUrl) : null
  } catch {
    source = null
  }
  const credited = source && (source.protocol === 'https:' || source.protocol === 'http:') ? source : image
  return { label: credited.hostname.replace(/^www\./, ''), href: credited.toString() }
}

/** Hosts whose pictures are AlbaGo's own (its Supabase storage and its domains). */
export function ownImageHosts(): string[] {
  const hosts = ['albago.org', 'www.albago.org']
  try {
    if (process.env.NEXT_PUBLIC_SUPABASE_URL) hosts.push(new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname)
  } catch {
    // no Supabase URL configured: nothing to add
  }
  return hosts
}
