import Link from 'next/link'
import Image from 'next/image'
import { Suspense } from 'react'
import { notFound, redirect } from 'next/navigation'
import type { Metadata } from 'next'
import {
  ArrowLeft,
  BadgeCheck,
  CalendarX2,
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
  Sparkles,
  Ticket,
  Users,
} from 'lucide-react'
import LandingNavbar from '@/components/layout/LandingNavbar'
import TrackView from '@/components/TrackView'
import SaveEventButton from '@/components/SaveEventButton'
import ReportEventButton from '@/components/ReportEventButton'
import MapPickerButton from '@/components/MapPickerButton'
import EventGallery from '@/components/EventGallery'
import LocalizedEventText from '@/components/events/LocalizedEventText'
import EventWeatherCard from '@/components/events/EventWeatherCard'
import TierPicker, { type TierView } from '@/components/events/TierPicker'
import ShareEventButton from '@/components/share/ShareEventButton'
import type { ShareEventData } from '@/lib/share/types'
import { createClient } from '@/lib/supabase/server'
import { getLocationBySlug } from '@/lib/locations'
import { formatPriceFrom, safeExternalUrl } from '@/lib/ticketDisplay'
import {
  buildDirectionsHref,
  buildLocationViewHref,
  buildMapHref,
} from '@/lib/eventLinks'
import {
  durationDaysLabel,
  isMultiDay,
  isRecurring,
  multiDayDurationDays,
  nextOccurrence,
  recurrenceLabel,
  upcomingOccurrences,
} from '@/lib/recurrence'
import { activeEventsOrFilter, isEventActive } from '@/lib/eventActive'
import {
  endedOnIso,
  getEventLifecycleStatus,
  isEventEnded,
} from '@/lib/eventLifecycle'
import { getEventTimezone } from '@/lib/timezone'
import { eventSchema, jsonLdScript, type EventForSchema } from '@/lib/seo/jsonLd'

type Params = { slug: string }

// Slugs whose event row exists for catalog/list/map presence, but whose
// canonical detail page is a curated route elsewhere on the site.
const CURATED_REDIRECTS: Record<string, string> = {
  'edi-rama-berlin-2026': '/protests/edi-rama-berlin-2026',
}

type OrganizerSocials = {
  instagram?: string
  facebook?: string
  tiktok?: string
  twitter?: string
}

type EventRecord = {
  id: string
  slug: string
  status: string
  title: string
  title_i18n: Record<string, string> | null
  description: string | null
  description_i18n: Record<string, string> | null
  category: string
  date: string
  end_date: string | null
  time: string
  end_time: string | null
  timezone: string | null
  price: string | null
  ticket_url: string | null
  ticket_provider: string | null
  price_from_cents: number | null
  price_currency: string | null
  ticket_sales_status: string | null
  door_tickets: boolean | null
  age_restriction: string | null
  official_source_url: string | null
  last_verified_at: string | null
  listing_status: string | null
  doors_time: string | null
  practical_info: Record<string, string> | null
  highlight: boolean | null
  place_id: string | null
  location_slug: string
  country: string | null
  lat: number | null
  lng: number | null
  address: string | null
  address_hint: string | null
  is_online: boolean | null
  online_url: string | null
  tags: string[] | null
  language: string | null
  banner_url: string | null
  gallery_urls: string[] | null
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
  organizers: {
    id: string
    slug: string
    verification_tier: 'unverified' | 'established' | 'verified'
    created_at: string
    bio: string | null
  } | null
}

type OrganizerTrustStats = {
  totalPublished: number
  upcoming: number
}

async function fetchOrganizerTrustStats(
  organizerId: string,
): Promise<OrganizerTrustStats> {
  const supabase = await createClient()
  const [totalRes, upcomingRes] = await Promise.all([
    supabase
      .from('events')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'published')
      .eq('organizer_id', organizerId),
    supabase
      .from('events')
      .select(
        'id, date, time, end_time, recurrence, recurrence_until, recurrence_days_of_week, recurrence_exceptions',
      )
      .eq('status', 'published')
      .eq('organizer_id', organizerId)
      .or(activeEventsOrFilter()),
  ])
  const upcoming = (upcomingRes.data ?? []).filter(isEventActive).length
  return { totalPublished: totalRes.count ?? 0, upcoming }
}

type OrganizerUpcomingEvent = {
  id: string
  slug: string
  title: string
  category: string
  date: string
  time: string
  end_time: string | null
  location_slug: string
  recurrence: string | null
  recurrence_until: string | null
  recurrence_days_of_week: number[] | null
  recurrence_exceptions: string[] | null
}

