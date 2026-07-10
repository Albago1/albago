'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion } from 'framer-motion'
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

// Shared-layout bubble that glides between tabs when the section changes.
function ActiveBubble() {
  return (
    <motion.span
      layoutId="mobile-nav-bubble"
      className="absolute inset-0 rounded-full bg-white/15"
      transition={{ type: 'spring', stiffness: 380, damping: 32 }}
    />
  )
}

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

  // The mobile browser's own UI (Safari's bottom search bar, Chrome's
  // toolbar) expands and collapses over fixed-bottom elements, and page
  // pinch-zoom detaches them entirely. Track the visual viewport and lift
  // the pill by however much of the layout viewport is currently covered,
  // so it always rides just above the browser chrome — and duck out of the
  // way entirely when the on-screen keyboard is up.
  const [chromeOffset, setChromeOffset] = useState(0)
  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return
    const update = () => {
      setChromeOffset(Math.max(0, window.innerHeight - vv.height - vv.offsetTop))
    }
    update()
    vv.addEventListener('resize', update)
    vv.addEventListener('scroll', update)
    return () => {
      vv.removeEventListener('resize', update)
      vv.removeEventListener('scroll', update)
    }
  }, [])
  const keyboardOpen = chromeOffset > 150

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

  if (keyboardOpen) {
    return null
  }

  const profileActive = pathname.startsWith('/dashboard')

  return (
    <nav
      aria-label="Primary mobile navigation"
      className="pointer-events-none fixed inset-x-0 z-40 flex justify-center sm:hidden"
      style={{
        bottom: `calc(0.125rem + env(safe-area-inset-bottom) + ${chromeOffset}px)`,
      }}
    >
      <ul
        className={[
          'pointer-events-auto mx-3 flex w-full max-w-md origin-bottom items-center justify-around rounded-full border border-white/10 bg-ink-800/80 px-2 py-2 shadow-[0_10px_36px_rgba(0,0,0,0.45)] backdrop-blur-2xl transition-transform duration-300 ease-out',
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
                  'relative flex h-12 w-14 items-center justify-center rounded-full transition active:bg-white/10',
                  active ? 'text-white' : 'text-white/50',
                ].join(' ')}
              >
                {active && <ActiveBubble />}
                <Icon
                  className={['relative h-6 w-6 transition-transform', active ? 'scale-105' : ''].join(' ')}
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
              'relative flex h-12 w-14 items-center justify-center rounded-full transition active:bg-white/10',
              profileActive ? 'text-white' : 'text-white/50',
            ].join(' ')}
          >
            {profileActive && <ActiveBubble />}
            {userEmail ? (
              <span
                className={[
                  'relative flex h-8 w-8 items-center justify-center rounded-full bg-flame-500 text-sm font-bold text-[#fff] transition',
                  profileActive ? 'ring-2 ring-current' : 'ring-1 ring-white/20',
                ].join(' ')}
              >
                {userEmail[0].toUpperCase()}
              </span>
            ) : (
              <CircleUserRound
                className={['relative h-6 w-6 transition-transform', profileActive ? 'scale-105' : ''].join(' ')}
                strokeWidth={profileActive ? 2.4 : 1.9}
              />
            )}
          </Link>
        </li>
      </ul>
    </nav>
  )
}
