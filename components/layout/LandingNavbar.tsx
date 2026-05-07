'use client'

import { useEffect, useState } from 'react'
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
            <button
              type="button"
              onClick={handleSignOut}
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-semibold text-white/80 transition hover:bg-white/[0.08] hover:text-white"
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </button>
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
            <button
              type="button"
              aria-label="Sign out"
              onClick={handleSignOut}
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-white/80 transition hover:bg-white/5 hover:text-white"
            >
              <LogOut className="h-5 w-5" />
            </button>
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
          </div>
        </div>
      )}
    </nav>
  )
}