'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  Home,
  LogIn,
  LogOut,
  Map,
  MapPin,
  Plus,
  Menu,
  X,
  LayoutDashboard,
  Calendar,
} from 'lucide-react'
import LanguageSwitcher from '@/components/layout/LanguageSwitcher'
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

  if (pathname === '/map') return null

  const navItems = [
    { href: '/', label: t('nav_home'), icon: Home, active: pathname === '/' },
    { href: '/events', label: t('nav_events'), icon: Calendar, active: pathname === '/events' },
    { href: '/map', label: t('nav_map'), icon: Map, active: pathname === '/map' },
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
    <nav className="fixed inset-x-0 top-0 z-50 border-b border-white/10 bg-[#070b14]/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
        <Link
          href="/"
          className="flex items-center gap-3"
          onClick={() => setMobileMenuOpen(false)}
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 shadow-lg shadow-blue-600/20">
            <MapPin className="h-5 w-5 text-white" />
          </div>

          <span className="text-2xl font-bold tracking-tight text-white">
            Alba<span className="text-blue-500">Go</span>
          </span>
        </Link>

        <div className="hidden items-center gap-2 md:flex">
          {navItems.map((item) => {
            const Icon = item.icon

            return (
              <Link
                key={item.href}
                href={item.href}
                className={[
                  'inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition',
                  item.active
                    ? 'bg-gradient-to-r from-violet-600 to-purple-500 text-white shadow-lg shadow-violet-600/20'
                    : 'text-white/85 hover:bg-white/5 hover:text-white',
                ].join(' ')}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            )
          })}
        </div>

        <div className="hidden items-center gap-2 md:flex">
          <LanguageSwitcher />

          {userEmail ? (
            <div className="relative" ref={userMenuRef}>
              <button
                type="button"
                onClick={() => setIsUserMenuOpen((prev) => !prev)}
                className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm transition hover:bg-white/[0.08]"
              >
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">
                  {userEmail[0].toUpperCase()}
                </span>
                <span className="hidden max-w-[120px] truncate text-xs text-white/60 lg:block">
                  {userEmail}
                </span>
              </button>

              {isUserMenuOpen && (
                <div className="absolute right-0 top-[calc(100%+0.5rem)] z-50 min-w-[160px] overflow-hidden rounded-2xl border border-white/10 bg-[#0b1020] shadow-2xl">
                  <Link
                    href="/dashboard"
                    onClick={() => setIsUserMenuOpen(false)}
                    className="flex items-center gap-3 px-4 py-3 text-sm text-white/80 transition hover:bg-white/[0.06] hover:text-white"
                  >
                    <LayoutDashboard className="h-4 w-4" />
                    Dashboard
                  </Link>
                  <div className="border-t border-white/[0.06]" />
                  <button
                    type="button"
                    onClick={() => { setIsUserMenuOpen(false); handleSignOut() }}
                    className="flex w-full items-center gap-3 px-4 py-3 text-sm text-red-400/80 transition hover:bg-white/[0.06] hover:text-red-300"
                  >
                    <LogOut className="h-4 w-4" />
                    Sign out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <Link
              href="/sign-in"
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-500"
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
              className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-600/20 transition hover:bg-blue-600/30"
            >
              <span className="text-sm font-bold text-blue-400">
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
        <div className="border-t border-white/10 bg-[#070b14] px-4 pb-4 pt-3 md:hidden">
          <div className="mb-4 flex justify-end">
            <div className="scale-90 origin-right">
              <LanguageSwitcher />
            </div>
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
                      ? 'bg-gradient-to-r from-violet-600 to-purple-500 text-white shadow-lg shadow-violet-600/20'
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