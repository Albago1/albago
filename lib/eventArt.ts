/**
 * Public URL of an event's cached AI poster artwork (`ai-posters` bucket,
 * one jpg per event slug — written by /api/ai-poster). The single source for
 * this path; don't hand-build the bucket URL at call sites.
 */
export function aiPosterUrl(slug: string): string {
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/ai-posters/${slug}.jpg`
}
