import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import {
  ArrowLeft,
  Calendar,
  Clock3,
  ExternalLink,
  Flame,
  MapPin,
  Navigation,
} from 'lucide-react'
import LandingNavbar from '@/components/layout/LandingNavbar'
import { createClient } from '@/lib/supabase/server'
import { getLocationBySlug } from '@/lib/locations'
import { buildDirectionsHref, buildMapHref } from '@/lib/eventLinks'

type Params = { slug: string }

type EventRecord = {
  id: string
  slug: string
  title: string
  description: string | null
  category: string
  date: string
  time: string
  price: string | null
  highlight: boolean | null
  place_id: string | null
  location_slug: string
  places: {
    id: string
    name: string
    address: string | null
    lat: number | null
    lng: number | null
    website_url: string | null
  } | null
}

async function fetchEvent(slug: string): Promise<EventRecord | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('events')
    .select(
      'id, slug, title, description, category, date, time, price, highlight, place_id, location_slug, places ( id, name, address, lat, lng, website_url )'
    )
    .eq('status', 'published')
    .eq('slug', slug)
    .maybeSingle()
  return (data as EventRecord | null) ?? null
}

function getCategoryTone(category?: string) {
  if (!category) return 'bg-white/10 text-white/80'
  const value = category.toLowerCase()
  if (value === 'nightlife') return 'bg-fuchsia-500/20 text-fuchsia-300'
  if (value === 'music') return 'bg-violet-500/20 text-violet-300'
  if (value === 'sports') return 'bg-emerald-500/20 text-emerald-300'
  if (value === 'culture') return 'bg-sky-500/20 text-sky-300'
  if (value === 'food') return 'bg-amber-500/20 text-amber-300'
  return 'bg-white/10 text-white/80'
}

function formatDateLong(dateString: string) {
  const date = new Date(`${dateString}T12:00:00`)
  return date.toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

export async function generateMetadata(
  { params }: { params: Promise<Params> }
): Promise<Metadata> {
  const { slug } = await params
  const event = await fetchEvent(slug)

  if (!event) {
    return { title: 'Event not found — AlbaGo' }
  }

  const description = (event.description ?? '').slice(0, 160)

  return {
    title: `${event.title} — AlbaGo`,
    description,
    openGraph: {
      title: event.title,
      description,
      type: 'article',
    },
  }
}

export default async function EventDetailPage(
  { params }: { params: Promise<Params> }
) {
  const { slug } = await params
  const event = await fetchEvent(slug)

  if (!event) {
    notFound()
  }

  const location = getLocationBySlug(event.location_slug)
  const venue = event.places
  const mapHref = buildMapHref({
    location_slug: event.location_slug,
    place_id: event.place_id,
    date: event.date,
  })
  const directionsHref =
    venue && venue.lat != null && venue.lng != null
      ? buildDirectionsHref(venue.lat, venue.lng)
      : null

  return (
    <main className="min-h-screen bg-[#070b14] text-white">
      <LandingNavbar />

      <section className="relative overflow-hidden px-4 pb-12 pt-32">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute left-1/2 top-20 h-[28rem] w-[28rem] -translate-x-1/2 rounded-full bg-blue-600/10 blur-3xl" />
          <div className="absolute right-[18%] top-28 h-[22rem] w-[22rem] rounded-full bg-violet-600/10 blur-3xl" />
        </div>

        <div className="relative z-10 mx-auto max-w-3xl">
          <Link
            href="/events"
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-medium text-white/75 transition hover:bg-white/[0.08] hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to events
          </Link>

          <div className="mt-6 flex flex-wrap items-center gap-2">
            <span
              className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${getCategoryTone(
                event.category
              )}`}
            >
              {event.category}
            </span>

            {event.highlight && (
              <span className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-black">
                <Flame className="h-3 w-3" />
                Hot
              </span>
            )}

            {event.price && (
              <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-semibold text-white/80">
                {event.price}
              </span>
            )}
          </div>

          <h1 className="mt-5 text-4xl font-bold leading-tight tracking-tight text-white sm:text-5xl">
            {event.title}
          </h1>

          <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-white/65">
            <span className="inline-flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              {formatDateLong(event.date)}
            </span>

            <span className="inline-flex items-center gap-2">
              <Clock3 className="h-4 w-4" />
              {event.time}
            </span>

            <span className="inline-flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              {location.label}, {location.country}
            </span>
          </div>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href={mapHref}
              className="inline-flex items-center gap-2 rounded-full bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-[0_12px_40px_rgba(37,99,235,0.35)] transition hover:bg-blue-500"
            >
              <MapPin className="h-4 w-4" />
              Open in Map
            </Link>

            {directionsHref && (
              <a
                href={directionsHref}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-5 py-3 text-sm font-semibold text-white/85 transition hover:bg-white/[0.08] hover:text-white"
              >
                <Navigation className="h-4 w-4" />
                Get Directions
              </a>
            )}

            {venue?.website_url && (
              <a
                href={venue.website_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-5 py-3 text-sm font-semibold text-white/85 transition hover:bg-white/[0.08] hover:text-white"
              >
                <ExternalLink className="h-4 w-4" />
                Website
              </a>
            )}
          </div>

          {venue && (
            <div className="mt-10 rounded-3xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur-md">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/35">
                Venue
              </p>
              <p className="mt-2 text-lg font-semibold text-white">
                {venue.name}
              </p>
              {venue.address && (
                <p className="mt-1 text-sm text-white/60">{venue.address}</p>
              )}
            </div>
          )}

          {event.description && (
            <div className="mt-8">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/35">
                About this event
              </p>
              <p className="mt-3 whitespace-pre-line text-base leading-7 text-white/75">
                {event.description}
              </p>
            </div>
          )}
        </div>
      </section>
    </main>
  )
}
