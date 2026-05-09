import { isThisWeekend, isToday } from '@/lib/dateFilters'

type MapHrefInput = {
  location_slug: string
  place_id: string | null
  date: string
}

export function buildMapHref(event: MapHrefInput, query?: string) {
  const params = new URLSearchParams()

  params.set('location', event.location_slug)

  if (event.place_id) {
    params.set('place', event.place_id)
  }

  if (query && query.trim()) {
    params.set('q', query.trim())
  }

  if (isToday(event.date)) {
    params.set('time', 'tonight')
  } else if (isThisWeekend(event.date)) {
    params.set('time', 'weekend')
  }

  return `/map?${params.toString()}`
}

export function buildDirectionsHref(lat: number, lng: number) {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`
}
