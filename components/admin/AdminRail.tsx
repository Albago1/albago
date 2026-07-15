'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  ArrowLeft,
  BadgeCheck,
  HandHeart,
  Image as ImageIcon,
  Inbox,
  LayoutDashboard,
  LogOut,
  Megaphone,
  Radio,
  Send,
  Users as UsersIcon,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/browser'

type RailCounts = {
  pendingSubmissions: number
  pendingPlacards: number
  reportedPlacards: number
  pendingOrganizers: number
  newVolunteers: number
}

type Section = {
  href: string
  label: string
  icon: typeof Inbox
  badge?: number
}

export default function AdminRail({ counts }: { counts: RailCounts }) {
  const pathname = usePathname()
  const router = useRouter()

  const sections: Section[] = [
    { href: '/admin', label: 'Overview', icon: LayoutDashboard },
    {
      href: '/admin/queue',
      label: 'Queue',
      icon: Inbox,
      badge: counts.pendingSubmissions,
    },
    {
      href: '/admin/placards',
      label: 'Placards',
      icon: ImageIcon,
      badge: counts.pendingPlacards + counts.reportedPlacards,
    },
    {
      href: '/admin/organizers',
      label: 'Organizers',
      icon: BadgeCheck,
      badge: counts.pendingOrganizers,
    },
    {
      href: '/admin/volunteers',
      label: 'Volunteers',
      icon: HandHeart,
      badge: counts.newVolunteers,
    },
    { href: '/admin/events', label: 'Events', icon: Megaphone },
    { href: '/admin/users', label: 'Users', icon: UsersIcon },
    { href: '/admin/share-batch', label: 'Share batch', icon: Send },
    { href: '/admin/broadcast', label: 'Broadcast', icon: Radio },
  ]

  const handleSignOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/')
    router.refresh()
  }

  const isActive = (href: string) =>
    href === '/admin' ? pathname === '/admin' : pathname.startsWith(href)

  return (
    <aside className="sticky top-0 z-20 flex h-screen w-14 flex-col border-r border-white/[0.06] bg-ink-950/95 backdrop-blur lg:w-60">
      <div className="flex h-12 flex-shrink-0 items-center gap-2.5 border-b border-white/[0.06] px-3 lg:px-4">
        <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-flame-500 text-xs font-bold text-white">
          A
        </span>
        <div className="hidden min-w-0 lg:block">
          <div className="truncate text-[13px] font-semibold leading-none text-white">
            AlbaGo
          </div>
          <div className="mt-1 truncate text-[10px] font-semibold uppercase tracking-wider text-flame-300/85">
            Admin
          </div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-1.5 py-3 lg:px-2.5">
        <ul className="space-y-0.5">
          {sections.map((s) => {
            const Icon = s.icon
            const active = isActive(s.href)
            const badge = s.badge && s.badge > 0 ? s.badge : null
            return (
              <li key={s.href} className="relative">
                {active && (
                  <span className="absolute left-0 top-1/2 h-5 w-[2px] -translate-y-1/2 rounded-full bg-flame-400" />
                )}
                <Link
                  href={s.href}
                  title={s.label}
                  className={[
                    'group flex h-8 items-center gap-2.5 rounded-md px-2 text-[13px] transition lg:px-2.5',
                    active
                      ? 'bg-white/[0.06] text-white'
                      : 'text-white/55 hover:bg-white/[0.04] hover:text-white/90',
                  ].join(' ')}
                >
                  <Icon
                    className={[
                      'h-4 w-4 flex-shrink-0',
                      active
                        ? 'text-flame-300'
                        : 'text-white/40 group-hover:text-white/75',
                    ].join(' ')}
                  />
                  <span className="hidden flex-1 truncate lg:inline">
                    {s.label}
                  </span>
                  {badge !== null && (
                    <span
                      className={[
                        'hidden h-4 items-center rounded-full px-1.5 text-[10px] font-semibold tabular-nums ring-1 lg:inline-flex',
                        active
                          ? 'bg-flame-500/20 text-flame-200 ring-flame-500/40'
                          : 'bg-flame-500/15 text-flame-300 ring-flame-500/30',
                      ].join(' ')}
                    >
                      {badge}
                    </span>
                  )}
                </Link>
                {badge !== null && (
                  <span className="pointer-events-none absolute right-1 top-1 inline-flex h-1.5 w-1.5 rounded-full bg-flame-400 lg:hidden" />
                )}
              </li>
            )
          })}
        </ul>
      </nav>

      <div className="flex-shrink-0 border-t border-white/[0.06] px-1.5 py-2 lg:px-2.5">
        <Link
          href="/"
          title="View public site"
          className="flex h-8 items-center gap-2.5 rounded-md px-2 text-[12px] text-white/45 transition hover:bg-white/[0.04] hover:text-white/85 lg:px-2.5"
        >
          <ArrowLeft className="h-4 w-4 flex-shrink-0 text-white/40" />
          <span className="hidden lg:inline">Public site</span>
        </Link>
        <button
          type="button"
          onClick={handleSignOut}
          title="Sign out"
          className="mt-0.5 flex h-8 w-full items-center gap-2.5 rounded-md px-2 text-[12px] text-white/45 transition hover:bg-white/[0.04] hover:text-white/85 lg:px-2.5"
        >
          <LogOut className="h-4 w-4 flex-shrink-0 text-white/40" />
          <span className="hidden lg:inline">Sign out</span>
        </button>
      </div>
    </aside>
  )
}
