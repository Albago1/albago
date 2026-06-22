import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft, HelpCircle, Plus } from 'lucide-react'
import LandingNavbar from '@/components/layout/LandingNavbar'

export const metadata: Metadata = {
  title: 'FAQ — AlbaGo',
  description:
    'Common questions about AlbaGo — how to organize events, get verified, post protests, and protect your data.',
  openGraph: {
    title: 'FAQ — AlbaGo',
    description:
      'Common questions about organising on AlbaGo, getting verified, posting protests, and account control.',
    type: 'website',
  },
}

const CONTACT_EMAIL = 'albago.org@gmail.com'

type Faq = { q: string; a: React.ReactNode }

const FAQS: Faq[] = [
  {
    q: 'What is AlbaGo?',
    a: (
      <>
        AlbaGo is a discovery platform for events, venues, and civic gatherings
        across Albania and the worldwide Albanian diaspora. From a Tirana club
        night to a peaceful protest in Berlin, you find it on the same map.
      </>
    ),
  },
  {
    q: 'Is it free to organize events on AlbaGo?',
    a: (
      <>
        Yes. Free to register as an organizer, free to publish events, free to
        be discovered. We don&apos;t take a cut of ticket sales and we
        don&apos;t run ads against community events.
      </>
    ),
  },
  {
    q: 'How do I sign up as an organizer?',
    a: (
      <>
        Go to{' '}
        <Link href="/become-organizer" className="text-flame-300 hover:underline">
          /become-organizer
        </Link>{' '}
        and follow the 3-step wizard: profile, event types, confirm. Takes about
        two minutes. You can create events right after.
      </>
    ),
  },
  {
    q: 'Why does my first event need admin approval?',
    a: (
      <>
        New organizers (Unverified tier) get one moderation pass before going
        live to protect the platform from spam and to make sure event details
        are clean. Once you&apos;ve had 2 events approved in 90 days,
        you&apos;re auto-promoted to <strong>Established</strong> and your
        future events publish instantly.
      </>
    ),
  },
  {
    q: 'What is the difference between Unverified, Established, and Verified?',
    a: (
      <>
        <strong>Unverified</strong> — every event reviewed before publishing.
        <br />
        <strong>Established</strong> — events publish instantly. Earned
        automatically after 2 approved events in 90 days. No public badge.
        <br />
        <strong>Verified</strong> — instant publishing plus a public badge on
        your organizer profile. Requires submitting an ID document at{' '}
        <Link href="/organizer/verification" className="text-flame-300 hover:underline">
          /organizer/verification
        </Link>{' '}
        for a manual admin review.
      </>
    ),
  },
  {
    q: 'What kinds of events can I post?',
    a: (
      <>
        Nightlife, music, culture, sports, food, festivals, pop-ups, civic
        gatherings, protests. The platform is general-purpose. The only hard
        rules are in our{' '}
        <Link href="/terms" className="text-flame-300 hover:underline">
          Terms of Service
        </Link>
        : no calls to violence, no illegal activity, no impersonation, no
        harassment.
      </>
    ),
  },
  {
    q: 'Can I post a protest?',
    a: (
      <>
        Yes — peaceful, lawful civic gatherings are welcome. Submit at{' '}
        <Link href="/submit-event" className="text-flame-300 hover:underline">
          /submit-event
        </Link>{' '}
        with the &ldquo;Civic / Protest&rdquo; category. We also have a
        dedicated discovery surface at{' '}
        <Link href="/protests" className="text-flame-300 hover:underline">
          /protests
        </Link>
        . AlbaGo does not host calls to violence, riot, or illegal disruption.
      </>
    ),
  },
  {
    q: 'How does Pankartat work?',
    a: (
      <>
        Pankartat is a community gallery of real protest placards. Bring your
        sign to a demonstration, snap a phone photo, upload it at{' '}
        <Link href="/pankartat" className="text-flame-300 hover:underline">
          /pankartat
        </Link>
        . An admin reviews it briefly, then it joins the public wall where
        anyone can like, download, and share it.
      </>
    ),
  },
  {
    q: 'Who can see my data?',
    a: (
      <>
        Account details, saved events, drafts, and submissions are private to
        you and platform admins. Published events and organizer profiles are
        public — that&apos;s the point. We don&apos;t sell data to advertisers,
        we don&apos;t run third-party analytics or marketing pixels. Full
        breakdown in our{' '}
        <Link href="/privacy" className="text-flame-300 hover:underline">
          Privacy Policy
        </Link>
        .
      </>
    ),
  },
  {
    q: 'How do I delete my account?',
    a: (
      <>
        From{' '}
        <Link href="/dashboard" className="text-flame-300 hover:underline">
          /dashboard
        </Link>{' '}
        scroll to &ldquo;Account&rdquo; → &ldquo;Request account deletion&rdquo;.
        That opens a prefilled email to us. We action requests within 30 days as
        required by GDPR.
      </>
    ),
  },
  {
    q: 'Where can I report a bug or content I think does not belong?',
    a: (
      <>
        For uploaded placards there&apos;s a flag icon on every card — one tap
        sends it to admin review. For everything else email{' '}
        <a
          href={`mailto:${CONTACT_EMAIL}`}
          className="text-flame-300 hover:underline"
        >
          {CONTACT_EMAIL}
        </a>{' '}
        or use the{' '}
        <Link href="/contact" className="text-flame-300 hover:underline">
          contact form
        </Link>
        . We aim to respond within 5 working days.
      </>
    ),
  },
]

export default function FaqPage() {
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
            <HelpCircle className="h-3.5 w-3.5" />
            FAQ
          </p>

          <h1 className="display-text mt-5 text-5xl leading-[0.95] tracking-tight sm:text-7xl">
            Frequently asked{' '}
            <span className="italic text-flame-400">questions</span>
          </h1>

          <p className="mt-6 max-w-2xl text-base leading-7 text-white/65">
            Short, honest answers to the questions organizers and visitors ask
            most.
          </p>
        </div>
      </section>

      <section className="px-4 pb-24">
        <div className="mx-auto max-w-3xl space-y-3">
          {FAQS.map((f, i) => (
            <details
              key={i}
              className="group rounded-3xl border border-white/10 bg-white/[0.03] open:border-flame-500/30 open:bg-flame-500/[0.04]"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-5 sm:p-6">
                <span className="text-base font-semibold text-white sm:text-lg">
                  {f.q}
                </span>
                <Plus className="h-4 w-4 flex-shrink-0 text-white/45 transition group-open:rotate-45 group-open:text-flame-300" />
              </summary>
              <div className="px-5 pb-6 text-sm leading-7 text-white/70 sm:px-6">
                {f.a}
              </div>
            </details>
          ))}

          <p className="mt-8 text-center text-xs text-white/45">
            Still stuck?{' '}
            <Link href="/contact" className="text-flame-300 hover:underline">
              Contact us
            </Link>
            . We read every message.
          </p>
        </div>
      </section>
    </main>
  )
}
