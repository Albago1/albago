export type LocationOption = {
  label: string
  slug: string
  country: string
  region?: string
  city?: string
  center: [number, number]
  zoom: number
}

export const locations: LocationOption[] = [
  {
    label: 'Tirana',
    slug: 'tirana',
    country: 'Albania',
    city: 'Tirana',
    center: [19.8187, 41.3275],
    zoom: 12.5,
  },
  {
    label: 'Durrës',
    slug: 'durres',
    country: 'Albania',
    city: 'Durrës',
    center: [19.4565, 41.3231],
    zoom: 12.5,
  },
  {
    label: 'Albanian Coast',
    slug: 'albanian-coast',
    country: 'Albania',
    region: 'Coast',
    center: [19.75, 40.25],
    zoom: 7.5,
  },
  {
    label: 'Prishtina',
    slug: 'prishtina',
    country: 'Kosovo',
    city: 'Prishtina',
    center: [21.1655, 42.6629],
    zoom: 12.5,
  },
]

export const defaultLocationSlug = 'tirana'

export function getLocationBySlug(slug?: string | null) {
  return (
    locations.find((location) => location.slug === slug) ??
    locations.find((location) => location.slug === defaultLocationSlug)!
  )
}

function titleizeSlug(slug: string): string {
  return slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

// Fetches the dynamic location list: cities table UNION any distinct
// location_slug used by published events that isn't already a city row.
// This keeps the dropdown in sync even before phase-12 auto-seed runs, and
// it means a freshly approved event in Berlin shows up immediately in the
// location picker without an admin manually adding a cities row.
export async function fetchLocations(): Promise<LocationOption[]> {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (!url || !key) return locations

    const headers = { apikey: key, Authorization: `Bearer ${key}` }

    const [citiesRes, eventsRes] = await Promise.all([
      fetch(
        `${url}/rest/v1/cities?select=slug,name,country,lat,lng,zoom,is_featured&order=is_featured.desc,name.asc`,
        { headers },
      ),
      fetch(
        `${url}/rest/v1/events?select=location_slug,country,lat,lng&status=eq.published&lat=not.is.null&lng=not.is.null`,
        { headers },
      ),
    ])

    const cityRows: Array<{
      slug: string
      name: string
      country: string
      lat: number
      lng: number
      zoom?: number
      is_featured?: boolean
    }> = citiesRes.ok ? await citiesRes.json() : []

    const eventRows: Array<{
      location_slug: string
      country: string
      lat: number
      lng: number
    }> = eventsRes.ok ? await eventsRes.json() : []

    const merged = new Map<string, LocationOption>()

    for (const row of cityRows) {
      merged.set(row.slug, {
        label: row.name,
        slug: row.slug,
        country: row.country,
        center: [row.lng, row.lat] as [number, number],
        zoom: row.zoom ?? 12.5,
      })
    }

    // Fill in any event cities not already represented. Pick the first row
    // we see for each slug as the coordinate anchor.
    for (const row of eventRows) {
      if (!row.location_slug || merged.has(row.location_slug)) continue
      merged.set(row.location_slug, {
        label: titleizeSlug(row.location_slug),
        slug: row.location_slug,
        country: row.country ?? 'Unknown',
        center: [row.lng, row.lat] as [number, number],
        zoom: 12.5,
      })
    }

    if (merged.size === 0) return locations

    return Array.from(merged.values())
  } catch {
    return locations
  }
}
