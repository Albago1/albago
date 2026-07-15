/**
 * Plain link sharing for users without Studio access: OS share sheet where
 * available, clipboard fallback elsewhere. The Studio (templates, reels, AI
 * posters) stays gated behind profiles.studio_access / admin.
 */
export async function shareEventLink(
  title: string,
  url: string,
): Promise<'shared' | 'copied' | 'failed'> {
  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    try {
      await navigator.share({ title, url })
      return 'shared'
    } catch {
      // User dismissed the OS sheet — nothing else to do.
      return 'failed'
    }
  }
  try {
    await navigator.clipboard.writeText(url)
    return 'copied'
  } catch {
    return 'failed'
  }
}
