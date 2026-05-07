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

export async function fetchLocations(): Promise<LocationOption[]> {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (!url || !key) return locations

    const res = await fetch(
      `${url}/rest/v1/cities?select=*&order=is_featured.desc,name.asc`,
      { headers: { apikey: key, Authorization: `Bearer ${key}` } }
    )
    if (!res.ok) return locations

    const data: Array<{
      slug: string
      name: string
      country: string
      lat: number
      lng: number
      zoom?: number
    }> = await res.json()

    return data.map((row) => ({
      label: row.name,
      slug: row.slug,
      country: row.country,
      center: [row.lng, row.lat] as [number, number],
      zoom: row.zoom ?? 12.5,
    }))
  } catch {
    return locations
  }
}