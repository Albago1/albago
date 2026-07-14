'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Building2,
  LogIn,
  LogOut,
  Map,
  MapPin,
  Megaphone,
  Plus,
  Menu,
  X,
  LayoutDashboard,
  Calendar,
  Flame,
  ShieldCheck,
} from 'lucide-react'
import LanguageSwitcher from '@/components/layout/LanguageSwitcher'
import ThemeToggle from '@/components/layout/ThemeToggle'
import { useLanguage } from '@/lib/i18n/LanguageProvider'
import { createClient } from '@/lib/supabase/browser'

export default function LandingNavbar() {
  const pathname = usePathname()
  const router = useRouter()
  const { t } = useLanguage()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false)
  const userMenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const supabase = createClient()

    const syncUser = async (userId: string | null, email: string | null) => {
      setUserEmail(email)
      if (userId) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', userId)
          .maybeSingle()
        setIsAdmin(profile?.role === 'admin')
      } else {
        setIsAdmin(false)
      }
    }

    supabase.auth.getUser().then(({ data: { user } }) => {
      syncUser(user?.id ?? null, user?.email ?? null)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      syncUser(session?.user?.id ?? null, session?.user?.email ?? null)
    })

    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setIsUserMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleSignOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    setMobileMenuOpen(false)
    router.push('/')
    router.refresh()
  }

  const isMapRoute = pathname === '/map'

  // No "Home" item — the logo is the home link (audit §30). Protests stays
  // top-level: the civic wedge is the product's trust engine (bible rule),
  // not a "More"-menu afterthought.
  const navItems = [
    { href: '/events', label: t('nav_events'), icon: Calendar, active: pathname === '/events' },
    {
      href: '/protests',
      label: t('nav_protests'),
      icon: Flame,
      active: pathname === '/protests' || pathname.startsWith('/events/albanian-revolution'),
    },
    { href: '/map', label: t('nav_map'), icon: Map, active: pathname === '/map' },
    {
      href: '/cities',
      label: t('nav_cities'),
      icon: Building2,
      active: pathname === '/cities' || pathname.startsWith('/city/'),
    },
    {
      href: '/organizers',
      label: t('footer_link_organizers'),
      icon: Megaphone,
      active: pathname === '/organizers' || pathname.startsWith('/organizers/'),
    },
    {
      href: '/submit-event',
      label: t('nav_submit_event'),
      icon: Plus,
      active: pathname === '/submit-event',
    },
    ...(userEmail
      ? [
          {
            href: '/dashboard',
            label: t('nav_dashboard'),
            icon: LayoutDashboard,
            active: pathname === '/dashboard',
          },
        ]
      : []),
  ]

  return (
    <nav className={`fixed inset-x-0 top-0 z-50 backdrop-blur-xl ${isMapRoute ? 'border-b border-white/[0.06] bg-ink-950/55' : 'border-b border-white/10 bg-ink-950/80'}`}>
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
        <Link
          href="/"
          className="flex items-center gap-3"
          onClick={() => setMobileMenuOpen(false)}
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-flame-500 shadow-glow-flame">
            <MapPin className="h-5 w-5 text-white" />
          </div>

          <span className="text-2xl font-bold tracking-tight text-white">
            Alba<span className="font-display italic font-normal text-flame-500">Go</span>
          </span>
        </Link>

        {/* Desktop taskbar — floating glass pill; the flame highlight slides
            between items via the shared layoutId. Icon-only below lg. */}
        <div className="hidden items-center rounded-full border border-white/10 bg-white/[0.04] p-1.5 shadow-[0_8px_32px_rgba(0,0,0,0.45)] ring-1 ring-white/[0.04] backdrop-blur-xl md:flex">
          {navItems.map((item) => {
            const Icon = item.icon

            return (
              <Link
                key={item.href}
                href={item.href}
                title={item.label}
                aria-label={item.label}
                className={[
                  'relative inline-flex items-center gap-2 rounded-full px-3.5 py-2 text-sm font-medium transition',
                  item.active
                    ? 'text-white'
                    : 'text-white/70 hover:bg-white/[0.06] hover:text-white',
                ].join(' ')}
              >
                {item.active && (
                  <motion.span
                    layoutId="nav-active-pill"
                    transition={{ type: 'spring', bounce: 0.25, duration: 0.55 }}
                    className="absolute inset-0 rounded-full bg-flame-500 shadow-glow-flame"
                  />
                )}
                <Icon className="relative z-10 h-4 w-4" />
                <span className="relative z-10 hidden lg:inline">{item.label}</span>
              </Link>
            )
          })}
        </div>

        <div className="hidden items-center gap-2 md:flex">
          <ThemeToggle />
          <LanguageSwitcher />

          {userEmail ? (
            <div className="relative" ref={userMenuRef}>
              <button
                type="button"
                onClick={() => setIsUserMenuOpen((prev) => !prev)}
                aria-expanded={isUserMenuOpen}
                aria-label="Account menu"
                className={[
                  'flex h-9 w-9 items-center justify-center rounded-full bg-flame-500 text-sm font-bold text-white shadow-glow-flame ring-2 transition hover:scale-105',
                  isUserMenuOpen ? 'ring-white/30' : 'ring-transparent hover:ring-white/20',
                ].join(' ')}
              >
                {userEmail[0].toUpperCase()}
              </button>

              <AnimatePresence>
                {isUserMenuOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 6, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 6, scale: 0.98 }}
                    transition={{ duration: 0.16, ease: 'easeOut' }}
                    className="absolute right-0 top-[calc(100%+0.65rem)] z-50 w-60 overflow-hidden rounded-2xl border border-white/10 bg-ink-900 shadow-2xl"
                  >
                    <div className="flex items-center gap-3 border-b border-white/[0.06] px-4 py-3.5">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-flame-500 text-sm font-bold text-white">
                        {userEmail[0].toUpperCase()}
                      </span>
                      <span className="min-w-0">
                        <span className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-white/35">
                          Signed in
                        </span>
                        <span className="block truncate text-sm font-medium text-white">
                          {userEmail}
                        </span>
                      </span>
                    </div>

                    <div className="p-1.5">
                      <Link
                        href="/dashboard"
                        onClick={() => setIsUserMenuOpen(false)}
                        className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-white/80 transition hover:bg-white/[0.06] hover:text-white"
                      >
                        <LayoutDashboard className="h-4 w-4 opacity-70" />
                        Dashboard
                      </Link>
                      {isAdmin && (
                        <Link
                          href="/admin"
                          onClick={() => setIsUserMenuOpen(false)}
                          className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-white/80 transition hover:bg-white/[0.06] hover:text-white"
                        >
                          <ShieldCheck className="h-4 w-4 opacity-70" />
                          Admin
                        </Link>
                      )}
                    </div>

                    <div className="border-t border-white/[0.06] p-1.5">
                      <button
                        type="button"
                        onClick={() => { setIsUserMenuOpen(false); handleSignOut() }}
                        className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-red-400/80 transition hover:bg-white/[0.06] hover:text-red-300"
                      >
                        <LogOut className="h-4 w-4" />
                        Sign out
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ) : (
            <Link
              href="/sign-in"
              className="inline-flex items-center gap-2 rounded-xl bg-flame-500 px-4 py-2 text-sm font-semibold text-white shadow-glow-flame transition hover:bg-flame-400 hover:-translate-y-0.5"
            >
              <LogIn className="h-4 w-4" />
              {t('sign_in')}
            </Link>
          )}
        </div>

        <div className="flex items-center gap-2 md:hidden">
          {userEmail ? (
            <Link
              href="/dashboard"
              aria-label="My dashboard"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-flame-500/20 ring-1 ring-flame-500/30 transition hover:bg-flame-500/30"
            >
              <span className="text-sm font-bold text-flame-300">
                {userEmail[0].toUpperCase()}
              </span>
            </Link>
          ) : (
            <Link
              href="/sign-in"
              aria-label={t('sign_in')}
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-white/80 transition hover:bg-white/5 hover:text-white"
            >
              <LogIn className="h-5 w-5" />
            </Link>
          )}

          <button
            type="button"
            aria-label={mobileMenuOpen ? t('close') : t('open_menu')}
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-white/80 transition hover:bg-white/5 hover:text-white"
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {mobileMenuOpen && (
        <div className="border-t border-white/10 bg-ink-950 px-4 pb-4 pt-3 md:hidden">
          <div className="mb-4 flex items-center justify-end gap-2">
            <ThemeToggle />
            <LanguageSwitcher />
          </div>

          <div className="space-y-2">
            {navItems.map((item) => {
              const Icon = item.icon

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={[
                    'flex items-center gap-3 rounded-2xl px-4 py-4 text-base font-medium transition',
                    item.active
                      ? 'bg-flame-500/15 text-flame-100 ring-1 ring-flame-500/40 shadow-glow-soft'
                      : 'text-white/85 hover:bg-white/5 hover:text-white',
                  ].join(' ')}
                >
                  <Icon className="h-5 w-5" />
                  {item.label}
                </Link>
              )
            })}

            {userEmail && (
              <>
                <div className="border-t border-white/[0.06]" />
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="flex w-full items-center gap-3 rounded-2xl px-4 py-4 text-base font-medium text-red-400/80 transition hover:bg-white/5 hover:text-red-300"
                >
                  <LogOut className="h-5 w-5" />
                  Sign out
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </nav>
  )
}