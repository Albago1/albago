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