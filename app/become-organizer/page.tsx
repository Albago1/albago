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
    title: 'Publish in minutes',
    desc: 'Create an event, add your details, and go live — no lengthy approval wait.',
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

export default function BecomeOrganizerPage() {
  return (
    <>
      <LandingNavbar />
      <main className="min-h-screen bg-[#070b14] px-6 pb-20 pt-24 text-white">
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
              Reach people discovering what&apos;s happening tonight. Create, publish, and manage your events in minutes.
            </p>

            <Link
              href="/onboarding/organizer"
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-8 py-3.5 text-base font-semibold text-white transition hover:bg-blue-500"
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
                <div className="mt-0.5 flex-shrink-0 rounded-xl border border-blue-500/20 bg-blue-600/15 p-2.5">
                  <Icon className="h-4 w-4 text-blue-400" />
                </div>
                <div>
                  <p className="mb-1 text-sm font-semibold">{title}</p>
                  <p className="text-sm leading-relaxed text-white/50">{desc}</p>
                </div>
              </div>
            ))}
          </div>

        </div>
      </main>
    </>
  )
}
