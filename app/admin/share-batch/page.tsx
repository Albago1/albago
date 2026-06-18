import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getLocationBySlug } from '@/lib/locations'
import LandingNavbar from '@/components/layout/LandingNavbar'
import type { ShareEventData } from '@/lib/share/types'
import ShareBatchClient from './ShareBatchClient'

export const metadata: Metadata = {
  title: 'Admin · Share batch · AlbaGo',
}

type ProtestRow = {
  id: string
  slug: string
  title: string
  category: string
  date: string
  time: string | null
  end_time: string | null
  location_slug: string
  country: string | null
  address: string | null
  is_civic: boolean | null
  organizer_name: string | null
}

function tomorrowIso(): string {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export default async function ShareBatchPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/sign-in?next=/admin/share-batch')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  if (profile?.role !== 'admin') redirect('/dashboard')

  const since = tomorrowIso()

  const { data: rows, error } = await supabase
    .from('events')
    .select(
      'id, slug, title, category, date, time, end_time, location_slug, country, address, is_civic, organizer_name',
    )
    .eq('status', 'published')
    .eq('is_civic', true)
    .gte('date', since)
    .order('date', { ascending: true })
    .order('time', { ascending: true })

  const protests: ShareEventData[] = (rows as ProtestRow[] | null ?? []).map((r) => {
    const fallback = getLocationBySlug(r.location_slug)
    const cityLabel =
      fallback.slug === r.location_slug
        ? fallback.label
        : r.location_slug
            .replace(/-/g, ' ')
            .replace(/\b\w/g, (c) => c.toUpperCase())
    return {
      title: r.title,
      slug: r.slug,
      category: r.category,
      city: cityLabel,
      country: r.country ?? fallback.country ?? null,
      address: r.address,
      date: r.date,
      time: r.time,
      endTime: r.end_time,
      organizerName: r.organizer_name,
      isCivic: !!r.is_civic,
      eventUrl: `https://albago.org/events/${r.slug}`,
    }
  })

  return (
    <>
      <LandingNavbar />
      <main className="min-h-screen bg-ink-950 px-6 pb-16 pt-24 text-white">
        <div className="mx-auto max-w-4xl">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/45">
            Admin
          </p>
          <h1
            className="display-text mt-2 text-4xl leading-tight sm:text-5xl"
            style={{ letterSpacing: '-0.03em' }}
          >
            Share batch
          </h1>
          <p className="mt-3 text-sm text-white/65">
            Generate branded reel (1080×1920) and post (1080×1080) PNGs plus copy-ready
            captions for every upcoming protest. Bundles everything into a single ZIP.
          </p>
          <p className="mt-1 text-xs text-white/45">
            Window: events from{' '}
            <span className="font-semibold text-flame-200">{since}</span> onward · is_civic
            = true · status = published
          </p>

          {error && (
            <p className="mt-4 rounded-2xl border border-flame-500/30 bg-flame-500/[0.08] px-4 py-3 text-sm text-flame-200">
              Could not load events: {error.message}
            </p>
          )}

          <ShareBatchClient protests={protests} />
        </div>
      </main>
    </>
  )
}