// Shown on ended event pages so the dead end still routes visitors somewhere
// alive — the organizer's next gigs.
async function fetchOrganizerUpcomingEvents(
  organizerId: string,
  excludeEventId: string,
): Promise<OrganizerUpcomingEvent[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('events')
    .select(
      'id, slug, title, category, date, time, end_time, location_slug, recurrence, recurrence_until, recurrence_days_of_week, recurrence_exceptions',
    )
    .eq('status', 'published')
    .eq('organizer_id', organizerId)
    .neq('id', excludeEventId)
    .or(activeEventsOrFilter())
    .order('date', { ascending: true })
    .limit(8)
  return ((data as OrganizerUpcomingEvent[] | null) ?? [])
    .filter(isEventActive)
    .slice(0, 4)
}

function formatJoinedShort(ts: string): string {
  const d = new Date(ts)
  return d.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })
}

async function fetchEvent(slug: string): Promise<EventRecord | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('events')
    .select(
      'id, slug, status, title, title_i18n, description, description_i18n, category, date, end_date, time, end_time, timezone, price, ticket_url, ticket_provider, price_from_cents, price_currency, ticket_sales_status, door_tickets, age_restriction, official_source_url, last_verified_at, listing_status, doors_time, practical_info, highlight, place_id, location_slug, country, lat, lng, address, address_hint, is_online, online_url, tags, language, banner_url, gallery_urls, is_civic, event_type, featured_movement_slug, organizer_contact, organizer_name, organizer_phone, organizer_website, organizer_socials, telegram_link, whatsapp_link, safety_notes, expected_attendees, recurrence, recurrence_until, recurrence_days_of_week, recurrence_exceptions, places ( id, name, address, lat, lng, website_url ), organizers ( id, slug, verification_tier, created_at, bio )'
    )
    .eq('status', 'published')
    .eq('slug', slug)
    .maybeSingle()
  return (data as EventRecord | null) ?? null
}

// Native free-ticket tiers (TIX-1). Anon RLS already scopes the read to
// public tiers of published events; price_cents = 0 keeps future paid tiers
// out of the free picker until PAY ships. Availability is the computed
// tier_available RPC — never a stored count.
async function fetchTicketTiers(eventId: string): Promise<TierView[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('ticket_tiers')
    .select(
      'id, name, description, capacity, max_per_order, sales_start, sales_end',
    )
    .eq('event_id', eventId)
    .eq('status', 'active')
    .eq('price_cents', 0)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })
  const rows = (data ?? []) as Array<{
    id: string
    name: string
    description: string | null
    capacity: number
    max_per_order: number
    sales_start: string | null
    sales_end: string | null
  }>
  if (rows.length === 0) return []
  const availability = await Promise.all(
    rows.map((row) => supabase.rpc('tier_available', { p_tier_id: row.id })),
  )
  return rows.map((row, index) => ({
    id: row.id,
    name: row.name,
    description: row.description,
    capacity: row.capacity,
    maxPerOrder: row.max_per_order,
    available:
      typeof availability[index].data === 'number' ? availability[index].data : 0,
    salesStart: row.sales_start,
    salesEnd: row.sales_end,
  }))
}

// "Good to know" keys recognised inside events.practical_info (jsonb).
// Only populated keys render; the order here is the display order.
const PRACTICAL_LABELS: Array<[string, string]> = [
  ['meeting_point', 'Meeting point'],
  ['route', 'Route'],
  ['registration', 'Registration'],
  ['audience', 'Audience'],
  ['dress_code', 'Dress code'],
  ['accessibility', 'Accessibility'],
  ['transport', 'Public transport'],
  ['parking', 'Parking'],
  ['food_drink', 'Food & drink'],
  ['indoor_outdoor', 'Indoor / outdoor'],
  ['restrictions', 'Restrictions'],
  ['cancellation_policy', 'Cancellation policy'],
]

// Monogram avatar fallback until organizers get a real logo_url column
// (schema-reference Future Reserved).
function organizerInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return '?'
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase()
  return (words[0][0] + words[1][0]).toUpperCase()
}

function formatTimeRange(time: string | null, endTime: string | null): string {
  if (!time) return ''
  const start = time.length >= 5 ? time.slice(0, 5) : time
  const end = endTime && endTime.length >= 5 ? endTime.slice(0, 5) : endTime
  return end ? `${start} → ${end}` : start
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

// DICE-style kicker: "FRI 11 JUL · 21:00 — 04:00"
function formatKicker(event: EventRecord): string {
  const d = new Date(`${event.date}T12:00:00`)
  const day = d.toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })
  const time = formatTimeRange(event.time, event.end_time)
  return [day, time].filter(Boolean).join(' · ')
}

