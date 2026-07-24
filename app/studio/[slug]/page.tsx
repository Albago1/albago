import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { Lock, Sparkles } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { hasStudioAccess } from '@/lib/ai/studioAccess'
import { getLocationBySlug } from '@/lib/locations'
import type { ShareEventData } from '@/lib/share/types'
import StudioClient from './StudioClient'

/**
 * AlbaGo Studio — the event-marketing engine. One published event in, a
 * complete promo kit out: poster, square, social card, reels and captions,
 * all restyled together by "Looks" and carrying the tracked AlbaGo funnel.
 *
 * Invite-only: Studio members (admins + granted accounts) create; everyone
 * else sees an elegant locked page. The share modal links here — creation
 * lives on this immersive surface, quick link-sharing stays in the modal.
 */

type Params = { slug: string }

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>
}): Promise<Metadata> {
  const { slug } = await params
  const event = await fetchStudioEvent(slug)
  return {
    title: event ? `Studio — ${event.title}` : 'Studio',
    // Private creation tool — never index.
    robots: { index: false, follow: false },
  }
}

type StudioEventRow = {
  slug: string
  title: string
  category: string | null
  date: string
  end_date: string | null
  time: string | null
  end_time: string | null
  address: string | null
  location_slug: string | null
  country: string | null
  is_civic: boolean | null
  organizer_name: string | null
  banner_url: string | null
  gallery_urls: string[] | null
}

async function fetchStudioEvent(slug: string): Promise<StudioEventRow | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('events')
    .select(
      'slug, title, category, date, end_date, time, end_time, address, location_slug, country, is_civic, organizer_name, banner_url, gallery_urls',
    )
    .eq('status', 'published')
    .eq('slug', slug)
    .maybeSingle()
  return (data as StudioEventRow | null) ?? null
}

function LockedStudio({ slug }: { slug: string }) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-[#050505] px-6 text-center text-white">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-white/60">
        <Lock className="h-5 w-5" />
      </div>
      <h1
        className="mt-8 text-4xl sm:text-5xl"
        style={{ fontFamily: "var(--font-display), 'Instrument Serif', Georgia, serif" }}
      >
        AlbaGo <span className="italic text-flame-500">Studio</span>
      </h1>
      <p className="mt-4 max-w-sm text-sm leading-6 text-white/60">
        Studio është vetëm me ftesë · Studio is invite-only.
        <br />
        Posters, reels and captions crafted for organizers on AlbaGo.
      </p>
      <div className="mt-8 flex items-center gap-3">
        <Link
          href={`/events/${slug}`}
          className="rounded-full border border-white/15 bg-white/[0.05] px-6 py-3 text-sm font-semibold text-white/85 transition hover:bg-white/[0.1]"
        >
          Back to the event
        </Link>
        <Link
          href="/organizer"
          className="inline-flex items-center gap-2 rounded-full bg-flame-600 px-6 py-3 text-sm font-bold text-white transition hover:bg-flame-500"
        >
          <Sparkles className="h-4 w-4" />
          For organizers
        </Link>
      </div>
    </main>
  )
}

export default async function StudioPage({ params }: { params: Promise<Params> }) {
  const { slug } = await params
  const event = await fetchStudioEvent(slug)
  if (!event) notFound()

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect(`/sign-in?next=/studio/${slug}`)

  if (!(await hasStudioAccess())) {
    return <LockedStudio slug={slug} />
  }

  // getLocationBySlug falls back to Tirana for unknown slugs — prefer the raw
  // slug prettified over a wrong city on the artwork.
  const location = getLocationBySlug(event.location_slug)
  const city =
    location.slug === event.location_slug
      ? location.label
      : (event.location_slug || 'the city').replace(/-/g, ' ')

  const images = [event.banner_url, ...(event.gallery_urls ?? [])].filter(
    (u, i, arr): u is string =>
      typeof u === 'string' && /^https?:\/\//.test(u) && arr.indexOf(u) === i,
  )

  const data: ShareEventData = {
    title: event.title,
    slug: event.slug,
    category: event.category,
    city,
    country: event.country,
    address: event.address,
    date: event.date,
    endDate: event.end_date,
    time: event.time,
    endTime: event.end_time,
    organizerName: event.organizer_name,
    isCivic: Boolean(event.is_civic),
    eventUrl: `https://albago.org/events/${event.slug}`,
    imageUrl: images[0] ?? null,
  }

  return <StudioClient data={data} images={images} />
}
