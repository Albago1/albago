import type { MetadataRoute } from 'next'
import { createClient } from '@/lib/supabase/server'

const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ?? 'https://albago.com'
).replace(/\/$/, '')

const STATIC_ROUTES: Array<{
  path: string
  changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency']
  priority: number
}> = [
  { path: '/', changeFrequency: 'daily', priority: 1.0 },
  { path: '/events', changeFrequency: 'hourly', priority: 0.9 },
  { path: '/protests', changeFrequency: 'hourly', priority: 0.9 },
  { path: '/map', changeFrequency: 'daily', priority: 0.8 },
  { path: '/events/albanian-revolution', changeFrequency: 'daily', priority: 0.8 },
  { path: '/volunteer', changeFrequency: 'weekly', priority: 0.7 },
  { path: '/submit-event', changeFrequency: 'monthly', priority: 0.6 },
  { path: '/become-organizer', changeFrequency: 'monthly', priority: 0.5 },
  { path: '/privacy', changeFrequency: 'yearly', priority: 0.3 },
  { path: '/sign-in', changeFrequency: 'yearly', priority: 0.2 },
  { path: '/sign-up', changeFrequency: 'yearly', priority: 0.2 },
]

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date()

  const staticEntries: MetadataRoute.Sitemap = STATIC_ROUTES.map((route) => ({
    url: `${SITE_URL}${route.path}`,
    lastModified: now,
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }))

  let dynamicEntries: MetadataRoute.Sitemap = []

  try {
    const supabase = await createClient()
    const [eventsRes, placesRes] = await Promise.all([
      supabase
        .from('events')
        .select('slug, date')
        .eq('status', 'published')
        .limit(5000),
      supabase.from('places').select('slug').limit(5000),
    ])

    const eventEntries: MetadataRoute.Sitemap = (eventsRes.data ?? [])
      .filter((row): row is { slug: string; date: string | null } => !!row?.slug)
      .map((row) => ({
        url: `${SITE_URL}/events/${row.slug}`,
        lastModified: row.date ? new Date(`${row.date}T12:00:00`) : now,
        changeFrequency: 'weekly',
        priority: 0.7,
      }))

    const placeEntries: MetadataRoute.Sitemap = (placesRes.data ?? [])
      .filter((row): row is { slug: string } => !!row?.slug)
      .map((row) => ({
        url: `${SITE_URL}/places/${row.slug}`,
        lastModified: now,
        changeFrequency: 'weekly',
        priority: 0.6,
      }))

    dynamicEntries = [...eventEntries, ...placeEntries]
  } catch {
    // If Supabase is unreachable at build time, fall back to static routes only.
  }

  return [...staticEntries, ...dynamicEntries]
}
