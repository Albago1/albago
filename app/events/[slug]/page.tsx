import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import {
  ArrowLeft,
  Calendar,
  Clock3,
  ExternalLink,
  Flame,
  Globe2,
  Mail,
  MapPin,
  MessageCircle,
  Navigation,
  Phone,
  Repeat,
  Send,
  ShieldAlert,
  User2,
  Users,
} from 'lucide-react'
import LandingNavbar from '@/components/layout/LandingNavbar'
import SaveEventButton from '@/components/SaveEventButton'
import { createClient } from '@/lib/supabase/server'
import { getLocationBySlug } from '@/lib/locations'
import { buildDirectionsHref, buildMapHref } from '@/lib/eventLinks'
import {
  isRecurring,
  recurrenceLabel,
  upcomingOccurrences,
} from '@/lib/recurrence'

type Params = { slug: string }

type OrganizerSocials = {
  instagram?: string
  facebook?: string
  tiktok?: string
  twitter?: string
}

type EventRecord = {
  id: string
  slug: string
  title: string
  description: string | null
  category: string
  date: string
  time: string
  end_time: string | null
  timezone: string | null
  price: string | null
  highlight: boolean | null
  place_id: string | null
  location_slug: string
  country: string | null
  lat: number | null
  lng: number | null
  address: string | null
  is_online: boolean | null
  online_url: string | null
  tags: string[] | null
  language: string | null
  banner_url: string | null
  is_civic: boolean | null
  event_type: string | null
  featured_movement_slug: string | null
  organizer_contact: string | null
  organizer_name: string | null
  organizer_phone: string | null
  organizer_website: string | null
  organizer_socials: OrganizerSocials | null
  telegram_link: string | null
  whatsapp_link: string | null
  safety_notes: string | null
  expected_attendees: number | null
  recurrence: string | null
  recurrence_until: string | null
  recurrence_days_of_week: number[] | null
  recurrence_exceptions: string[] | null
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
      'id, slug, title, description, category, date, time, end_time, timezone, price, highlight, place_id, location_slug, country, lat, lng, address, is_online, online_url, tags, language, banner_url, is_civic, event_type, featured_movement_slug, organizer_contact, organizer_name, organizer_phone, organizer_website, organizer_socials, telegram_link, whatsapp_link, safety_notes, expected_attendees, recurrence, recurrence_until, recurrence_days_of_week, recurrence_exceptions, places ( id, name, address, lat, lng, website_url )'
    )
    .eq('status', 'published')
    .eq('slug', slug)
    .maybeSingle()
  return (data as EventRecord | null) ?? null
}

function formatTimeRange(time: string | null, endTime: string | null, tz: string | null): string {
  if (!time) return ''
  const range = endTime ? `${time} → ${endTime}` : time
  if (tz && tz !== 'Europe/Tirane') {
    const short = tz.split('/').pop() ?? tz
    return `${range} (${short})`
  }
  return range
}

