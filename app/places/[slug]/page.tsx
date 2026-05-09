import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  Calendar,
  Clock3,
  ExternalLink,
  MapPin,
  Navigation,
} from 'lucide-react'
import LandingNavbar from '@/components/layout/LandingNavbar'
import SaveEventButton from '@/components/SaveEventButton'
import { createClient } from '@/lib/supabase/server'
import { getLocationBySlug } from '@/lib/locations'
import { buildDirectionsHref } from '@/lib/eventLinks'
import { getTodayDateString } from '@/lib/dateFilters'

type Params = { slug: string }

type VenueRecord = {
  id: string
  slug: string
  name: string
  category: string
  description: string | null
  address: string | null
  city: string | null
  country: string | null
  lat: number | null
  lng: number | null
  website_url: string | null
  image_url: string | null
  location_slug: string
  verified: boolean | null
  status: string | null
}

type UpcomingEvent = {
  id: string
  slug: string
  title: string
  date: string
  time: string
  category: string
  price: string | null
  highlight: boolean | null
  place_id: string | null
  location_slug: string
}

async function fetchVenue(slug: string): Promise<VenueRecord | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('places')
    .select(
      'id, slug, name, category, description, address, city, country, lat, lng, website_url, image_url, location_slug, verified, status'
    )
    .eq('slug', slug)
    .maybeSingle()
  return (data as VenueRecord | null) ?? null
}

async function fetchUpcomingEvents(venueId: string): Promise<UpcomingEvent[]> {
  const supabase = await createClient()
  const today = getTodayDateString()
  const { data } = await supabase
    .from('events')
    .select(
      'id, slug, title, date, time, category, price, highlight, place_id, location_slug'
    )
    .eq('place_id', venueId)
    .eq('status', 'published')
    .gte('date', today)
    .order('date', { ascending: true })
    .order('time', { ascending: true })
    .limit(30)
  return (data as UpcomingEvent[] | null) ?? []
}

function getCategoryTone(category?: string) {
  if (!category) return 'bg-white/10 text-white/80'
  const value = category.toLowerCase()
  if (value === 'bar') return 'bg-fuchsia-500/20 text-fuchsia-300'
  if (value === 'club') return 'bg-violet-500/20 text-violet-300'
  if (value === 'restaurant') return 'bg-amber-500/20 text-amber-300'
  if (value === 'café' || value === 'cafe') return 'bg-sky-500/20 text-sky-300'
  if (value === 'nightlife') return 'bg-fuchsia-500/20 text-fuchsia-300'
  if (value === 'music') return 'bg-violet-500/20 text-violet-300'
  if (value === 'sports' || value === 'sport') return 'bg-emerald-500/20 text-emerald-300'
  if (value === 'culture') return 'bg-sky-500/20 text-sky-300'
  if (value === 'food') return 'bg-amber-500/20 text-amber-300'
  return 'bg-white/10 text-white/80'
}

function getEventCategoryTone(category?: string) {
  if (!category) return 'bg-white/10 text-white/80'
  const value = category.toLowerCase()
  if (value === 'nightlife') return 'bg-fuchsia-500/20 text-fuchsia-300'
  if (value === 'music') return 'bg-violet-500/20 text-violet-300'
  if (value === 'sports') return 'bg-emerald-500/20 text-emerald-300'
  if (value === 'culture') return 'bg-sky-500/20 text-sky-300'
  if (value === 'food') return 'bg-amber-500/20 text-amber-300'
  return 'bg-white/10 text-white/80'
}

function formatEventDate(dateString: string) {
  const date = new Date(`${dateString}T12:00:00`)
  return date.toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })
}

export async function generateMetadata(
  { params }: { params: Promise<Params> }
): Promise<Metadata> {
  const { slug } = await params
  const venue = await fetchVenue(slug)

  if (!venue) {
    return { title: 'Venue not found — AlbaGo' }
  }

  const fallback =
    venue.city != null
      ? `${venue.category} in ${venue.city}`
      : `${venue.category} on AlbaGo`
  const description = (venue.description ?? fallback).slice(0, 160)

  return {
    title: `${venue.name} — AlbaGo`,
    description,
    openGraph: {
      title: venue.name,
      description,
      type: 'profile',
    },
  }
}

