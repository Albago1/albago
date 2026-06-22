import type { Metadata } from 'next'
import Link from 'next/link'
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  Building2,
  Calendar,
  ExternalLink,
  ShieldCheck,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import LandingNavbar from '@/components/layout/LandingNavbar'
import { activeEventsOrFilter, isEventActive } from '@/lib/eventActive'

export const metadata: Metadata = {
  title: 'Organizers — AlbaGo',
  description:
    'Verified and established organizers running events on AlbaGo across Albania and the diaspora.',
  openGraph: {
    title: 'Organizers on AlbaGo',
    description:
      'Verified and established organizers running events across Albania and the diaspora.',
    type: 'website',
  },
}

export const dynamic = 'force-dynamic'
export const revalidate = 0

type OrganizerRow = {
  id: string
  display_name: string
  slug: string
  bio: string | null
  website_url: string | null
  verification_tier: 'established' | 'verified'
  created_at: string
}

type EventRow = {
  organizer_id: string
  date: string
  end_time: string | null
  recurrence: string | null
  recurrence_until: string | null
  recurrence_days_of_week: number[] | null
  recurrence_exceptions: string[] | null
}

export default async function OrganizersIndexPage() {
  const supabase = await createClient()

  const [orgsRes, eventsRes] = await Promise.all([
    supabase
      .from('organizers')
      .select(
        'id, display_name, slug, bio, website_url, verification_tier, created_at',
      )
      .in('verification_tier', ['established', 'verified'])
      .order('verification_tier', { ascending: false }) // verified first
      .order('created_at', { ascending: true }),
    supabase
      .from('events')
      .select(
        'organizer_id, date, end_time, recurrence, recurrence_until, recurrence_days_of_week, recurrence_exceptions',
      )
      .eq('status', 'published')
      .not('organizer_id', 'is', null)
      .or(activeEventsOrFilter()),
  ])

  const organizers = (orgsRes.data as OrganizerRow[] | null) ?? []
  const events = ((eventsRes.data as EventRow[] | null) ?? []).filter((e) =>
    isEventActive(e),
  )

  const upcomingByOrganizer = new Map<string, number>()
  for (const e of events) {
    if (!e.organizer_id) continue
    upcomingByOrganizer.set(
      e.organizer_id,
      (upcomingByOrganizer.get(e.organizer_id) ?? 0) + 1,
    )
  }

  const verified = organizers.filter((o) => o.verification_tier === 'verified')
  const established = organizers.filter(
    (o) => o.verification_tier === 'established',
  )

  return (
    <main className="min-h-screen bg-ink-950 text-white">
      <LandingNavbar />

      <section className="relative overflow-hidden px-4 pb-12 pt-32">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute inset-0 bg-grid opacity-40" />
          <div className="absolute inset-0 bg-radial-flame" />
          <div className="absolute left-1/2 top-20 h-[24rem] w-[24rem] -translate-x-1/2 rounded-full bg-flame-500/15 blur-3xl" />
        </div>

        <div className="relative z-10 mx-auto max-w-3xl">
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-medium text-white/75 transition hover:bg-white/[0.08] hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            Back home
          </Link>

          <p className="mt-6 inline-flex items-center gap-2 rounded-full bg-flame-500/15 px-3 py-1 text-xs font-semibold text-flame-300 ring-1 ring-flame-500/40">
            <BadgeCheck className="h-3.5 w-3.5" />
            Organizers
          </p>

          <h1 className="display-text mt-5 text-5xl leading-[0.95] tracking-tight sm:text-7xl">
            People running{' '}
            <span className="italic text-flame-400">events on AlbaGo</span>
          </h1>

          <p className="mt-6 max-w-2xl text-base leading-7 text-white/65">
            Verified and established organizers — venues, collectives, activists,
            and promoters trusted to publish instantly. Want to join? Apply at{' '}
            <Link
              href="/become-organizer"
              className="text-flame-300 hover:underline"
            >
              /become-organizer
            </Link>
            .
          </p>
        </div>
      </section>

      <section className="px-4 pb-24">
        <div className="mx-auto max-w-5xl">
          {organizers.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-white/10 bg-white/[0.02] p-10 text-center">
              <Building2 className="mx-auto h-8 w-8 text-white/20" />
              <p className="mt-4 font-semibold text-white">
                No verified organizers yet
              </p>
              <p className="mt-1 text-sm text-white/55">
                Be the first.{' '}
                <Link
                  href="/become-organizer"
                  className="text-flame-300 hover:underline"
                >
                  Become an organizer
                </Link>
                .
              </p>
            </div>
          ) : (
            <>
              {verified.length > 0 && (
                <section>
                  <div className="flex items-end justify-between gap-3">
                    <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-white/40">
                      <BadgeCheck className="h-3.5 w-3.5 text-flame-300" />
                      Verified
                    </h2>
                    <span className="text-xs text-white/35">
                      {verified.length}
                    </span>
                  </div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    {verified.map((o) => (
                      <OrganizerCard
                        key={o.id}
                        organizer={o}
                        upcoming={upcomingByOrganizer.get(o.id) ?? 0}
                      />
                    ))}
                  </div>
                </section>
              )}

              {established.length > 0 && (
                <section className={verified.length > 0 ? 'mt-10' : ''}>
                  <div className="flex items-end justify-between gap-3">
                    <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-white/40">
                      <ShieldCheck className="h-3.5 w-3.5" />
                      Established
                    </h2>
                    <span className="text-xs text-white/35">
                      {established.length}
                    </span>
                  </div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    {established.map((o) => (
                      <OrganizerCard
                        key={o.id}
                        organizer={o}
                        upcoming={upcomingByOrganizer.get(o.id) ?? 0}
                      />
                    ))}
                  </div>
                </section>
              )}
            </>
          )}

          <div className="mt-12 rounded-3xl border border-flame-500/25 bg-gradient-to-br from-flame-500/[0.08] to-transparent p-6 text-center sm:p-8">
            <h2 className="text-xl font-semibold text-white">
              Want your name here?
            </h2>
            <p className="mt-2 text-sm text-white/55">
              Free to register, free to publish. After 2 approved events you
              skip moderation.
            </p>
            <Link
              href="/become-organizer"
              className="mt-5 inline-flex items-center gap-2 rounded-full bg-flame-500 px-5 py-2.5 text-sm font-semibold text-white shadow-[0_0_24px_-6px_rgba(238,28,37,0.55)] transition hover:bg-flame-400"
            >
              Become an organizer
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </section>
    </main>
  )
}

