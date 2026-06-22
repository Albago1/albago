import type { Metadata } from 'next'
import Link from 'next/link'
import {
  ArrowLeft,
  Camera,
  Flag,
  Flame,
  Globe,
  HeartHandshake,
  Map,
  Megaphone,
  ShieldCheck,
  Sparkles,
} from 'lucide-react'
import LandingNavbar from '@/components/layout/LandingNavbar'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = {
  title: 'About AlbaGo — Built for Albania and the diaspora',
  description:
    'AlbaGo is a discovery platform for events, venues, and civic gatherings across Albania and the worldwide Albanian diaspora.',
  openGraph: {
    title: 'About AlbaGo',
    description:
      'A discovery platform for events, venues, and civic gatherings across Albania and the diaspora.',
    type: 'website',
  },
}

export const dynamic = 'force-dynamic'
export const revalidate = 0

type CountResult = { count: number | null; error: { message: string } | null }
function safeCount(res: CountResult | null | undefined): number {
  if (!res || res.error) return 0
  return res.count ?? 0
}

export default async function AboutPage() {
  const supabase = await createClient()
  const todayIso = new Date().toISOString().split('T')[0]

  const [eventsCount, organizersCount, usersCount, citiesRes] = await Promise.all([
    supabase
      .from('events')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'published')
      .or(`date.gte.${todayIso},recurrence.in.(daily,weekly)`),
    supabase
      .from('organizers')
      .select('id', { count: 'exact', head: true })
      .in('verification_tier', ['established', 'verified']),
    supabase.from('profiles').select('id', { count: 'exact', head: true }),
    supabase
      .from('events')
      .select('country')
      .eq('status', 'published'),
  ])

  const countries = new Set(
    ((citiesRes.data as Array<{ country: string | null }> | null) ?? [])
      .map((r) => r.country)
      .filter(Boolean),
  ).size

  const stats = [
    { label: 'Live events', value: safeCount(eventsCount) },
    { label: 'Organizers', value: safeCount(organizersCount) },
    { label: 'Countries', value: countries },
    { label: 'Registered users', value: safeCount(usersCount) },
  ]

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
            <Sparkles className="h-3.5 w-3.5" />
            About
          </p>

          <h1 className="display-text mt-5 text-5xl leading-[0.95] tracking-tight sm:text-7xl">
            Built for Albania{' '}
            <span className="italic text-flame-400">and the diaspora</span>
          </h1>

          <p className="mt-6 max-w-2xl text-base leading-7 text-white/65">
            AlbaGo is a discovery platform for events, venues, and civic
            gatherings — calm, lawful, and open. From a nightlife pick in Tirana
            to a peaceful protest in Berlin, everything that matters in real
            life shows up in one place.
          </p>
        </div>
      </section>

      {/* Live stats */}
      <section className="px-4 pb-12">
        <div className="mx-auto grid max-w-3xl grid-cols-2 gap-3 sm:grid-cols-4">
          {stats.map((s) => (
            <div
              key={s.label}
              className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-center"
            >
              <div className="font-display text-3xl text-white sm:text-4xl">
                {s.value}
              </div>
              <div className="mt-1 text-[11px] uppercase tracking-wide text-white/55">
                {s.label}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Mission card */}
      <section className="px-4 pb-12">
        <div className="mx-auto max-w-3xl rounded-3xl border border-flame-500/25 bg-gradient-to-br from-flame-500/[0.08] via-white/[0.02] to-transparent p-8 sm:p-10">
          <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.22em] text-flame-300">
            <Flame className="h-3.5 w-3.5" />
            Mission
          </div>
          <h2 className="display-text mt-3 text-3xl leading-tight sm:text-4xl">
            Connect real people to real events — peacefully, openly, together.
          </h2>
          <p className="mt-4 max-w-2xl text-base leading-7 text-white/65">
            Most platforms hide community life behind algorithms or paywalls.
            AlbaGo keeps it simple: a search bar, a map, and a clean list of
            what&apos;s happening tonight. Free for organizers, free for
            attendees, and built to scale from one Tirana club to the worldwide
            Albanian diaspora.
          </p>
        </div>
      </section>

      {/* Principles */}
      <section className="px-4 pb-12">
        <div className="mx-auto max-w-3xl">
          <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-white/40">
            What we stand for
          </h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-flame-500/15 ring-1 ring-flame-500/30">
                <ShieldCheck className="h-5 w-5 text-flame-300" />
              </div>
              <h3 className="mt-4 text-lg font-semibold text-white">
                Peaceful and lawful
              </h3>
              <p className="mt-2 text-sm leading-6 text-white/65">
                We host civic gatherings, marches, and protests — all coordinated
                lawfully, peacefully, and in good faith. No calls to violence,
                ever.
              </p>
            </div>
            <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-flame-500/15 ring-1 ring-flame-500/30">
                <Globe className="h-5 w-5 text-flame-300" />
              </div>
              <h3 className="mt-4 text-lg font-semibold text-white">
                Diaspora-first
              </h3>
              <p className="mt-2 text-sm leading-6 text-white/65">
                Tirana, Prishtina, Berlin, New York, Melbourne — the Albanian
                world doesn&apos;t fit on one map. We built one anyway.
              </p>
            </div>
            <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-flame-500/15 ring-1 ring-flame-500/30">
                <HeartHandshake className="h-5 w-5 text-flame-300" />
              </div>
              <h3 className="mt-4 text-lg font-semibold text-white">
                Free, both sides
              </h3>
              <p className="mt-2 text-sm leading-6 text-white/65">
                Free to list. Free to discover. We don&apos;t take a cut of
                tickets and we don&apos;t run ads against community events.
              </p>
            </div>
            <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-flame-500/15 ring-1 ring-flame-500/30">
                <Camera className="h-5 w-5 text-flame-300" />
              </div>
              <h3 className="mt-4 text-lg font-semibold text-white">
                Real photos, real people
              </h3>
              <p className="mt-2 text-sm leading-6 text-white/65">
                Pankartat — our protest placard gallery — only accepts real
                photos uploaded by people who were there. No generators, no
                stock. Authenticity is the product.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* What you can do */}
      <section className="px-4 pb-12">
        <div className="mx-auto max-w-3xl">
          <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-white/40">
            What you can do on AlbaGo
          </h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <Link
              href="/events"
              className="group rounded-3xl border border-white/10 bg-white/[0.03] p-5 transition hover:border-white/15 hover:bg-white/[0.05]"
            >
              <Map className="h-5 w-5 text-flame-300" />
              <h3 className="mt-3 text-base font-semibold text-white">
                Discover events
              </h3>
              <p className="mt-1 text-xs leading-5 text-white/55">
                Browse by city, category, time. Save for later.
              </p>
            </Link>
            <Link
              href="/become-organizer"
              className="group rounded-3xl border border-white/10 bg-white/[0.03] p-5 transition hover:border-white/15 hover:bg-white/[0.05]"
            >
              <Megaphone className="h-5 w-5 text-flame-300" />
              <h3 className="mt-3 text-base font-semibold text-white">
                Organise events
              </h3>
              <p className="mt-1 text-xs leading-5 text-white/55">
                Free to publish. Verified organizers post instantly.
              </p>
            </Link>
            <Link
              href="/protests"
              className="group rounded-3xl border border-white/10 bg-white/[0.03] p-5 transition hover:border-white/15 hover:bg-white/[0.05]"
            >
              <Flag className="h-5 w-5 text-flame-300" />
              <h3 className="mt-3 text-base font-semibold text-white">
                Stand together
              </h3>
              <p className="mt-1 text-xs leading-5 text-white/55">
                Find or register a peaceful, lawful civic gathering.
              </p>
            </Link>
          </div>
        </div>
      </section>

      {/* Contact strip */}
      <section className="px-4 pb-24">
        <div className="mx-auto max-w-3xl rounded-3xl border border-white/10 bg-white/[0.03] p-6 text-center sm:p-8">
          <h2 className="text-xl font-semibold text-white">
            Want to partner, ask a question, or share feedback?
          </h2>
          <p className="mt-2 text-sm text-white/55">
            We read every message.
          </p>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/contact"
              className="inline-flex items-center gap-2 rounded-full bg-flame-500 px-5 py-2.5 text-sm font-semibold text-white shadow-[0_0_24px_-6px_rgba(238,28,37,0.55)] transition hover:bg-flame-400"
            >
              Get in touch
            </Link>
            <Link
              href="/faq"
              className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-5 py-2.5 text-sm font-semibold text-white/85 transition hover:bg-white/[0.08] hover:text-white"
            >
              Read the FAQ
            </Link>
          </div>
        </div>
      </section>
    </main>
  )
}
