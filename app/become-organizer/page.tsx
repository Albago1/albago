import type { Metadata } from 'next'
import Link from 'next/link'
import { Calendar, Users, Zap } from 'lucide-react'
import LandingNavbar from '@/components/layout/LandingNavbar'

export const metadata: Metadata = {
  title: 'Become an Organizer',
}

const VALUE_PROPS = [
  {
    icon: Calendar,
    title: 'Submit in minutes',
    desc: 'Create an event and send it in. Trusted organizers publish instantly; new organizers get a quick first-event review.',
  },
  {
    icon: Users,
    title: 'Reach your audience',
    desc: 'AlbaGo users discover events by location and category every day.',
  },
  {
    icon: Zap,
    title: 'Built for nightlife',
    desc: 'Designed for clubs, festivals, pop-ups, and every event in between.',
  },
]

const APPROVAL_STEPS = [
  {
    title: 'Create organizer profile',
    desc: 'Free, takes about two minutes.',
  },
  {
    title: 'Submit first event',
    desc: 'Add your details and send it in.',
  },
  {
    title: 'AlbaGo reviews it',
    desc: 'A quick human check to keep the platform clean.',
  },
  {
    title: 'Build trust and unlock instant publishing',
    desc: 'After 2 approved events in 90 days, your events go live instantly.',
  },
]

export default function BecomeOrganizerPage() {
  return (
    <>
      <LandingNavbar />
      <main className="min-h-screen bg-ink-950 px-6 pb-20 pt-24 text-white">
        <div className="mx-auto max-w-lg">

          {/* Hero */}
          <div className="flex flex-col items-center text-center pt-8 pb-14">
            <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-1.5 text-xs text-white/50">
              <Zap className="h-3 w-3" />
              For event organizers
            </div>

            <h1 className="mb-4 text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
              Bring your events<br />to AlbaGo
            </h1>

            <p className="mb-10 max-w-sm text-base leading-relaxed text-white/50 sm:text-lg">
              Reach people discovering what&apos;s happening tonight. Create and submit your event in minutes. Trusted organizers can publish instantly; new organizers receive a quick first-event review.
            </p>

            <Link
              href="/onboarding/organizer"
              className="inline-flex items-center gap-2 rounded-xl bg-flame-500 px-8 py-3.5 text-base font-semibold text-white transition hover:bg-flame-400"
            >
              Get started — it&apos;s free
            </Link>

            <p className="mt-4 text-xs text-white/30">
              Already an organizer?{' '}
              <Link
                href="/organizer"
                className="text-white/50 underline underline-offset-2 transition hover:text-white/70"
              >
                Go to your dashboard
              </Link>
            </p>
          </div>

          {/* Value props */}
          <div className="space-y-3">
            {VALUE_PROPS.map(({ icon: Icon, title, desc }) => (
              <div
                key={title}
                className="flex items-start gap-4 rounded-3xl border border-white/10 bg-white/[0.03] p-5"
              >
                <div className="mt-0.5 flex-shrink-0 rounded-xl border border-flame-500/30 bg-flame-500/15 p-2.5">
                  <Icon className="h-4 w-4 text-flame-400" />
                </div>
                <div>
                  <p className="mb-1 text-sm font-semibold">{title}</p>
                  <p className="text-sm leading-relaxed text-white/50">{desc}</p>
                </div>
              </div>
            ))}
          </div>

          {/* How publishing works */}
          <div className="mt-12">
            <h2 className="text-center text-xs font-semibold uppercase tracking-[0.18em] text-white/40">
              How publishing works
            </h2>
            <ol className="mt-6 rounded-3xl border border-white/10 bg-white/[0.03] p-6">
              {APPROVAL_STEPS.map((step, i) => (
                <li key={step.title} className="relative flex gap-4 pb-7 last:pb-0">
                  {i < APPROVAL_STEPS.length - 1 && (
                    <span
                      aria-hidden
                      className="absolute left-4 top-9 h-[calc(100%-2.25rem)] w-px bg-white/10"
                    />
                  )}
                  <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border border-flame-500/30 bg-flame-500/15 text-sm font-semibold text-flame-400">
                    {i + 1}
                  </span>
                  <div className="pt-1">
                    <p className="text-sm font-semibold">{step.title}</p>
                    <p className="mt-1 text-sm leading-relaxed text-white/50">
                      {step.desc}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </div>

        </div>
      </main>
    </>
  )
}