function OrganizerCard({
  organizer,
  upcoming,
}: {
  organizer: OrganizerRow
  upcoming: number
}) {
  const isVerified = organizer.verification_tier === 'verified'
  return (
    <Link
      href={`/organizers/${organizer.slug}`}
      className="group flex flex-col rounded-3xl border border-white/10 bg-white/[0.03] p-5 transition hover:border-flame-500/30 hover:bg-flame-500/[0.04]"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04]">
            {isVerified ? (
              <BadgeCheck className="h-5 w-5 text-flame-400" />
            ) : (
              <Building2 className="h-5 w-5 text-flame-300" />
            )}
          </div>
          <div className="min-w-0">
            <h3 className="truncate text-base font-semibold text-white">
              {organizer.display_name}
            </h3>
            <p className="text-[11px] uppercase tracking-wide text-white/45">
              {isVerified ? 'Verified' : 'Established'}
            </p>
          </div>
        </div>
        <ArrowRight className="mt-1 h-4 w-4 flex-shrink-0 text-white/40 transition group-hover:translate-x-0.5 group-hover:text-white/70" />
      </div>

      {organizer.bio && (
        <p className="mt-3 line-clamp-2 text-sm leading-snug text-white/65">
          {organizer.bio}
        </p>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2 text-[11px] text-white/55">
        <span className="inline-flex items-center gap-1 rounded-full bg-white/[0.05] px-2 py-0.5 font-semibold">
          <Calendar className="h-3 w-3" />
          {upcoming} upcoming
        </span>
        {organizer.website_url && (
          <span className="inline-flex items-center gap-1 rounded-full bg-white/[0.05] px-2 py-0.5">
            <ExternalLink className="h-3 w-3" />
            Website
          </span>
        )}
      </div>
    </Link>
  )
}