function socialHref(platform: string, value: string): string {
  const handle = value.replace(/^@+/, '').trim()
  if (/^https?:\/\//i.test(handle)) return handle
  switch (platform) {
    case 'instagram':
      return `https://instagram.com/${handle}`
    case 'facebook':
      return handle.includes('/') ? `https://${handle}` : `https://facebook.com/${handle}`
    case 'tiktok':
      return `https://tiktok.com/@${handle}`
    case 'twitter':
      return `https://x.com/${handle}`
    default:
      return handle
  }
}

function socialLabel(platform: string): string {
  return platform.charAt(0).toUpperCase() + platform.slice(1)
}

function getCategoryTone(category?: string) {
  if (!category) return 'bg-white/10 text-white/80'
  const value = category.toLowerCase()
  if (value === 'nightlife') return 'bg-fuchsia-500/20 text-fuchsia-300'
  if (value === 'music') return 'bg-violet-500/20 text-violet-300'
  if (value === 'sports') return 'bg-emerald-500/20 text-emerald-300'
  if (value === 'culture') return 'bg-sky-500/20 text-sky-300'
  if (value === 'food') return 'bg-amber-500/20 text-amber-300'
  if (value === 'civic') return 'bg-flame-500/15 text-flame-300 ring-1 ring-flame-500/40'
  return 'bg-white/10 text-white/80'
}

function formatAttendees(count: number) {
  if (count >= 1000) {
    const k = count / 1000
    const formatted = k >= 10 ? Math.round(k).toString() : k.toFixed(1).replace(/\.0$/, '')
    return `${formatted}k`
  }
  return count.toLocaleString('en-US')
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

function UpcomingOccurrencesList({ event }: { event: EventRecord }) {
  const dates = upcomingOccurrences(
    {
      date: event.date,
      time: event.time,
      recurrence: event.recurrence,
      recurrence_until: event.recurrence_until,
      recurrence_days_of_week: event.recurrence_days_of_week,
      recurrence_exceptions: event.recurrence_exceptions,
    },
    5,
  )
  if (dates.length === 0) {
    return (
      <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white/55">
        No upcoming dates — the series has ended.
      </div>
    )
  }
  return (
    <div className="mt-4 inline-flex flex-wrap items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2">
      <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/45">
        Upcoming
      </span>
      {dates.map((iso) => (
        <span
          key={iso}
          className="rounded-full bg-white/[0.06] px-2.5 py-1 text-xs font-medium text-white/80"
        >
          {formatDateLong(iso).replace(/, \d{4}$/, '')}
        </span>
      ))}
    </div>
  )
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

  // Prefer the event's own location_slug + country (they always describe the
  // actual city, even when it isn't in the hardcoded locations list).
  // getLocationBySlug() only knows the 4 hardcoded cities and silently
  // returns Tirana for everything else, which was misrendering as the venue
  // line label.
  const fallbackLocation = getLocationBySlug(event.location_slug)
  const cityLabel =
    fallbackLocation.slug === event.location_slug
      ? fallbackLocation.label
      : event.location_slug
          .replace(/-/g, ' ')
          .replace(/\b\w/g, (c) => c.toUpperCase())
  const countryLabel = event.country || fallbackLocation.country
  const venue = event.places
  const isCivic = !!event.is_civic
  const mapHref = buildMapHref({
    location_slug: event.location_slug,
    place_id: event.place_id,
    date: event.date,
  })
  const directionsLat = venue?.lat ?? event.lat ?? null
  const directionsLng = venue?.lng ?? event.lng ?? null
  const directionsHref =
    directionsLat != null && directionsLng != null
      ? buildDirectionsHref(directionsLat, directionsLng)
      : null
  const hasCoordination =
    isCivic &&
    (event.telegram_link || event.whatsapp_link || event.organizer_contact)

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  let initialSaved = false
  if (user) {
    const { data: savedRow } = await supabase
      .from('saved_events')
      .select('id')
      .eq('user_id', user.id)
      .eq('event_id', event.id)
      .maybeSingle()
    initialSaved = !!savedRow
  }

  return (
    <main className="min-h-screen bg-ink-950 text-white">
      <LandingNavbar />

      <section className="relative overflow-hidden px-4 pb-12 pt-32">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute inset-0 bg-grid opacity-40" />
          <div className="absolute inset-0 bg-radial-flame" />
          <div className="absolute left-1/2 top-20 h-[28rem] w-[28rem] -translate-x-1/2 rounded-full bg-flame-500/15 blur-3xl" />
          <div className="absolute right-[18%] top-28 h-[22rem] w-[22rem] rounded-full bg-flame-500/10 blur-3xl" />
        </div>

        <div className="relative z-10 mx-auto max-w-3xl">
          <Link
            href={isCivic ? '/protests' : '/events'}
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-medium text-white/75 transition hover:bg-white/[0.08] hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            {isCivic ? 'Back to protests' : 'Back to events'}
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

          <h1 className="display-text mt-5 text-5xl sm:text-7xl leading-[0.95] tracking-tight">
            {event.title}
          </h1>

          <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-white/65">
            <span className="inline-flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              {isRecurring(event)
                ? `Starts ${formatDateLong(event.date)}`
                : formatDateLong(event.date)}
            </span>

            <span className="inline-flex items-center gap-2">
              <Clock3 className="h-4 w-4" />
              {formatTimeRange(event.time, event.end_time, event.timezone)}
            </span>

            {isRecurring(event) && (
              <span className="inline-flex items-center gap-2 text-flame-300">
                <Repeat className="h-4 w-4" />
                {recurrenceLabel(event)}
              </span>
            )}

            <span className="inline-flex items-center gap-2">
              {event.is_online ? (
                <>
                  <Globe2 className="h-4 w-4 text-emerald-300" />
                  Online
                </>
              ) : (
                <>
                  <MapPin className="h-4 w-4" />
                  {event.address || `${cityLabel}${countryLabel ? `, ${countryLabel}` : ''}`}
                </>
              )}
            </span>
          </div>

          {isRecurring(event) && (
            <UpcomingOccurrencesList event={event} />
          )}

          {event.tags && event.tags.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-1.5">
              {event.tags.map((t) => (
                <span
                  key={t}
                  className="rounded-full border border-flame-500/30 bg-flame-500/[0.08] px-2.5 py-1 text-xs text-flame-100"
                >
                  {t}
                </span>
              ))}
            </div>
          )}

          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href={mapHref}
              className="inline-flex items-center gap-2 rounded-full bg-flame-500 px-5 py-3 text-sm font-semibold text-white shadow-glow-flame transition hover:bg-flame-400 hover:-translate-y-0.5"
            >
              <MapPin className="h-4 w-4" />
              Open in Map
            </Link>

            <SaveEventButton
              eventId={event.id}
              initialSaved={initialSaved}
              isAuthenticated={!!user}
              size="md"
            />

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

            {event.is_online && event.online_url && (
              <a
                href={event.online_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-5 py-3 text-sm font-semibold text-emerald-100 transition hover:bg-emerald-500/20"
              >
                <Globe2 className="h-4 w-4" />
                Join online
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

          {event.banner_url && (
            <div className="mt-10 overflow-hidden rounded-3xl border border-white/10">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={event.banner_url}
                alt={event.title}
                className="aspect-[16/9] w-full object-cover"
              />
            </div>
          )}

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

          {isCivic && event.expected_attendees != null && (
            <div className="mt-10 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="rounded-3xl border border-flame-500/30 bg-flame-500/[0.06] p-6 backdrop-blur-md">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-flame-300/80">
                  Expected attendees
                </p>
                <p className="mt-2 inline-flex items-baseline gap-2 text-3xl font-semibold text-white">
                  <Users className="h-5 w-5 text-flame-400" />
                  {formatAttendees(event.expected_attendees)}
                </p>
                <p className="mt-1 text-xs text-white/55">
                  Projected turnout in {cityLabel}.
                </p>
              </div>
            </div>
          )}

          {hasCoordination && (
            <div className="mt-8 rounded-3xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur-md">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/35">
                Coordination
              </p>
              <p className="mt-2 text-sm text-white/60">
                Live channels and organizer contact for this gathering.
              </p>
              <div className="mt-5 flex flex-wrap gap-3">
                {event.telegram_link && (
                  <a
                    href={event.telegram_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-full border border-flame-500/30 bg-flame-500/10 px-4 py-2 text-sm font-semibold text-flame-100 transition hover:bg-flame-500/20"
                  >
                    <Send className="h-4 w-4" />
                    Telegram
                  </a>
                )}
                {event.whatsapp_link && (
                  <a
                    href={event.whatsapp_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-100 transition hover:bg-emerald-500/20"
                  >
                    <MessageCircle className="h-4 w-4" />
                    WhatsApp
                  </a>
                )}
                {event.organizer_contact && (
                  <a
                    href={
                      event.organizer_contact.includes('@')
                        ? `mailto:${event.organizer_contact}`
                        : event.organizer_contact
                    }
                    className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-semibold text-white/85 transition hover:bg-white/[0.08] hover:text-white"
                  >
                    <Mail className="h-4 w-4" />
                    {event.organizer_contact}
                  </a>
                )}
              </div>
            </div>
          )}

          {isCivic && event.safety_notes && (
            <div className="mt-8 rounded-3xl border border-flame-500/30 bg-flame-500/[0.06] p-6 backdrop-blur-md">
              <div className="flex items-start gap-3">
                <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-flame-400" />
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-flame-300/80">
                    Safety & legality
                  </p>
                  <p className="mt-2 whitespace-pre-line text-sm leading-6 text-white/80">
                    {event.safety_notes}
                  </p>
                </div>
              </div>
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

          {(event.organizer_name ||
            event.organizer_phone ||
            event.organizer_website ||
            event.organizer_socials) && (
            <div className="mt-10 rounded-3xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur-md">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/35">
                Organizer
              </p>
              {event.organizer_name && (
                <p className="mt-2 inline-flex items-center gap-2 text-lg font-semibold text-white">
                  <User2 className="h-4 w-4 text-flame-300" />
                  {event.organizer_name}
                </p>
              )}
              <div className="mt-4 flex flex-wrap gap-3">
                {event.organizer_phone && (
                  <a
                    href={`tel:${event.organizer_phone}`}
                    className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-semibold text-white/85 transition hover:bg-white/[0.08] hover:text-white"
                  >
                    <Phone className="h-3.5 w-3.5" />
                    {event.organizer_phone}
                  </a>
                )}
                {event.organizer_website && (
                  <a
                    href={event.organizer_website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-semibold text-white/85 transition hover:bg-white/[0.08] hover:text-white"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    Website
                  </a>
                )}
                {event.organizer_socials &&
                  Object.entries(event.organizer_socials)
                    .filter(([, v]) => v && String(v).trim())
                    .map(([platform, handle]) => (
                      <a
                        key={platform}
                        href={socialHref(platform, handle as string)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-semibold text-white/85 transition hover:bg-white/[0.08] hover:text-white"
                      >
                        {socialLabel(platform)}
                      </a>
                    ))}
              </div>
            </div>
          )}
        </div>
      </section>
    </main>
  )
}
