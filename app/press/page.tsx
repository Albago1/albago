import type { Metadata } from 'next'
import Link from 'next/link'
import {
  ArrowLeft,
  Download,
  ExternalLink,
  Mail,
  Newspaper,
  Palette,
  Quote,
} from 'lucide-react'
import LandingNavbar from '@/components/layout/LandingNavbar'

export const metadata: Metadata = {
  title: 'Press kit — AlbaGo',
  description:
    'Brand assets, factsheet, screenshots, and press contact for journalists and partners covering AlbaGo.',
  openGraph: {
    title: 'Press kit — AlbaGo',
    description:
      'Brand assets, factsheet, screenshots, and press contact for AlbaGo.',
    type: 'website',
  },
}

const PRESS_EMAIL = 'albago.org@gmail.com'

const FACTS = [
  { label: 'Founded', value: '2026' },
  { label: 'Based in', value: 'Albania · Europe' },
  { label: 'Built on', value: 'Next.js · Supabase · Vercel' },
  { label: 'Pricing', value: 'Free to use' },
]

const TAGLINES = [
  'Discover events, nightlife and civic gatherings across Albania and the Albanian diaspora.',
  'Starting in Albania and Albanian communities worldwide, with more cities coming next.',
  'Find what is happening tonight in any Albanian city — Tirana to Berlin, peaceful protests to nightlife.',
]

