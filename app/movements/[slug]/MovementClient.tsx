'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import { ArrowRight, Calendar, Compass, Flame, Globe2, MapPin } from 'lucide-react'
import LandingNavbar from '@/components/layout/LandingNavbar'
import { Reveal } from '@/components/cinematic/Reveal'
import { SectionLabel } from '@/components/cinematic/SectionLabel'
import { CinematicLink } from '@/components/cinematic/CinematicButton'
import ProtestMap from '@/components/protest/ProtestMap'
import ProtestEventCard, {
  type ProtestEvent,
  formatProtestNumber,
} from '@/components/protest/ProtestEventCard'
import SafetyPanel from '@/components/protest/SafetyPanel'
import type { Movement } from '@/lib/movements'

type Props = {
  movement: Movement
  events: ProtestEvent[]
  migrationApplied: boolean
}

export default function MovementClient({ movement, events, migrationApplied }: Props) {
  const mapMarkers = useMemo(
    () =>
      events
        .filter((e) => e.lat != null && e.lng != null)
        .map((e) => ({
          id: e.id,
          name: e.title,
          city: e.placeName ?? e.locationSlug,
          country: e.country,
          lat: e.lat as number,
          lng: e.lng as number,
          slug: e.slug,
        })),
    [events],
  )

  const totals = useMemo(() => {
    const cities = new Set(events.map((e) => e.locationSlug)).size
    const countries = new Set(events.map((e) => e.country)).size
    const attending = events.reduce((sum, e) => sum + (e.expectedAttendees ?? 0), 0)
    return { cities, countries, attending }
  }, [events])

  return (
    <div className="relative min-h-screen bg-ink-950 text-white">
      <LandingNavbar />

      {/* Hero */}
      <section className="relative isolate overflow-hidden pt-28 sm:pt-32">
        <div className="absolute inset-0 -z-10">
          <div className="absolute inset-0 bg-grid opacity-50" />
          <div className="absolute inset-0 bg-radial-flame" />
          <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-ink-950 to-transparent" />
        </div>

        <div className="mx-auto w-full max-w-7xl px-5 pb-12 sm:px-8 sm:pb-16">
          <Reveal>
            <div className="inline-flex items-center gap-2 rounded-full border border-flame-500/30 bg-flame-500/[0.06] px-4 py-1.5 text-xs text-flame-200 backdrop-blur">
              <Flame className="h-3.5 w-3.5 text-flame-400" />
              Featured movement
            </div>
          </Reveal>

          <Reveal delay={0.05}>
            <h1 className="display-text mt-6 text-4xl leading-[0.95] tracking-tight sm:text-6xl lg:text-7xl">
              {movement.name} —{' '}
              <span className="italic text-flame-400">{movement.tagline}</span>
            </h1>
          </Reveal>

          <Reveal delay={0.12}>
            <p className="mt-6 max-w-2xl text-base leading-relaxed text-white/65 sm:text-lg">
              {movement.description}
            </p>
          </Reveal>

          <Reveal delay={0.18}>
            <div className="mt-8 flex flex-wrap gap-3">
              <CinematicLink href="/submit-event" variant="primary" size="md">
                Register a gathering
                <ArrowRight className="h-4 w-4" />
              </CinematicLink>
              <CinematicLink
                href={`/volunteer?movement=${movement.slug}`}
                variant="secondary"
                size="md"
              >
                Volunteer
              </CinematicLink>
              {movement.flagshipUrl && (
                <CinematicLink
                  href={movement.flagshipUrl}
                  variant="ghost"
                  size="md"
                >
                  Open campaign page
                </CinematicLink>
              )}
            </div>
          </Reveal>

          <Reveal delay={0.24}>
            <div className="mt-10 inline-flex flex-wrap items-center gap-2 text-xs text-white/55">
              <span>
                <span className="font-semibold text-white">{events.length}</span> gatherings
              </span>
              <span className="h-3 w-px bg-white/15" />
              <span>
                <span className="font-semibold text-white">{totals.cities}</span> cities
              </span>
              <span className="h-3 w-px bg-white/15" />
              <span>
                <span className="font-semibold text-white">{totals.countries}</span> countries
              </span>
              <span className="h-3 w-px bg-white/15" />
              <span>
                <span className="font-semibold text-white">
                  {formatProtestNumber(totals.attending)}
                </span>{' '}
                expected
              </span>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Empty banner */}
      {events.length === 0 && (
        <section className="px-5 pb-6 sm:px-8">
          <div className="mx-auto max-w-7xl rounded-2xl border border-flame-500/30 bg-flame-500/[0.06] px-5 py-4 text-sm text-flame-200">
            <div className="flex items-start gap-3">
              <Compass className="mt-0.5 h-4 w-4 shrink-0 text-flame-400" />
              <div>
                <p className="font-semibold text-white">
                  {migrationApplied
                    ? 'No gatherings registered for this movement yet.'
                    : 'Civic schema not enabled.'}
                </p>
                <p className="mt-1 text-white/70">
                  {migrationApplied ? (
                    <>
                      Submit a peaceful gathering with{' '}
                      <code className="mx-1 rounded bg-white/10 px-1.5 py-0.5 font-mono text-[11px]">
                        {`featured_movement_slug = '${movement.slug}'`}
                      </code>{' '}
                      via{' '}
                      <Link href="/submit-event" className="underline">
                        /submit-event
                      </Link>{' '}
                      and it will show up here once approved.
                    </>
                  ) : (
                    'Apply the SQL migration in docs/phase-8-civic-events-plan.md to enable civic fields, then seed rows.'
                  )}
                </p>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Map + cards */}
      {events.length > 0 && (
        <section className="relative px-5 pb-16 pt-2 sm:px-8 sm:pb-24">
          <div className="mx-auto max-w-7xl">
            <Reveal>
              <SectionLabel>Worldwide</SectionLabel>
              <h2 className="display-text mt-3 text-3xl sm:text-4xl">
                Every active gathering for{' '}
                <span className="italic text-flame-400">{movement.shortName}</span>.
              </h2>
            </Reveal>

            <div className="mt-8">
              <ProtestMap
                markers={mapMarkers}
                defaultCenter={[10, 30]}
                defaultZoom={1.6}
              />
            </div>

            <div className="mt-10 grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
              {events.map((event) => (
                <ProtestEventCard key={event.id} event={event} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Manifesto */}
      {movement.manifestoPoints.length > 0 && (
        <section className="relative px-5 py-16 sm:px-8 sm:py-24">
          <div className="mx-auto max-w-5xl">
            <Reveal>
              <SectionLabel>What we stand for</SectionLabel>
              <h2 className="display-text mt-3 text-3xl sm:text-4xl">
                The principles of{' '}
                <span className="italic text-flame-400">{movement.shortName}</span>.
              </h2>
            </Reveal>

            <div className="mt-10 grid gap-4 sm:grid-cols-2">
              {movement.manifestoPoints.map((point) => (
                <Reveal key={point} delay={0.05}>
                  <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5 backdrop-blur-sm">
                    <div className="flex items-start gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-flame-500/15 text-flame-300">
                        <Flame className="h-4 w-4" />
                      </div>
                      <p className="text-sm leading-6 text-white/80">{point}</p>
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Safety panel */}
      <section className="relative px-5 py-16 sm:px-8 sm:py-20">
        <div className="mx-auto max-w-5xl">
          <SafetyPanel compact />
        </div>
      </section>

      {/* CTA banner */}
      <section className="relative px-5 pb-24 sm:px-8">
        <div className="relative mx-auto max-w-6xl overflow-hidden rounded-3xl border border-white/[0.08] bg-gradient-to-br from-flame-500/15 via-flame-500/5 to-transparent p-8 sm:p-12">
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute -top-24 left-1/2 h-72 w-[40rem] -translate-x-1/2 rounded-full bg-flame-500/25 blur-3xl" />
          </div>
          <div className="relative flex flex-col items-start gap-6">
            <SectionLabel>Be part of it</SectionLabel>
            <h2 className="display-text text-3xl sm:text-4xl lg:text-5xl">
              Your city is listening.{' '}
              <span className="italic text-flame-400">Add yours.</span>
            </h2>
            <p className="max-w-2xl text-base leading-relaxed text-white/70 sm:text-lg">
              Whether you have ten people or ten thousand, register your gathering and
              AlbaGo will help you organize, communicate, and stay safe — peacefully.
            </p>
            <div className="flex flex-wrap gap-3">
              <CinematicLink href="/submit-event" variant="primary" size="md">
                <Calendar className="h-4 w-4" />
                Register a gathering
              </CinematicLink>
              <CinematicLink href="/protests" variant="secondary" size="md">
                <MapPin className="h-4 w-4" />
                See the world map
              </CinematicLink>
              <CinematicLink
                href={`/volunteer?movement=${movement.slug}`}
                variant="ghost"
                size="md"
              >
                <Globe2 className="h-4 w-4" />
                Volunteer
              </CinematicLink>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
