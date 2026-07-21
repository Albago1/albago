import { getLocationBySlug } from '@/lib/locations'

/**
 * Shared label composition for ticket artifacts (PDF + confirmation email,
 * Phase 33) so the two can never drift apart. Server-side artifacts render in
 * English — the platform has no server-side language signal (language lives
 * in localStorage), same limitation as page metadata.
 */

export type TicketEventRow = {
  slug: string
  title: string
  date: string
  end_date: string | null
  time: string | null
  end_time: string | null
  timezone: string | null
  address: string | null
  location_slug: string
  country: string | null
  is_online: boolean | null
  online_url: string | null
  banner_url: string | null
  gallery_urls: string[] | null
  lat: number | null
  lng: number | null
  places: { name: string } | null
}

export function cityLabelFromSlug(locationSlug: string): string {
  const fallback = getLocationBySlug(locationSlug)
  if (fallback.slug === locationSlug) return fallback.label
  return locationSlug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

/** "FRI 11 JUL 2026" */
export function ticketDateLabel(date: string): string {
  return new Date(`${date}T00:00:00`)
    .toLocaleDateString('en-GB', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
    .replace(/,/g, '')
    .toUpperCase()
}

/** "21:00 – 04:00" | "21:00" | null */
export function ticketTimeLabel(
  time: string | null,
  endTime: string | null,
): string | null {
  if (!time) return null
  const start = time.slice(0, 5)
  return endTime ? `${start} – ${endTime.slice(0, 5)}` : start
}

/** "Venue · City, Country" / "City, Country" / "Online event" */
export function ticketVenueLine(ev: TicketEventRow): string {
  if (ev.is_online) return 'Online event'
  const city = cityLabelFromSlug(ev.location_slug)
  const place = [city, ev.country].filter(Boolean).join(', ')
  return ev.places?.name ? `${ev.places.name} · ${place}` : place
}

export function ticketArtUrl(ev: TicketEventRow): string | null {
  return ev.banner_url ?? ev.gallery_urls?.[0] ?? null
}

export const TICKET_EVENT_SELECT =
  'slug, title, date, end_date, time, end_time, timezone, address, location_slug, country, is_online, online_url, banner_url, gallery_urls, lat, lng, places ( name )'
