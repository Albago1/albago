// Moved from lib/ai/urlReader.ts (Phase 0 B4) — pure HTML distillation, no I/O.

export function decodeEntities(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&nbsp;/g, ' ')
}

export function metaContent(html: string, property: string): string | null {
  // Handles both `property="og:x" content="..."` and the reversed order.
  const patterns = [
    new RegExp(
      `<meta[^>]+(?:property|name)=["']${property}["'][^>]+content=["']([^"']+)["']`,
      'i',
    ),
    new RegExp(
      `<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${property}["']`,
      'i',
    ),
  ]
  for (const re of patterns) {
    const m = html.match(re)
    if (m?.[1]) return decodeEntities(m[1].trim())
  }
  return null
}

export function extractJsonLd(html: string): string {
  const blocks: string[] = []
  const re = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(html)) && blocks.length < 3) {
    const raw = m[1].trim()
    // Keep only event-ish blocks to save tokens.
    if (/"@type"\s*:\s*"[^"]*Event/i.test(raw) || /startDate|location|performer/i.test(raw)) {
      blocks.push(raw.slice(0, 4000))
    }
  }
  return blocks.join('\n')
}

export function visibleText(html: string): string {
  return decodeEntities(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim(),
  )
}

/** Resolve an image src against the page URL; collapse the accidental `//` in a
 *  path (some CMSs emit `host//storage/…`) and reject non-http(s) schemes. */
export function resolveImageUrl(src: string | null, baseUrl: string): string | null {
  if (!src) return null
  try {
    const u = new URL(decodeEntities(src.trim()), baseUrl)
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null
    u.pathname = u.pathname.replace(/\/{2,}/g, '/')
    return u.toString()
  } catch {
    return null
  }
}

export function linkImageSrc(html: string): string | null {
  const m =
    html.match(/<link[^>]+rel=["']image_src["'][^>]+href=["']([^"']+)["']/i) ||
    html.match(/<link[^>]+href=["']([^"']+)["'][^>]+rel=["']image_src["']/i)
  return m ? decodeEntities(m[1].trim()) : null
}

function imgAttr(tag: string, name: string): string | null {
  const m = tag.match(new RegExp(`\\b${name}=["']([^"']+)["']`, 'i'))
  return m ? m[1].trim() : null
}

// Chrome/logo/tracking assets that are never the event's photo.
const NON_CONTENT_IMG =
  /(logo|icon|sprite|favicon|avatar|placeholder|spacer|blank|pixel|1x1|badge|loader|loading|facebook\.com\/tr|\/tr\?)/i
// Paths that mark a real uploaded/content image (vs. theme chrome).
const CONTENT_IMG_PATH = /\/(uploads|storage|media|posters?|events?|photos?|files)\//i

/** The event's own image URL from a candidate <img> tag, or null to skip it.
 *  Handles lazy-load attrs and drops data:/svg/tiny/chrome images. */
function imageFromTag(tag: string, baseUrl: string): string | null {
  let src = imgAttr(tag, 'src')
  if (!src || /^data:/i.test(src) || NON_CONTENT_IMG.test(src)) {
    src =
      imgAttr(tag, 'data-src') ||
      imgAttr(tag, 'data-original') ||
      imgAttr(tag, 'data-lazy-src') ||
      imgAttr(tag, 'data-lazy') ||
      src
  }
  if (!src) {
    const ss = imgAttr(tag, 'srcset') || imgAttr(tag, 'data-srcset')
    if (ss) src = ss.split(',')[0].trim().split(/\s+/)[0]
  }
  if (!src || /^data:/i.test(src) || /\.svg(\?|$)/i.test(src) || NON_CONTENT_IMG.test(src)) return null
  // Skip images the page itself declares small (nav thumbs, sponsor logos).
  const w = parseInt(imgAttr(tag, 'width') ?? '', 10)
  const h = parseInt(imgAttr(tag, 'height') ?? '', 10)
  if ((w && w < 150) || (h && h < 150)) return null
  return resolveImageUrl(src, baseUrl)
}

/** When no OG/Twitter image exists, scan the body for the poster. Two passes:
 *  first prefer an image on a real upload/content path (skips theme logos even
 *  when their filename hides the word "logo"), then fall back to the first
 *  substantial image anywhere. */
export function firstContentImage(html: string, baseUrl: string): string | null {
  const tags = html.match(/<img\b[^>]*>/gi) ?? []
  let firstAny: string | null = null
  for (const tag of tags) {
    const url = imageFromTag(tag, baseUrl)
    if (!url) continue
    if (CONTENT_IMG_PATH.test(new URL(url).pathname)) return url
    if (!firstAny) firstAny = url
  }
  return firstAny
}

/** Every JSON-LD block on the page, parsed. Unparseable blocks are skipped. */
export function parseJsonLdBlocks(html: string): unknown[] {
  const out: unknown[] = []
  const re = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(html)) && out.length < 20) {
    try {
      out.push(JSON.parse(m[1].trim()))
    } catch {
      // Malformed JSON-LD is common; the AI path still sees the page text.
    }
  }
  return out
}

/** The page's own event image: social card first, then the poster <img>. */
export function pageImage(html: string, baseUrl: string): string | null {
  return (
    resolveImageUrl(
      metaContent(html, 'og:image') ||
        metaContent(html, 'og:image:url') ||
        metaContent(html, 'og:image:secure_url') ||
        metaContent(html, 'twitter:image') ||
        metaContent(html, 'twitter:image:src') ||
        linkImageSrc(html),
      baseUrl,
    ) || firstContentImage(html, baseUrl)
  )
}

export type DistilledPage = {
  title: string | null
  description: string | null
  jsonld: unknown[]
  /** Visible text, whitespace-collapsed, capped. */
  text: string
  imageUrl: string | null
}

/** Reduce raw HTML to the evidence the engine keeps and reasons over. */
export function distillPage(html: string, baseUrl: string, maxText = 20_000): DistilledPage {
  const titleTag = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim() ?? null
  return {
    title: metaContent(html, 'og:title') ?? (titleTag ? decodeEntities(titleTag) : null),
    description: metaContent(html, 'og:description') ?? metaContent(html, 'description'),
    jsonld: parseJsonLdBlocks(html),
    text: visibleText(html).slice(0, maxText),
    imageUrl: pageImage(html, baseUrl),
  }
}
