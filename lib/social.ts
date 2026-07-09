/**
 * AlbaGo's own social profiles — the single source of truth.
 * Empty string = the platform isn't live yet and its icon stays hidden
 * everywhere (footer, JSON-LD sameAs). Fill in the full profile URL.
 */
export const SOCIAL_LINKS = {
  instagram: 'https://www.instagram.com/albago_org',
  tiktok: 'https://www.tiktok.com/@flas_shqip1',
  facebook: 'https://www.facebook.com/people/AlbaGo/61590611859810/',
} as const

export function activeSocialLinks(): Array<{
  platform: keyof typeof SOCIAL_LINKS
  url: string
}> {
  return (Object.entries(SOCIAL_LINKS) as Array<[keyof typeof SOCIAL_LINKS, string]>)
    .filter(([, url]) => url.trim().length > 0)
    .map(([platform, url]) => ({ platform, url }))
}