function DateTile({ iso }: { iso: string }) {
  const d = new Date(`${iso}T12:00:00`)
  return (
    <div className="flex w-[76px] shrink-0 flex-col items-center rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2.5">
      <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-flame-300">
        {d.toLocaleDateString('en-GB', { month: 'short' })}
      </span>
      <span className="font-display text-3xl leading-none text-white">{d.getDate()}</span>
      <span className="mt-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/50">
        {d.toLocaleDateString('en-GB', { weekday: 'short' })}
      </span>
    </div>
  )
}

// Cached AI poster art (generated by the share flow) doubles as the hero
// backdrop for events without photos. HEAD-only, tight timeout — the page
// must never wait on it.
async function fetchAiPosterUrl(slug: string): Promise<string | null> {
  try {
    const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/ai-posters/${slug}.jpg`
    const res = await fetch(url, {
      method: 'HEAD',
      cache: 'no-store',
      signal: AbortSignal.timeout(1500),
    })
    return res.ok ? url : null
  } catch {
    return null
  }
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
  if (CURATED_REDIRECTS[slug]) {
    return { title: 'Redirecting — AlbaGo' }
  }
  const event = await fetchEvent(slug)

  if (!event) {
    return { title: 'Event not found — AlbaGo' }
  }

  const description = (event.description ?? '').slice(0, 160)
  const ogImages = [
    ...(event.gallery_urls ?? []),
    ...(event.banner_url ? [event.banner_url] : []),
  ].filter((url, idx, arr) => !!url && arr.indexOf(url) === idx)

  return {
    title: `${event.title} — AlbaGo`,
    description,
    openGraph: {
      title: event.title,
      description,
      type: 'article',
      ...(ogImages.length > 0 ? { images: ogImages.slice(0, 4) } : {}),
    },
    twitter: {
      card: ogImages.length > 0 ? 'summary_large_image' : 'summary',
      title: event.title,
      description,
      ...(ogImages.length > 0 ? { images: [ogImages[0]] } : {}),
    },
  }
}

export default async function EventDetailPage(
  { params }: { params: Promise<Params> }
) {
  const { slug } = await params

  const curated = CURATED_REDIRECTS[slug]
  if (curated) {
    redirect(curated)
  }

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

  const lifecycleStatus = getEventLifecycleStatus(event)
  const hasEnded = isEventEnded(lifecycleStatus)
  // What "similar" means here: same category, same city, still upcoming.
  const similarEventsHref = isCivic
    ? '/protests'
    : `/events?category=${encodeURIComponent(event.category)}&location=${encodeURIComponent(event.location_slug)}`

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

  // Native free-ticket tiers (TIX-1) supersede the external ticket link and
  // the static price row whenever they exist — never both CTAs. Civic events
  // never get tiers (schema guard) but we don't even fetch for them.
  const ticketTiers =
    !isCivic && !hasEnded && event.listing_status !== 'cancelled'
      ? await fetchTicketTiers(event.id)
      : []
  const hasNativeTickets = ticketTiers.length > 0

  // External ticketing (structured fields on events). Native tiers from the
  // TIX track supersede these per-event. Civic events never show commerce
  // vocabulary — bible pledge.
  const soldOut = event.ticket_sales_status === 'sold_out'
  const ticketUrl =
    !isCivic && !hasEnded && !soldOut && !hasNativeTickets
      ? safeExternalUrl(event.ticket_url)
      : null
  const priceFromLabel =
    !isCivic && event.price_from_cents != null
      ? event.price_from_cents === 0
        ? 'Free'
        : `From ${formatPriceFrom(event.price_from_cents, event.price_currency)}`
      : null
  const ticketMeta = [
    soldOut ? 'Sold out' : null,
    event.door_tickets ? 'Tickets at the door' : null,
    event.age_restriction,
    ticketUrl && event.ticket_provider ? `via ${event.ticket_provider}` : null,
  ]
    .filter(Boolean)
    .join(' · ')

  // Civic events lead with the official source (audit §10/§14) — the one
  // field that answers "is this real?".
  const officialUrl =
    isCivic && !hasEnded ? safeExternalUrl(event.official_source_url) : null
  const practicalEntries = PRACTICAL_LABELS.flatMap(([key, label]) => {
    const value = event.practical_info?.[key]
    return typeof value === 'string' && value.trim()
      ? [{ key, label, value }]
      : []
  })

  const registeredOrganizer = event.organizers
  const [trustStats, organizerUpcoming]: [
    OrganizerTrustStats | null,
    OrganizerUpcomingEvent[],
  ] = registeredOrganizer
    ? await Promise.all([
        fetchOrganizerTrustStats(registeredOrganizer.id),
        hasEnded
          ? fetchOrganizerUpcomingEvents(registeredOrganizer.id, event.id)
          : Promise.resolve([] as OrganizerUpcomingEvent[]),
      ])
    : [null, [] as OrganizerUpcomingEvent[]]

  const shareData: ShareEventData = {
    title: event.title,
    slug: event.slug,
    category: event.category,
    city: cityLabel,
    country: countryLabel ?? null,
    address: event.address ?? venue?.address ?? null,
    date: event.date,
    endDate: event.end_date,
    time: event.time,
    endTime: event.end_time,
    organizerName: event.organizer_name,
    isCivic,
    eventUrl: `https://albago.org/events/${event.slug}`,
    imageUrl: event.banner_url ?? event.gallery_urls?.[0] ?? null,
  }

  const eventImages = [
    ...(event.gallery_urls ?? []),
    ...(event.banner_url ? [event.banner_url] : []),
  ].filter((url, idx, arr) => !!url && arr.indexOf(url) === idx)

  // Hero backdrop ladder: real event photo → cached AI poster art → brand gradient.
  const heroImage =
    eventImages[0] ?? (await fetchAiPosterUrl(event.slug)) ?? null

  const schemaEvent: EventForSchema = {
    slug: event.slug,
    title: event.title,
    description: event.description,
    date: event.date,
    time: event.time,
    endTime: event.end_time,
    endDate: event.end_date,
    // Always derive timezone from location, not from event.timezone — many
    // legacy rows have a stale 'Europe/Tirane' default that misrepresents
    // non-Albanian events. getEventTimezone(slug, country) is the canonical
    // source of truth across the rest of the codebase (LiveProtestsBanner,
    // protests page, movement pages).
    timezone: getEventTimezone(event.location_slug, event.country),
    locationName: venue?.name ?? event.address ?? null,
    address: event.address ?? venue?.address ?? null,
    city: cityLabel,
    country: countryLabel ?? null,
    lat: directionsLat,
    lng: directionsLng,
    isOnline: event.is_online ?? false,
    onlineUrl: event.online_url,
    images: eventImages,
    organizerName: event.organizer_name,
    organizerUrl: event.organizers
      ? `https://albago.org/organizers/${event.organizers.slug}`
      : event.organizer_website,
    isCivic,
    category: event.category,
    expectedAttendees: event.expected_attendees,
    lifecycleStatus,
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  let initialSaved = false
  let studioAccess = false
  if (user) {
    const [{ data: savedRow }, { data: profileRow }] = await Promise.all([
      supabase
        .from('saved_events')
        .select('id')
        .eq('user_id', user.id)
        .eq('event_id', event.id)
        .maybeSingle(),
      supabase
        .from('profiles')
        .select('role, studio_access')
        .eq('id', user.id)
        .maybeSingle(),
    ])
    initialSaved = !!savedRow
    const profile = profileRow as {
      role?: string | null
      studio_access?: boolean | null
    } | null
    studioAccess = profile?.role === 'admin' || profile?.studio_access === true
  }

  return (
    <main className="min-h-screen bg-ink-950 text-white">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdScript(eventSchema(schemaEvent)) }}
      />
      <LandingNavbar />
      <TrackView
        type={isCivic ? 'protest_view' : 'event_view'}
        entityType="event"
        entityId={event.id}
        city={event.location_slug}
        country={event.country}
      />

      {/* Hero — image-led (event photo → AI poster art → brand gradient) */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0">
          {heroImage ? (
            <>
              <Image
                src={heroImage}
                alt=""
                fill
                priority
                sizes="100vw"
                className="object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-ink-950 via-ink-950/50 to-ink-950/75" />
              <div className="absolute inset-0 bg-gradient-to-r from-ink-950/55 via-transparent to-ink-950/35" />
            </>
          ) : (
            <>
              <div className="absolute inset-0 bg-grid opacity-40" />
              <div className="absolute inset-0 bg-radial-flame" />
              <div className="absolute left-1/2 top-20 h-[28rem] w-[28rem] -translate-x-1/2 rounded-full bg-flame-500/15 blur-3xl" />
              <div className="absolute right-[18%] top-28 h-[22rem] w-[22rem] rounded-full bg-flame-500/10 blur-3xl" />
            </>
          )}
        </div>

        <div className="relative z-10 mx-auto flex min-h-[26rem] w-full max-w-6xl flex-col px-4 pb-10 pt-28 sm:min-h-[30rem] sm:pb-14">
          <div>
            <Link
              href={isCivic ? '/protests' : '/events'}
              className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-ink-950/55 px-4 py-2 text-sm font-medium text-white/75 backdrop-blur-md transition hover:bg-ink-950/80 hover:text-white"
            >
              <ArrowLeft className="h-4 w-4" />
              {isCivic ? 'Back to protests' : 'Back to events'}
            </Link>
          </div>

          <div className={`mt-auto pt-12${heroImage ? ' on-media' : ''}`}>
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${getCategoryTone(
                  event.category
                )}`}
              >
                {event.category}
              </span>

              {hasEnded && (
                <span className="inline-flex items-center gap-1 rounded-full border border-white/15 bg-ink-950/60 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white/70 backdrop-blur-md">
                  <CalendarX2 className="h-3 w-3" />
                  Ended
                </span>
              )}

              {event.highlight && !hasEnded && (
                <span className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-black">
                  <Flame className="h-3 w-3" />
                  Hot
                </span>
              )}

              {isRecurring(event) && (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-flame-500/30 bg-flame-500/10 px-3 py-1 text-xs font-semibold text-flame-200">
                  <Repeat className="h-3 w-3" />
                  {recurrenceLabel(event)}
                </span>
              )}

              {event.is_online && (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-200">
                  <Globe2 className="h-3 w-3" />
                  Online
                </span>
              )}
            </div>

            <p className="mt-5 text-[13px] font-bold uppercase tracking-[0.22em] text-flame-300">
              {isRecurring(event) ? `From ${formatKicker(event)}` : formatKicker(event)}
            </p>

            <h1 className="display-text mt-3 max-w-4xl text-5xl leading-[0.95] tracking-tight sm:text-7xl">
              <LocalizedEventText base={event.title} i18n={event.title_i18n} asText />
            </h1>

            <p className="mt-5 flex flex-wrap items-center gap-x-2 text-base text-white/85">
              <MapPin className="h-4 w-4 shrink-0 text-white/60" />
              {venue?.name && <span className="font-semibold">{venue.name}</span>}
              {venue?.name && <span className="text-white/40">·</span>}
              <span className="text-white/65">
                {event.is_online
                  ? 'Online event'
                  : `${cityLabel}${countryLabel ? `, ${countryLabel}` : ''}`}
              </span>
            </p>

            {event.tags && event.tags.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-1.5">
                {event.tags.map((t) => (
                  <span
                    key={t}
                    className="rounded-full border border-white/15 bg-ink-950/45 px-2.5 py-1 text-xs text-white/75 backdrop-blur-md"
                  >
                    {t}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Body — editorial column + sticky action panel */}
      <section className="relative px-4 pb-16 pt-8 sm:pt-10">
        <div className="mx-auto grid w-full max-w-6xl gap-8 lg:grid-cols-[minmax(0,1fr)_400px] lg:gap-10">
          {/* Action panel — first on mobile, sticky right rail on desktop */}
          <aside className="lg:order-2">
            <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur-md lg:sticky lg:top-24">
              {event.listing_status && event.listing_status !== 'confirmed' && (
                <div
                  className={`mb-5 rounded-2xl border px-4 py-3.5 ${
                    event.listing_status === 'cancelled'
                      ? 'border-red-500/40 bg-red-500/10'
                      : event.listing_status === 'postponed'
                        ? 'border-amber-500/40 bg-amber-500/10'
                        : 'border-white/15 bg-white/[0.05]'
                  }`}
                >
                  <p className="inline-flex items-center gap-2 text-sm font-semibold text-white">
                    <ShieldAlert
                      className={`h-4 w-4 ${
                        event.listing_status === 'cancelled'
                          ? 'text-red-400'
                          : event.listing_status === 'postponed'
                            ? 'text-amber-400'
                            : 'text-white/60'
                      }`}
                    />
                    {event.listing_status === 'cancelled'
                      ? 'This event has been cancelled'
                      : event.listing_status === 'postponed'
                        ? 'This event has been postponed'
                        : 'Event details have changed'}
                  </p>
                  {event.official_source_url && (
                    <p className="mt-1 text-sm text-white/60">
                      Check the official source for the latest information.
                    </p>
                  )}
                </div>
              )}
              {hasEnded && (
                <div className="mb-5 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3.5">
                  <p className="inline-flex items-center gap-2 text-sm font-semibold text-white">
                    <CalendarX2 className="h-4 w-4 text-white/50" />
                    This event has ended
                  </p>
                  <p className="mt-1 text-sm text-white/55">
                    {formatDateLong(endedOnIso(event))}
                  </p>
                </div>
              )}

              <div className="flex items-center gap-4">
                <DateTile iso={event.date} />
                <div className="min-w-0">
                  {isMultiDay(event) && event.end_date ? (
                    <>
                      <p className="text-sm font-semibold tabular-nums text-white">
                        {formatDateLong(event.date)}
                        {event.time ? ` · ${event.time.slice(0, 5)}` : ''}
                      </p>
                      <p className="mt-1 text-sm font-semibold tabular-nums text-white/85">
                        → {formatDateLong(event.end_date)}
                        {event.end_time ? ` · ${event.end_time.slice(0, 5)}` : ''}
                      </p>
                      <p className="mt-1.5 inline-flex items-center gap-1.5 text-xs font-semibold text-flame-300">
                        <Clock3 className="h-3.5 w-3.5" />
                        {durationDaysLabel(
                          multiDayDurationDays(event.date, event.end_date),
                        )}{' '}
                        event
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="text-sm font-semibold text-white">
                        {isRecurring(event)
                          ? `Starts ${formatDateLong(event.date)}`
                          : formatDateLong(event.date)}
                      </p>
                      {formatTimeRange(event.time, event.end_time) && (
                        <p className="mt-1.5 inline-flex items-center gap-2 text-base font-semibold tabular-nums text-white">
                          <Clock3 className="h-4 w-4 text-flame-400" />
                          {formatTimeRange(event.time, event.end_time)}
                        </p>
                      )}
                    </>
                  )}
                  {event.doors_time && !hasEnded && (
                    <p className="mt-1 text-xs tabular-nums text-white/55">
                      Doors open {event.doors_time.slice(0, 5)}
                    </p>
                  )}
                  {isRecurring(event) && (
                    <p className="mt-1 inline-flex items-center gap-1.5 text-xs font-semibold text-flame-300">
                      <Repeat className="h-3.5 w-3.5" />
                      {recurrenceLabel(event)}
                    </p>
                  )}
                </div>
              </div>

              {isRecurring(event) && <UpcomingOccurrencesList event={event} />}

              {/* Forecast at the event's start hour. Only renders when the
                  event is soon (~16-day forecast window), physical, and has
                  coordinates — otherwise the section doesn't exist at all.
                  nextOccurrence resolves recurring events to their next date
                  and in-progress multi-day events to today, so the widget
                  stays alive mid-festival. */}
              {!hasEnded &&
                !event.is_online &&
                directionsLat != null &&
                directionsLng != null && (
                  <Suspense fallback={null}>
                    <EventWeatherCard
                      lat={directionsLat}
                      lng={directionsLng}
                      date={nextOccurrence(event) ?? event.date}
                      time={event.time}
                      timezone={getEventTimezone(
                        event.location_slug,
                        event.country,
                      )}
                    />
                  </Suspense>
                )}

              {hasNativeTickets && (
                <TierPicker
                  eventId={event.id}
                  slug={event.slug}
                  tiers={ticketTiers}
                  isAuthenticated={!!user}
                  city={event.location_slug}
                  country={event.country}
                />
              )}

              {!hasNativeTickets && (priceFromLabel || event.price) && (
                <div className="mt-5 border-t border-white/[0.08] pt-5">
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/40">
                      <Ticket className="h-3.5 w-3.5" />
                      {priceFromLabel ? 'Tickets' : 'Price'}
                    </span>
                    <span className="text-lg font-semibold text-white">
                      {priceFromLabel ?? event.price}
                    </span>
                  </div>
                  {ticketMeta && (
                    <p className="mt-2 text-right text-xs text-white/50">
                      {ticketMeta}
                    </p>
                  )}
                </div>
              )}

              {isCivic && event.expected_attendees != null && (
                <div className="mt-5 flex items-center justify-between border-t border-white/[0.08] pt-5">
                  <span className="inline-flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-flame-300/80">
                    <Users className="h-3.5 w-3.5" />
                    Expected
                  </span>
                  <span className="text-lg font-semibold text-white">
                    {formatAttendees(event.expected_attendees)}
                  </span>
                </div>
              )}

              <div className="mt-5 flex flex-wrap gap-2.5 border-t border-white/[0.08] pt-5">
                {hasEnded && (
                  <Link
                    href={similarEventsHref}
                    className="inline-flex items-center gap-2 rounded-full bg-flame-500 px-5 py-3 text-sm font-semibold text-white shadow-glow-flame transition hover:bg-flame-400 hover:-translate-y-0.5"
                  >
                    <Sparkles className="h-4 w-4" />
                    Find similar upcoming events
                  </Link>
                )}

                {/* One strong primary action per event; every other action
                    stays visually light. Ticketed events lead with tickets,
                    online events with joining, everything else with getting
                    there. */}
                {ticketUrl && (
                  <a
                    href={ticketUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-full bg-flame-500 px-5 py-3 text-sm font-semibold text-white shadow-glow-flame transition hover:bg-flame-400 hover:-translate-y-0.5"
                  >
                    <Ticket className="h-4 w-4" />
                    Get tickets
                  </a>
                )}

                {officialUrl && (
                  <a
                    href={officialUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-full bg-flame-500 px-5 py-3 text-sm font-semibold text-white shadow-glow-flame transition hover:bg-flame-400 hover:-translate-y-0.5"
                  >
                    <ExternalLink className="h-4 w-4" />
                    View official information
                  </a>
                )}

                {!hasEnded && !hasNativeTickets && !ticketUrl && !officialUrl && event.is_online && event.online_url && (
                  <a
                    href={event.online_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-full bg-flame-500 px-5 py-3 text-sm font-semibold text-white shadow-glow-flame transition hover:bg-flame-400 hover:-translate-y-0.5"
                  >
                    <Globe2 className="h-4 w-4" />
                    Join online
                  </a>
                )}

                {directionsHref && !hasEnded && !hasNativeTickets && !ticketUrl && !officialUrl && !(event.is_online && event.online_url) && (
                  <a
                    href={directionsHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-full bg-flame-500 px-5 py-3 text-sm font-semibold text-white shadow-glow-flame transition hover:bg-flame-400 hover:-translate-y-0.5"
                  >
                    <Navigation className="h-4 w-4" />
                    Get Directions
                  </a>
                )}

                {!hasEnded && (
                  <SaveEventButton
                    eventId={event.id}
                    initialSaved={initialSaved}
                    isAuthenticated={!!user}
                    size="md"
                  />
                )}

                <ShareEventButton data={shareData} studioAccess={studioAccess} />

                {!hasEnded && (
                  <MapPickerButton
                    albagoHref={mapHref}
                    lat={directionsLat}
                    lng={directionsLng}
                    address={event.address ?? venue?.address ?? null}
                  />
                )}

                {!hasEnded && (ticketUrl || hasNativeTickets) && event.is_online && event.online_url && (
                  <a
                    href={event.online_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-5 py-3 text-sm font-semibold text-white/85 transition hover:bg-white/[0.08] hover:text-white"
                  >
                    <Globe2 className="h-4 w-4" />
                    Join online
                  </a>
                )}

                {directionsHref && !hasEnded && (ticketUrl || hasNativeTickets || officialUrl || (event.is_online && event.online_url)) && (
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

                {hasEnded && directionsLat != null && directionsLng != null && (
                  <a
                    href={buildLocationViewHref(directionsLat, directionsLng)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-5 py-3 text-sm font-semibold text-white/85 transition hover:bg-white/[0.08] hover:text-white"
                  >
                    <MapPin className="h-4 w-4" />
                    View location
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

              {!event.is_online && (
                <div className="mt-5 border-t border-white/[0.08] pt-5">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/40">
                    Where
                  </p>
                  <p className="mt-2 whitespace-pre-line text-sm leading-6 text-white/80">
                    {event.address ||
                      venue?.address ||
                      `${cityLabel}${countryLabel ? `, ${countryLabel}` : ''}`}
                    {event.address_hint && (
                      <span className="block text-white/50">{event.address_hint}</span>
                    )}
                  </p>
                  <p className="mt-1 text-xs text-white/50">
                    {cityLabel}
                    {countryLabel ? ` · ${countryLabel}` : ''}
                  </p>
                </div>
              )}

              {event.last_verified_at && (
                <p className="mt-5 inline-flex items-center gap-1.5 border-t border-white/[0.08] pt-4 text-xs text-white/45">
                  <BadgeCheck className="h-3.5 w-3.5 text-flame-300/80" />
                  Details last verified{' '}
                  {formatDateLong(event.last_verified_at.slice(0, 10))}
                </p>
              )}
            </div>
          </aside>

          {/* Content column */}
          <div className="min-w-0 lg:order-1">
            {event.description && (
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/35">
                  About this event
                </p>
                <p className="mt-3 whitespace-pre-line text-base leading-7 text-white/75">
                  <LocalizedEventText
                    base={event.description ?? ''}
                    i18n={event.description_i18n}
                    asText
                  />
                </p>
              </div>
            )}

            {practicalEntries.length > 0 && (
              <div className={event.description ? 'mt-10' : ''}>
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/35">
                  Good to know
                </p>
                <dl className="mt-3 grid gap-3 sm:grid-cols-2">
                  {practicalEntries.map((entry) => (
                    <div
                      key={entry.key}
                      className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"
                    >
                      <dt className="text-[11px] font-semibold uppercase tracking-wide text-white/45">
                        {entry.label}
                      </dt>
                      <dd className="mt-1 text-sm leading-6 text-white/75">
                        {entry.value}
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
            )}

            <EventGallery
              urls={
                (event.gallery_urls && event.gallery_urls.length > 0
                  ? event.gallery_urls
                  : event.banner_url
                    ? [event.banner_url]
                    : []) as string[]
              }
              alt={event.title}
            />

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

          {(event.organizer_name ||
            event.organizer_phone ||
            event.organizer_website ||
            event.organizer_socials) && (
            <div className="mt-10 rounded-3xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur-md">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/35">
                {registeredOrganizer ? 'Event organizer' : 'Organizer'}
              </p>
              {event.organizer_name && (
                <div className="mt-3 flex items-start gap-3">
                  <span
                    aria-hidden
                    className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full border border-flame-500/30 bg-flame-500/15 text-sm font-bold text-flame-300"
                  >
                    {organizerInitials(event.organizer_name)}
                  </span>
                  <div className="min-w-0">
                    <p className="inline-flex flex-wrap items-center gap-2 text-lg font-semibold text-white">
                      {event.organizers?.slug ? (
                        <Link
                          href={`/organizers/${event.organizers.slug}`}
                          className="underline-offset-4 transition hover:text-flame-200 hover:underline"
                        >
                          {event.organizer_name}
                        </Link>
                      ) : (
                        event.organizer_name
                      )}
                      {event.organizers?.verification_tier === 'verified' && (
                        <span
                          title="Verified organizer — identity confirmed by AlbaGo"
                          className="inline-flex items-center gap-1 rounded-full border border-flame-500/30 bg-flame-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-flame-300"
                        >
                          <BadgeCheck className="h-3 w-3" />
                          Verified
                        </span>
                      )}
                    </p>
                    {registeredOrganizer?.bio && (
                      <p className="mt-1 text-sm leading-6 text-white/60">
                        {registeredOrganizer.bio}
                      </p>
                    )}
                  </div>
                </div>
              )}
              {registeredOrganizer && trustStats && (
                <div className="mt-4 grid grid-cols-3 gap-2 rounded-2xl border border-white/10 bg-white/[0.02] p-3">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/40">
                      Joined
                    </p>
                    <p className="mt-1 text-sm font-semibold text-white">
                      {formatJoinedShort(registeredOrganizer.created_at)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/40">
                      Events
                    </p>
                    <p className="mt-1 text-sm font-semibold text-white">
                      {trustStats.totalPublished}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/40">
                      Upcoming
                    </p>
                    <p className="mt-1 text-sm font-semibold text-white">
                      {trustStats.upcoming}
                    </p>
                  </div>
                </div>
              )}
              {registeredOrganizer && (
                <Link
                  href={`/organizers/${registeredOrganizer.slug}`}
                  className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-flame-300 transition hover:text-flame-200"
                >
                  View all events
                  <ExternalLink className="h-3 w-3" />
                </Link>
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
              {!registeredOrganizer && event.organizer_name && (
                <p className="mt-4 border-t border-white/[0.06] pt-4 text-xs leading-5 text-white/45">
                  Independent listing — this page is maintained by AlbaGo, not
                  by {event.organizer_name}.{' '}
                  <Link
                    href="/become-organizer"
                    className="text-flame-300/90 underline-offset-2 hover:underline"
                  >
                    Is this your event? Claim it.
                  </Link>
                </p>
              )}
            </div>
          )}

            {hasEnded && organizerUpcoming.length > 0 && (
              <div className="mt-10 rounded-3xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur-md">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/35">
                  Upcoming from this organizer
                </p>
                <div className="mt-4 space-y-2">
                  {organizerUpcoming.map((upcomingEvent) => {
                    const nextIso =
                      nextOccurrence(upcomingEvent) ?? upcomingEvent.date
                    const timeRange = formatTimeRange(
                      upcomingEvent.time,
                      upcomingEvent.end_time,
                    )
                    return (
                      <Link
                        key={upcomingEvent.id}
                        href={`/events/${upcomingEvent.slug}`}
                        className="flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-3 transition hover:bg-white/[0.06]"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-white">
                            {upcomingEvent.title}
                          </p>
                          <p className="mt-0.5 text-xs text-white/55">
                            {formatDateLong(nextIso)}
                            {timeRange && ` · ${timeRange}`}
                          </p>
                        </div>
                        <span className="shrink-0 rounded-full bg-white/[0.06] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-white/60">
                          {upcomingEvent.category}
                        </span>
                      </Link>
                    )
                  })}
                </div>
              </div>
            )}

            <div className="mt-10 flex justify-center border-t border-white/5 pt-6">
              <ReportEventButton eventId={event.id} />
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}
