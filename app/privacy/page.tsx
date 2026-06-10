import type { Metadata } from 'next'
import Link from 'next/link'
import {
  ArrowLeft,
  Cookie,
  Database,
  Mail,
  MapPin,
  ShieldCheck,
} from 'lucide-react'
import LandingNavbar from '@/components/layout/LandingNavbar'

export const metadata: Metadata = {
  title: 'Privacy — AlbaGo',
  description:
    'How AlbaGo handles your data: what we collect, what we share, and how to reach us.',
}

const LAST_UPDATED = 'June 10, 2026'

const SECTIONS = [
  {
    icon: Database,
    title: 'What we collect',
    body: [
      'Account email and a hashed password when you sign up (via Supabase Auth).',
      'Events, places, and protests you save to your account.',
      'Event submissions, volunteer signups, and the form fields you fill (name, email, role, contact channels, address, optional notes).',
      'For civic events, the geocoded latitude/longitude of the address you type in the submission form.',
    ],
  },
  {
    icon: MapPin,
    title: 'Map searches and Nominatim',
    body: [
      'When you geocode an address (on /submit-event for civic events, on /protests when searching a city, or on the Albanian Revolution page), we send the text you typed to OpenStreetMap Nominatim — a public, third-party geocoding service.',
      'Nominatim sees the search text and your IP address, governed by their own usage policy. We do not send your account email or any logged-in identifier to them.',
      'Map tiles are served by Mapbox. Mapbox sees your IP and the tiles your viewport requests, governed by their privacy policy. They do not see your account identifier.',
    ],
  },
  {
    icon: Database,
    title: 'Where your data lives',
    body: [
      'All AlbaGo data is stored in Supabase (Postgres + Auth + Storage), hosted in the EU. Row-level security policies restrict access to your own rows.',
      'Aggregate stats (e.g. published event counts) are public. Personal records (saved events, volunteer signups, draft submissions) are private to you and platform admins.',
      'We do not sell or share your data with advertisers. We do not run third-party analytics or ad pixels.',
    ],
  },
  {
    icon: Cookie,
    title: 'Cookies',
    body: [
      'We use one cookie family: Supabase Auth session cookies, which keep you signed in. They are HTTP-only and scoped to this domain.',
      'We do not set analytics, marketing, or third-party tracking cookies.',
    ],
  },
  {
    icon: ShieldCheck,
    title: 'Your rights',
    body: [
      'You can sign in and delete saved events at any time.',
      'For deletion of your account, volunteer signups, or submitted events, email us — see "Contact" below — and we will action it within 30 days.',
      'You can also request a copy of every row tied to your account.',
    ],
  },
  {
    icon: Mail,
    title: 'Contact',
    body: [
      'Privacy questions or deletion requests: gerard.gani2007@gmail.com',
      'We aim to respond within 5 working days.',
    ],
  },
]

export default function PrivacyPage() {
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
            Back to home
          </Link>

          <p className="mt-6 inline-flex items-center gap-2 rounded-full bg-flame-500/15 px-3 py-1 text-xs font-semibold text-flame-300 ring-1 ring-flame-500/40">
            <ShieldCheck className="h-3.5 w-3.5" />
            Privacy
          </p>

          <h1 className="display-text mt-5 text-5xl leading-[0.95] tracking-tight sm:text-7xl">
            How we handle <span className="italic text-flame-400">your data</span>
          </h1>

          <p className="mt-6 max-w-2xl text-base leading-7 text-white/65">
            AlbaGo is built for discovery, not surveillance. This page is the plain-English
            version of what we collect, where it goes, and how to reach us.
          </p>

          <p className="mt-3 text-xs uppercase tracking-[0.18em] text-white/35">
            Last updated · {LAST_UPDATED}
          </p>
        </div>
      </section>

      <section className="px-4 pb-24">
        <div className="mx-auto max-w-3xl space-y-6">
          {SECTIONS.map((section) => {
            const Icon = section.icon
            return (
              <article
                key={section.title}
                className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur-md sm:p-8"
              >
                <div className="flex items-start gap-4">
                  <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-flame-500/15 text-flame-300 ring-1 ring-flame-500/30">
                    <Icon className="h-5 w-5" />
                  </span>
                  <div className="flex-1">
                    <h2 className="text-xl font-semibold text-white">
                      {section.title}
                    </h2>
                    <ul className="mt-3 space-y-3 text-sm leading-6 text-white/75">
                      {section.body.map((line, idx) => (
                        <li key={idx} className="flex gap-2">
                          <span className="mt-2 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-flame-500/70" />
                          <span>{line}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </article>
            )
          })}

          <p className="mt-8 text-center text-xs text-white/45">
            Questions? Email{' '}
            <a
              href="mailto:gerard.gani2007@gmail.com"
              className="text-flame-300 hover:underline"
            >
              gerard.gani2007@gmail.com
            </a>
            .
          </p>
        </div>
      </section>
    </main>
  )
}
