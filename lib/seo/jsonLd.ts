/**
 * JSON-LD schema builders for SEO rich results.
 *
 * Schema.org types we emit:
 *   - WebSite + SearchAction  → site-wide, enables Google sitelinks search box
 *   - Event                   → /events/[slug] rich event cards in Google Search
 *   - Organization            → /organizers/[slug] knowledge panel info
 *   - Place                   → /places/[slug] venue card
 *   - BreadcrumbList          → trail of links above page in search results
 *
 * Each builder returns a plain object that should be serialized via
 * JSON.stringify and emitted inside a <script type="application/ld+json">.
 */

import { zonedWallClockToUtcMs } from '@/lib/timezone'
import { activeSocialLinks } from '@/lib/social'
import {
  schemaOrgEventStatus,
  type EventLifecycleStatus,
} from '@/lib/eventLifecycle'

export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ?? 'https://albago.org'
).replace(/\/$/, '')

export function jsonLdScript(obj: unknown): string {
  // Replace any inline </script> sequence inside string fields to avoid
  // accidentally closing the script tag from inside a JSON string.
  return JSON.stringify(obj).replace(/<\/script>/gi, '<\\/script>')
}

export function websiteSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'AlbaGo',
    alternateName: 'AlbaGo · Events, Movements & Nightlife',
    url: SITE_URL,
    potentialAction: {
      '@type': 'SearchAction',
      target: `${SITE_URL}/events?q={search_term_string}`,
      'query-input': 'required name=search_term_string',
    },
  }
}

export function organizationSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'AlbaGo',
    url: SITE_URL,
    logo: `${SITE_URL}/icon.svg`,
    sameAs: activeSocialLinks().map(({ url }) => url),
  }
}

export type EventForSchema = {
  slug: string
  title: string
  description: string | null
  date: string // YYYY-MM-DD
  time: string // HH:MM or HH:MM:SS
  endTime: string | null
  /** Last day of a multi-day continuous event (YYYY-MM-DD). */
  endDate?: string | null
  timezone: string | null
  locationName: string | null
  address: string | null
  city: string | null
  country: string | null
  lat: number | null
  lng: number | null
  isOnline: boolean | null
  onlineUrl: string | null
  images: string[]
  organizerName: string | null
  organizerUrl: string | null
  isCivic: boolean | null
  category: string | null
  expectedAttendees: number | null
  /** Internal lifecycle status; omitted = EventScheduled. */
  lifecycleStatus?: EventLifecycleStatus
}

function isoForDateTime(
  date: string,
  time: string | null,
  timezone: string | null,
): string {
  if (!time) return date
  const hhmm = time.length >= 5 ? time.slice(0, 5) : time
  if (!timezone) {
    return `${date}T${hhmm}:00`
  }
  const utcMs = zonedWallClockToUtcMs(date, hhmm, timezone)
  return new Date(utcMs).toISOString()
}

export function eventSchema(event: EventForSchema) {
  const startDate = isoForDateTime(event.date, event.time, event.timezone)
  // Multi-day continuous events end on endDate (last day); single-day
  // events with an end_time end the same calendar day.
  const endDay = event.endDate ?? event.date
  const endDate =
    event.endTime || event.endDate
      ? isoForDateTime(endDay, event.endTime, event.timezone)
      : undefined

  const url = `${SITE_URL}/events/${event.slug}`

  const location: Record<string, unknown> = event.isOnline
    ? {
        '@type': 'VirtualLocation',
        url: event.onlineUrl ?? url,
      }
    : {
        '@type': 'Place',
        name: event.locationName ?? event.address ?? event.city ?? 'TBA',
        ...(event.address || event.city || event.country
          ? {
              address: {
                '@type': 'PostalAddress',
                streetAddress: event.address ?? undefined,
                addressLocality: event.city ?? undefined,
                addressCountry: event.country ?? undefined,
              },
            }
          : {}),
        ...(event.lat != null && event.lng != null
          ? {
              geo: {
                '@type': 'GeoCoordinates',
                latitude: event.lat,
                longitude: event.lng,
              },
            }
          : {}),
      }

  const eventAttendanceMode = event.isOnline
    ? 'https://schema.org/OnlineEventAttendanceMode'
    : 'https://schema.org/OfflineEventAttendanceMode'

  return {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: event.title,
    description: (event.description ?? '').slice(0, 5000),
    startDate,
    ...(endDate ? { endDate } : {}),
    eventStatus: schemaOrgEventStatus(
      event.lifecycleStatus ?? 'EventScheduled',
    ),
    eventAttendanceMode,
    location,
    image: event.images.filter(Boolean),
    organizer: event.organizerName
      ? {
          '@type': 'Organization',
          name: event.organizerName,
          ...(event.organizerUrl ? { url: event.organizerUrl } : {}),
        }
      : undefined,
    url,
    inLanguage: 'sq',
    ...(event.isCivic
      ? {
          about: 'Civic gathering, public assembly, peaceful protest',
        }
      : {}),
    ...(event.expectedAttendees && event.expectedAttendees > 0
      ? { maximumAttendeeCapacity: event.expectedAttendees }
      : {}),
  }
}

export type OrganizerForSchema = {
  slug: string
  name: string
  bio: string | null
  website: string | null
  email: string | null
  createdAt: string | null
  verified: boolean
}

export function organizerOrgSchema(org: OrganizerForSchema) {
  const url = `${SITE_URL}/organizers/${org.slug}`
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: org.name,
    description: org.bio ?? undefined,
    url,
    ...(org.website ? { sameAs: [org.website] } : {}),
    ...(org.email ? { email: org.email } : {}),
    ...(org.createdAt ? { foundingDate: org.createdAt.slice(0, 10) } : {}),
  }
}

export type PlaceForSchema = {
  slug: string
  name: string
  address: string | null
  city: string | null
  country: string | null
  lat: number | null
  lng: number | null
  websiteUrl: string | null
}

export function placeSchema(place: PlaceForSchema) {
  const url = `${SITE_URL}/places/${place.slug}`
  return {
    '@context': 'https://schema.org',
    '@type': 'Place',
    name: place.name,
    url,
    ...(place.websiteUrl ? { sameAs: [place.websiteUrl] } : {}),
    ...(place.address || place.city || place.country
      ? {
          address: {
            '@type': 'PostalAddress',
            streetAddress: place.address ?? undefined,
            addressLocality: place.city ?? undefined,
            addressCountry: place.country ?? undefined,
          },
        }
      : {}),
    ...(place.lat != null && place.lng != null
      ? {
          geo: {
            '@type': 'GeoCoordinates',
            latitude: place.lat,
            longitude: place.lng,
          },
        }
      : {}),
  }
}

export function breadcrumbSchema(trail: Array<{ name: string; href: string }>) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: trail.map((step, idx) => ({
      '@type': 'ListItem',
      position: idx + 1,
      name: step.name,
      item: step.href.startsWith('http') ? step.href : `${SITE_URL}${step.href}`,
    })),
  }
}