export default async function VenueDetailPage(
  { params }: { params: Promise<Params> }
) {
  const { slug } = await params
  const venue = await fetchVenue(slug)

  if (!venue) {
    notFound()
  }

  const location = getLocationBySlug(venue.location_slug)
  const upcomingEvents = await fetchUpcomingEvents(venue.id)
  const directionsHref =
    venue.lat != null && venue.lng != null
      ? buildDirectionsHref(venue.lat, venue.lng)
      : null

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  let savedIds = new Set<string>()
  if (user && upcomingEvents.length > 0) {
    const { data: savedRows } = await supabase
      .from('saved_events')
      .select('event_id')
      .eq('user_id', user.id)
      .in('event_id', upcomingEvents.map((e) => e.id))
    savedIds = new Set((savedRows ?? []).map((r) => r.event_id))
  }

  const cityLine = [venue.address, venue.city ?? location.label].filter(Boolean).join(' · ')

  return (
    <main className="min-h-screen bg-[#070b14] text-white">
      <LandingNavbar />

      <section className="relative overflow-hidden px-4 pb-12 pt-32">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute left-1/2 top-20 h-[28rem] w-[28rem] -translate-x-1/2 rounded-full bg-violet-600/10 blur-3xl" />
          <div className="absolute right-[18%] top-28 h-[22rem] w-[22rem] rounded-full bg-blue-600/10 blur-3xl" />
        </div>

        <div className="relative z-10 mx-auto max-w-3xl">
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-medium text-white/75 transition hover:bg-white/[0.08] hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Link>

          <div className="mt-6 flex flex-wrap items-center gap-2">
            <span
              className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${getCategoryTone(
                venue.category
              )}`}
            >
              {venue.category}
            </span>

            {venue.verified && (
              <span className="inline-flex items-center gap-1 rounded-full border border-blue-500/20 bg-blue-500/10 px-3 py-1 text-xs font-semibold text-blue-300">
                <BadgeCheck className="h-3.5 w-3.5" />
                Verified
              </span>
            )}
          </div>

          <h1 className="mt-5 text-4xl font-bold leading-tight tracking-tight text-white sm:text-5xl">
            {venue.name}
          </h1>

          {cityLine && (
            <p className="mt-4 inline-flex items-center gap-2 text-sm text-white/65">
              <MapPin className="h-4 w-4" />
              {cityLine}
            </p>
          )}

          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href={`/map?place=${venue.id}`}
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

            {venue.website_url && (
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

          {venue.description && (
            <div className="mt-10">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/35">
                About this venue
              </p>
              <p className="mt-3 whitespace-pre-line text-base leading-7 text-white/75">
                {venue.description}
              </p>
            </div>
          )}

          <div className="mt-10">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/35">
              Upcoming events
            </p>

            {upcomingEvents.length === 0 ? (
              <div className="mt-3 rounded-3xl border border-dashed border-white/10 bg-white/[0.02] p-6 text-center">
                <p className="font-semibold text-white">No upcoming events scheduled yet</p>
                <p className="mt-1 text-sm text-white/55">
                  Check back later, or browse all events.
                </p>
                <Link
                  href="/events"
                  className="mt-4 inline-flex items-center gap-2 rounded-full bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-500"
                >
                  Browse events
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            ) : (
              <div className="mt-3 grid gap-4 md:grid-cols-2">
                {upcomingEvents.map((event) => (
                  <Link
                    key={event.id}
                    href={`/events/${event.slug}`}
                    className="group block rounded-3xl border border-white/10 bg-white/[0.03] p-5 transition hover:border-white/15 hover:bg-white/[0.05]"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-semibold ${getEventCategoryTone(
                            event.category
                          )}`}
                        >
                          {event.category}
                        </span>
                        {event.price && (
                          <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-semibold text-white/80">
                            {event.price}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        {event.highlight && (
                          <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-black">
                            Hot
                          </span>
                        )}

                        <SaveEventButton
                          eventId={event.id}
                          initialSaved={savedIds.has(event.id)}
                          isAuthenticated={!!user}
                        />
                      </div>
                    </div>

                    <h3 className="mt-3 text-lg font-semibold leading-tight text-white">
                      {event.title}
                    </h3>

                    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-white/60">
                      <span className="inline-flex items-center gap-2">
                        <Calendar className="h-4 w-4" />
                        {formatEventDate(event.date)}
                      </span>
                      <span className="inline-flex items-center gap-2">
                        <Clock3 className="h-4 w-4" />
                        {event.time}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>
    </main>
  )
}
