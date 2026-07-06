'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Calendar, Compass, Home, Megaphone } from 'lucide-react'
import { useLanguage } from '@/lib/i18n/LanguageProvider'

type NavItem = {
  href: string
  labelKey: string
  icon: typeof Home
  match: (pathname: string) => boolean
}

const items: NavItem[] = [
  {
    href: '/',
    labelKey: 'nav_home',
    icon: Home,
    match: (p) => p === '/',
  },
  {
    href: '/events',
    labelKey: 'nav_events',
    icon: Calendar,
    match: (p) => p === '/events' || p.startsWith('/events/'),
  },
  {
    href: '/protests',
    labelKey: 'nav_protests',
    icon: Megaphone,
    match: (p) =>
      p === '/protests' ||
      p.startsWith('/protests/') ||
      p.startsWith('/movements/') ||
      p.startsWith('/pankartat'),
  },
  {
    href: '/map',
    labelKey: 'nav_map',
    icon: Compass,
    match: (p) => p === '/map',
  },
]

// Routes where the bottom nav is suppressed — admin / dashboard / organizer
// surfaces are deeper workflows and the bar would distract from the task.
const SUPPRESS_PREFIXES = ['/admin', '/dashboard', '/organizer', '/onboarding', '/sign-in', '/sign-up', '/forgot-password', '/reset-password', '/auth']

export default function MobileBottomNav() {
  const { t } = useLanguage()
  const pathname = usePathname() ?? '/'
  if (SUPPRESS_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return null
  }

  return (
    <nav
      aria-label="Primary mobile navigation"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-ink-950/85 backdrop-blur-xl sm:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <ul className="mx-auto flex max-w-md items-stretch justify-around px-2 py-1.5">
        {items.map((item) => {
          const active = item.match(pathname)
          const Icon = item.icon
          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                className={[
                  'flex flex-col items-center gap-0.5 rounded-xl px-2 py-1.5 text-[10px] font-semibold transition',
                  active
                    ? 'text-flame-200'
                    : 'text-white/55 active:text-white/80',
                ].join(' ')}
                aria-current={active ? 'page' : undefined}
              >
                <span
                  className={[
                    'flex h-9 w-9 items-center justify-center rounded-full transition',
                    active
                      ? 'bg-flame-500/15 ring-1 ring-flame-500/35'
                      : 'bg-transparent',
                  ].join(' ')}
                >
                  <Icon className="h-4 w-4" />
                </span>
                <span className="leading-none">{t(item.labelKey)}</span>
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