export default function PressPage() {
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
            <Newspaper className="h-3.5 w-3.5" />
            Press kit
          </p>

          <h1 className="display-text mt-5 text-5xl leading-[0.95] tracking-tight sm:text-7xl">
            Brand assets &amp;{' '}
            <span className="italic text-flame-400">factsheet</span>
          </h1>

          <p className="mt-6 max-w-2xl text-base leading-7 text-white/65">
            Logos, screenshots, factsheet, and a direct media contact. Use
            anything here in articles, talks, or partner materials — credit
            &ldquo;AlbaGo&rdquo; and link back to{' '}
            <a
              href="https://albago.org"
              className="text-flame-300 hover:underline"
            >
              albago.org
            </a>
            .
          </p>
        </div>
      </section>

      {/* Quick factsheet */}
      <section className="px-4 pb-12">
        <div className="mx-auto grid max-w-3xl grid-cols-2 gap-3 sm:grid-cols-4">
          {FACTS.map((f) => (
            <div
              key={f.label}
              className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"
            >
              <div className="text-[10px] uppercase tracking-wide text-white/45">
                {f.label}
              </div>
              <div className="mt-2 text-base font-semibold text-white">
                {f.value}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Logos */}
      <section className="px-4 pb-12">
        <div className="mx-auto max-w-3xl rounded-3xl border border-white/10 bg-white/[0.03] p-6 sm:p-8">
          <div className="flex items-start gap-4">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl bg-flame-500/15 ring-1 ring-flame-500/30">
              <Palette className="h-5 w-5 text-flame-300" />
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-semibold text-white">Logo &amp; mark</h2>
              <p className="mt-2 text-sm leading-6 text-white/65">
                The AlbaGo mark is a flame-red rounded square with a white
                wordmark. On dark surfaces use the original; on light surfaces
                invert to a flame-red mark on a white background.
              </p>
            </div>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col items-center gap-4 rounded-2xl border border-white/10 bg-black p-6">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/AlbaGo_AG_Logo.svg"
                alt="AlbaGo logo on dark"
                className="h-24 w-auto"
              />
              <a
                href="/AlbaGo_AG_Logo.svg"
                download
                className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.04] px-4 py-2 text-xs font-semibold text-white/85 transition hover:bg-white/[0.10]"
              >
                <Download className="h-3.5 w-3.5" />
                Download SVG
              </a>
            </div>
            <div className="flex flex-col items-center gap-4 rounded-2xl border border-white/10 bg-white p-6">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/AlbaGo_AG_Logo.svg"
                alt="AlbaGo logo on light"
                className="h-24 w-auto"
              />
              <a
                href="/AlbaGo_AG_Logo.svg"
                download
                className="inline-flex items-center gap-2 rounded-full border border-black/15 bg-black/[0.06] px-4 py-2 text-xs font-semibold text-black transition hover:bg-black/[0.10]"
              >
                <Download className="h-3.5 w-3.5" />
                Download SVG
              </a>
            </div>
          </div>

          <p className="mt-4 text-[11px] text-white/45">
            Primary colours — flame red <code className="font-mono">#EE1C25</code>{' '}
            · ink black <code className="font-mono">#050505</code> · type{' '}
            <em>Instrument Serif</em> (display), <em>Geist</em> (body).
          </p>
        </div>
      </section>

      {/* Approved one-liners */}
      <section className="px-4 pb-12">
        <div className="mx-auto max-w-3xl rounded-3xl border border-white/10 bg-white/[0.03] p-6 sm:p-8">
          <div className="flex items-start gap-4">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl bg-flame-500/15 ring-1 ring-flame-500/30">
              <Quote className="h-5 w-5 text-flame-300" />
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-semibold text-white">
                Approved one-liners
              </h2>
              <p className="mt-2 text-sm leading-6 text-white/65">
                Pick whichever fits your space. Quote verbatim or paraphrase —
                both are fine.
              </p>
            </div>
          </div>

          <ul className="mt-6 space-y-3">
            {TAGLINES.map((line, i) => (
              <li
                key={i}
                className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 text-sm leading-6 text-white/85"
              >
                &ldquo;{line}&rdquo;
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Quick links to live surfaces (de-facto screenshots) */}
      <section className="px-4 pb-12">
        <div className="mx-auto max-w-3xl">
          <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-white/40">
            Live surfaces — use as screenshots
          </h2>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {[
              { href: '/', label: 'Homepage' },
              { href: '/protests', label: 'Protest directory' },
              { href: '/map', label: 'Interactive map' },
              { href: '/events', label: 'Event discovery' },
              {
                href: '/events/albanian-revolution',
                label: 'Albanian Revolution hub',
              },
            ].map((s) => (
              <a
                key={s.href}
                href={s.href}
                target="_blank"
                rel="noreferrer"
                className="group flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] p-4 transition hover:border-white/15 hover:bg-white/[0.05]"
              >
                <span className="text-sm font-semibold text-white">
                  {s.label}
                </span>
                <ExternalLink className="h-4 w-4 text-white/40 transition group-hover:translate-x-0.5 group-hover:text-white/70" />
              </a>
            ))}
          </div>
          <p className="mt-3 text-[11px] text-white/45">
            For high-resolution screenshots tailored to a specific story, email
            us — we can frame and crop to your spec.
          </p>
        </div>
      </section>

      {/* Press contact */}
      <section className="px-4 pb-24">
        <div className="mx-auto max-w-3xl rounded-3xl border border-flame-500/25 bg-gradient-to-br from-flame-500/[0.08] via-white/[0.02] to-transparent p-6 sm:p-8">
          <div className="flex items-start gap-4">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl bg-flame-500/15 ring-1 ring-flame-500/30">
              <Mail className="h-5 w-5 text-flame-300" />
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-semibold text-white">Press contact</h2>
              <p className="mt-2 text-sm leading-6 text-white/65">
                Interview requests, partnership outreach, fact-checking, and
                story pitches.
              </p>
              <a
                href={`mailto:${PRESS_EMAIL}?subject=Press%20inquiry%20%E2%80%94%20AlbaGo`}
                className="mt-5 inline-flex items-center gap-2 rounded-full bg-flame-500 px-5 py-2.5 text-sm font-semibold text-white shadow-[0_0_24px_-6px_rgba(238,28,37,0.55)] transition hover:bg-flame-400"
              >
                <Mail className="h-4 w-4" />
                {PRESS_EMAIL}
              </a>
              <p className="mt-3 text-[11px] text-white/45">
                We aim to respond within 5 working days.
              </p>
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}
