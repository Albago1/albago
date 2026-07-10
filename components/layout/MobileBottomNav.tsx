'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Calendar, CircleUserRound, Compass, Home, Megaphone } from 'lucide-react'
import { useLanguage } from '@/lib/i18n/LanguageProvider'
import { createClient } from '@/lib/supabase/browser'

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

// Routes where the bottom nav is suppressed — admin / organizer / auth
// surfaces are deeper workflows and the bar would distract from the task.
// /dashboard stays visible: it is the Profile tab's destination.
const SUPPRESS_PREFIXES = ['/admin', '/organizer', '/onboarding', '/sign-in', '/sign-up', '/forgot-password', '/reset-password', '/auth']

export default function MobileBottomNav() {
  const { t } = useLanguage()
  const pathname = usePathname() ?? '/'
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [shrunk, setShrunk] = useState(false)

  useEffect(() => {
    const supabase = createClient()

    supabase.auth.getUser().then(({ data: { user } }) => {
      setUserEmail(user?.email ?? null)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserEmail(session?.user?.email ?? null)
    })

    return () => subscription.unsubscribe()
  }, [])

  // Instagram behavior: scrolling down condenses the pill, scrolling up
  // restores it to full size. A small delta threshold avoids jitter from
  // momentum/bounce scrolling.
  useEffect(() => {
    let lastY = window.scrollY
    const onScroll = () => {
      const y = window.scrollY
      const delta = y - lastY
      if (y < 24) {
        setShrunk(false)
      } else if (delta > 6) {
        setShrunk(true)
      } else if (delta < -6) {
        setShrunk(false)
      }
      lastY = y
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  if (SUPPRESS_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return null
  }

  const profileActive = pathname.startsWith('/dashboard')

  return (
    <nav
      aria-label="Primary mobile navigation"
      className="pointer-events-none fixed inset-x-0 z-40 flex justify-center sm:hidden"
      style={{ bottom: 'calc(0.125rem + env(safe-area-inset-bottom))' }}
    >
      <ul
        className={[
          'pointer-events-auto mx-3 flex w-full max-w-md origin-bottom items-center justify-around rounded-full border border-white/10 bg-ink-950/70 px-2 py-1.5 shadow-[0_10px_36px_rgba(0,0,0,0.45)] backdrop-blur-2xl transition-transform duration-300 ease-out',
          shrunk ? 'scale-[0.85]' : 'scale-100',
        ].join(' ')}
      >
        {items.map((item) => {
          const active = item.match(pathname)
          const Icon = item.icon
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-label={t(item.labelKey)}
                aria-current={active ? 'page' : undefined}
                className={[
                  'flex h-10 w-[3.25rem] items-center justify-center rounded-full transition active:bg-white/10',
                  active ? 'bg-white/15 text-white' : 'text-white/50',
                ].join(' ')}
              >
                <Icon
                  className={['h-[22px] w-[22px] transition-transform', active ? 'scale-105' : ''].join(' ')}
                  strokeWidth={active ? 2.4 : 1.9}
                />
              </Link>
            </li>
          )
        })}
        <li>
          <Link
            href={userEmail ? '/dashboard' : '/sign-in?next=/dashboard'}
            aria-label={userEmail ? t('nav_dashboard') : t('sign_in')}
            aria-current={profileActive ? 'page' : undefined}
            className={[
              'flex h-10 w-[3.25rem] items-center justify-center rounded-full transition active:bg-white/10',
              profileActive ? 'bg-white/15 text-white' : 'text-white/50',
            ].join(' ')}
          >
            {userEmail ? (
              <span
                className={[
                  'flex h-7 w-7 items-center justify-center rounded-full bg-flame-500 text-xs font-bold text-[#fff] transition',
                  profileActive ? 'ring-2 ring-current' : 'ring-1 ring-white/20',
                ].join(' ')}
              >
                {userEmail[0].toUpperCase()}
              </span>
            ) : (
              <CircleUserRound
                className={['h-[22px] w-[22px] transition-transform', profileActive ? 'scale-105' : ''].join(' ')}
                strokeWidth={profileActive ? 2.4 : 1.9}
              />
            )}
          </Link>
        </li>
      </ul>
    </nav>
  )
}
