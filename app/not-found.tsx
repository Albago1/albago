import Link from 'next/link'
import { Calendar, Compass, Home, MapPin } from 'lucide-react'
import LandingNavbar from '@/components/layout/LandingNavbar'

export default function NotFound() {
  return (
    <div className="relative min-h-screen bg-ink-950 text-white">
      <LandingNavbar />

      <section className="relative isolate overflow-hidden pt-28 sm:pt-32">
        <div className="absolute inset-0 -z-10">
          <div className="absolute inset-0 bg-grid opacity-50" />
          <div className="absolute inset-0 bg-radial-flame" />
        </div>

        <div className="mx-auto max-w-3xl px-5 sm:px-8 pb-20">
          <div className="inline-flex items-center gap-2 rounded-full border border-flame-500/40 bg-flame-500/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.22em] text-flame-200">
            <span className="relative inline-flex h-2 w-2 items-center justify-center">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-flame-400 opacity-70" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-flame-400" />
            </span>
            <span>404 · Not Found</span>
          </div>

          <h1
            className="display-text mt-6 text-5xl sm:text-7xl leading-[0.95] tracking-tight"
          >
            We couldn&apos;t <span className="italic text-flame-400">find that</span>.
          </h1>

          <p className="mt-5 max-w-xl text-base sm:text-lg leading-relaxed text-white/65">
            The page might have moved, the link could be wrong, or the event you&apos;re
            looking for has already wrapped up. Try one of these instead.
          </p>

          <div className="mt-10 grid gap-3 sm:grid-cols-2">
            <CardLink
              href="/"
              icon={Home}
              title="Home"
              hint="Start over from the landing page"
            />
            <CardLink
              href="/events"
              icon={Calendar}
              title="Events"
              hint="Browse live, upcoming and recurring events"
            />
            <CardLink
              href="/protests"
              icon={MapPin}
              title="Protests"
              hint="Worldwide directory of civic gatherings"
            />
            <CardLink
              href="/map"
              icon={Compass}
              title="Map"
              hint="See what's happening near you"
            />
          </div>
        </div>
      </section>
    </div>
  )
}

function CardLink({
  href,
  icon: Icon,
  title,
  hint,
}: {
  href: string
  icon: typeof Home
  title: string
  hint: string
}) {
  return (
    <Link
      href={href}
      className="group flex items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.02] p-4 transition hover:border-flame-500/40 hover:bg-white/[0.04]"
    >
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-flame-500/10 text-flame-300 ring-1 ring-flame-500/30 transition group-hover:bg-flame-500/15">
        <Icon className="h-5 w-5" />
      </span>
      <span className="flex flex-col">
        <span className="text-sm font-semibold text-white">{title}</span>
        <span className="text-xs text-white/55">{hint}</span>
      </span>
    </Link>
  )
}
