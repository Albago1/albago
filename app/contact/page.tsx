import type { Metadata } from 'next'
import Link from 'next/link'
import {
  ArrowLeft,
  ArrowRight,
  Bug,
  Handshake,
  Mail,
  MessageSquare,
  Newspaper,
} from 'lucide-react'
import LandingNavbar from '@/components/layout/LandingNavbar'

export const metadata: Metadata = {
  title: 'Contact — AlbaGo',
  description:
    'Get in touch with the AlbaGo team — general questions, partnership, press, bug reports.',
  openGraph: {
    title: 'Contact AlbaGo',
    description:
      'General questions, partnership, press, bug reports. We respond within 5 working days.',
    type: 'website',
  },
}

const EMAIL = 'albago.org@gmail.com'

function mailto(subject: string, body: string): string {
  return `mailto:${EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
}

type Channel = {
  icon: typeof Mail
  title: string
  description: string
  href: string
  label: string
}

const CHANNELS: Channel[] = [
  {
    icon: MessageSquare,
    title: 'General question',
    description: 'How something works, account help, anything else.',
    href: mailto(
      'AlbaGo — general question',
      [
        'Hi AlbaGo team,',
        '',
        '<your question here>',
        '',
        'Thanks.',
      ].join('\n'),
    ),
    label: 'Email us',
  },
  {
    icon: Handshake,
    title: 'Partnership or collaboration',
    description:
      'You organise events, run a venue, or represent a community group and want to work together.',
    href: mailto(
      'AlbaGo — partnership inquiry',
      [
        'Hi AlbaGo team,',
        '',
        'Organisation: <name>',
        'City / country: ',
        'What we do: ',
        'What we are proposing: ',
        '',
        'Thanks.',
      ].join('\n'),
    ),
    label: 'Send proposal',
  },
  {
    icon: Newspaper,
    title: 'Press / media',
    description:
      'Journalist, podcaster, or researcher covering Albanian civic tech, diaspora life, or independent platforms.',
    href: mailto(
      'AlbaGo — press inquiry',
      [
        'Hi AlbaGo team,',
        '',
        'Outlet: ',
        'Story / angle: ',
        'Deadline: ',
        'What we need from you: ',
        '',
        'Thanks.',
      ].join('\n'),
    ),
    label: 'Reach press',
  },
  {
    icon: Bug,
    title: 'Bug or content report',
    description:
      'Something is broken, or you have spotted content that should not be on the platform.',
    href: mailto(
      'AlbaGo — bug or content report',
      [
        'Hi AlbaGo team,',
        '',
        'URL: ',
        'What you expected: ',
        'What happened instead: ',
        'Device / browser: ',
        '',
        'Thanks.',
      ].join('\n'),
    ),
    label: 'Report issue',
  },
]

export default function ContactPage() {
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
            <Mail className="h-3.5 w-3.5" />
            Contact
          </p>

          <h1 className="display-text mt-5 text-5xl leading-[0.95] tracking-tight sm:text-7xl">
            Get in <span className="italic text-flame-400">touch</span>
          </h1>

          <p className="mt-6 max-w-2xl text-base leading-7 text-white/65">
            One inbox, four reasons to write. Pick the closest fit — we read
            every message and aim to respond within 5 working days.
          </p>
        </div>
      </section>

      <section className="px-4 pb-12">
        <div className="mx-auto grid max-w-3xl gap-3 sm:grid-cols-2">
          {CHANNELS.map((c) => {
            const Icon = c.icon
            return (
              <a
                key={c.title}
                href={c.href}
                className="group flex flex-col rounded-3xl border border-white/10 bg-white/[0.03] p-6 transition hover:border-flame-500/30 hover:bg-flame-500/[0.04]"
              >
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl bg-flame-500/15 ring-1 ring-flame-500/30">
                    <Icon className="h-5 w-5 text-flame-300" />
                  </div>
                  <div className="flex-1">
                    <h2 className="text-base font-semibold text-white">
                      {c.title}
                    </h2>
                    <p className="mt-1 text-sm leading-snug text-white/55">
                      {c.description}
                    </p>
                  </div>
                </div>
                <span className="mt-5 inline-flex items-center gap-2 self-start rounded-full border border-white/15 bg-white/[0.04] px-3 py-1.5 text-xs font-semibold text-white/85 transition group-hover:border-flame-500/40 group-hover:bg-flame-500/10 group-hover:text-flame-100">
                  {c.label}
                  <ArrowRight className="h-3.5 w-3.5" />
                </span>
              </a>
            )
          })}
        </div>
      </section>

      <section className="px-4 pb-24">
        <div className="mx-auto max-w-3xl rounded-3xl border border-white/10 bg-white/[0.03] p-6 text-center">
          <p className="text-sm text-white/65">
            Prefer plain email? Write to{' '}
            <a
              href={`mailto:${EMAIL}`}
              className="text-flame-300 hover:underline"
            >
              {EMAIL}
            </a>{' '}
            with whatever subject you like.
          </p>
        </div>
      </section>
    </main>
  )
}
