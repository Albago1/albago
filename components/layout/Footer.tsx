import Link from 'next/link'
import { MapPin } from 'lucide-react'

const exploreLinks = [
  { href: '/events', label: 'Events' },
  { href: '/protests', label: 'Protests' },
  { href: '/map', label: 'Map' },
  { href: '/pankartat', label: 'Pankartat' },
  { href: '/events/albanian-revolution', label: 'Albanian Revolution' },
]

const communityLinks = [
  { href: '/become-organizer', label: 'Become an organizer' },
  { href: '/submit-event', label: 'Submit an event' },
  { href: '/volunteer', label: 'Volunteer' },
  { href: '/sign-in', label: 'Sign in' },
]

const resourceLinks = [
  { href: '/pankartat/krijo', label: 'Placard editor' },
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/privacy', label: 'Privacy' },
]

export default function Footer() {
  const year = new Date().getFullYear()
  return (
    <footer className="relative mt-auto border-t border-white/10 bg-ink-950/80 text-white">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-flame-500/40 to-transparent" />

      <div className="mx-auto max-w-7xl px-6 py-14 sm:px-8">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr]">
          {/* Brand block */}
          <div className="flex flex-col gap-4">
            <Link href="/" className="inline-flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-flame-500 shadow-glow-flame">
                <MapPin className="h-5 w-5 text-white" />
              </span>
              <span className="text-2xl font-bold tracking-tight">
                Alba
                <span className="font-display italic font-normal text-flame-500">Go</span>
              </span>
            </Link>
            <p className="max-w-sm text-sm leading-relaxed text-white/55">
              A live worldwide directory for events, nightlife, and peaceful civic
              gatherings. Coordinated through AlbaGo.
            </p>
            <div className="text-xs text-white/40">
              Peaceful · Lawful · Family-friendly
            </div>
          </div>

          <FooterColumn title="Explore" links={exploreLinks} />
          <FooterColumn title="Community" links={communityLinks} />
          <FooterColumn title="Resources" links={resourceLinks} />
        </div>

        <div className="mt-12 flex flex-col gap-3 border-t border-white/5 pt-6 text-xs text-white/45 sm:flex-row sm:items-center sm:justify-between">
          <span>© {year} AlbaGo. All rights reserved.</span>
          <span>
            Built for the diaspora ·{' '}
            <Link href="/protests" className="underline-offset-2 hover:text-white hover:underline">
              For the land, for the people, for Albania
            </Link>
          </span>
        </div>
      </div>
    </footer>
  )
}

function FooterColumn({
  title,
  links,
}: {
  title: string
  links: Array<{ href: string; label: string }>
}) {
  return (
    <div className="flex flex-col gap-3">
      <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-white/45">
        {title}
      </span>
      <ul className="flex flex-col gap-2">
        {links.map((link) => (
          <li key={link.href}>
            <Link
              href={link.href}
              className="text-sm text-white/75 transition hover:text-flame-200"
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
