'use client'

import Link from 'next/link'
import {
  AlertTriangle,
  ArrowLeft,
  FileText,
  Flag,
  Gavel,
  Mail,
  ShieldCheck,
  UserCheck,
  Users,
  XCircle,
} from 'lucide-react'
import LandingNavbar from '@/components/layout/LandingNavbar'

const LAST_UPDATED = 'June 23, 2026'
const CONTACT_EMAIL = 'albago.org@gmail.com'

type Section = {
  icon: typeof FileText
  title: string
  body: string[]
}

const SECTIONS: Section[] = [
  {
    icon: FileText,
    title: '1. Acceptance',
    body: [
      'By creating an account or submitting any content on AlbaGo (albago.org), you agree to these Terms of Service and our Privacy Policy.',
      'If you do not agree, do not use the platform.',
      'These terms may be updated from time to time. Material changes are reflected in the "last updated" date at the top of this page.',
    ],
  },
  {
    icon: UserCheck,
    title: '2. Accounts & eligibility',
    body: [
      'You must be at least 16 years old to register an account.',
      'You are responsible for everything that happens under your account. Keep your password safe; tell us immediately if you suspect unauthorised access.',
      'One account per person. Multiple accounts to evade moderation or inflate vote counts will be removed.',
      'You may delete your account at any time by emailing us — see Contact below.',
    ],
  },
  {
    icon: Users,
    title: '3. Your content',
    body: [
      'You retain ownership of everything you submit: event listings, organizer profiles, placard photos, captions, volunteer signups.',
      'By submitting content, you grant AlbaGo a worldwide, non-exclusive, royalty-free licence to display, distribute, and share that content on the platform and in promotional material (e.g. share posters our team creates to promote listings).',
      'You confirm you have the right to share what you upload — including photos of other people, copyrighted material, or trademarks. If you don\'t own it, don\'t post it.',
      'AlbaGo does not pre-screen submissions. Content goes live after admin moderation where moderation exists (placards, organizer applications), and immediately where it does not (saved events, volunteer signups).',
    ],
  },
  {
    icon: ShieldCheck,
    title: '4. Acceptable use',
    body: [
      'Use AlbaGo for organising and discovering peaceful, lawful events: nightlife, culture, music, sports, civic gatherings.',
      'No content that incites violence, threatens individuals, promotes hate against any group, depicts illegal activity, or harasses other users.',
      'No spam, scraping, automated submissions, or attempts to overload the platform.',
      'No impersonation of other people, organizations, or political parties.',
      'For civic events: peaceful and lawful only. AlbaGo does not host calls to violence, riot, or illegal disruption.',
    ],
  },
  {
    icon: Flag,
    title: '5. Moderation & takedowns',
    body: [
      'Admins may remove any content, suspend or terminate accounts, and revoke organizer verification at any time and without notice if these terms are breached.',
      'If you believe content on AlbaGo infringes your rights or violates these terms, email us and we will review within 5 working days.',
      'We comply with valid legal requests from competent authorities in jurisdictions where we operate.',
    ],
  },
  {
    icon: UserCheck,
    title: '6. Organizer verification',
    body: [
      'Verified organizer status is granted at our discretion based on identity verification, event history, and community standing.',
      'Verified status does not constitute an endorsement of any event or organizer by AlbaGo, and may be revoked.',
      'Verified organizers may use additional tools (self-serve event reposting, organizer profile pages). Misuse of these tools forfeits verification.',
    ],
  },
  {
    icon: AlertTriangle,
    title: '7. Real-world risk & disclaimers',
    body: [
      'AlbaGo is an information platform. We do not organise, sponsor, or supervise any event listed on the site, including civic gatherings.',
      'You are responsible for your own safety when attending any event. Check local laws, follow organizer instructions, and use your own judgment.',
      'Event details (date, time, location, attendance) are submitted by users and may be inaccurate or out of date. Verify with the organizer before travelling.',
      'AlbaGo is provided "as is" without warranties of any kind. We are not liable for damages arising from event attendance, content accuracy, or platform downtime, to the maximum extent permitted by law.',
    ],
  },
  {
    icon: XCircle,
    title: '8. Termination',
    body: [
      'You may stop using AlbaGo at any time. To delete your account and associated data, email us.',
      'We may suspend or terminate access if these terms are breached, or if continued operation of the platform requires it.',
      'Sections that by their nature should survive termination (content licence for content already shared, liability disclaimers, governing law) will continue to apply.',
    ],
  },
  {
    icon: Gavel,
    title: '9. Governing law',
    body: [
      'These Terms are governed by the laws of the Republic of Albania.',
      'Any dispute that cannot be resolved by direct contact will be brought before the competent courts of Tirana, Albania.',
    ],
  },
  {
    icon: Mail,
    title: '10. Contact',
    body: [
      `General contact, moderation reports, deletion requests, copyright claims: ${CONTACT_EMAIL}.`,
      'We aim to respond within 5 working days.',
    ],
  },
]

export default function TermsClient() {
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
            <Gavel className="h-3.5 w-3.5" />
            Legal
          </p>

          <h1 className="display-text mt-5 text-5xl leading-[0.95] tracking-tight sm:text-7xl">
            Terms of <span className="italic text-flame-400">Service</span>
          </h1>

          <p className="mt-6 max-w-2xl text-base leading-7 text-white/65">
            The rules for using AlbaGo — what you agree to when you sign up, post
            content, or organise an event through the platform.
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
            Questions about these terms?{' '}
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              className="text-flame-300 hover:underline"
            >
              {CONTACT_EMAIL}
            </a>
            . You can also read our{' '}
            <Link href="/privacy" className="text-flame-300 hover:underline">
              Privacy Policy
            </Link>
            .
          </p>
        </div>
      </section>
    </main>
  )
}
