'use client'

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { useRouter } from 'next/navigation'
import {
  BadgeCheck,
  Calendar,
  HandHeart,
  Image as ImageIcon,
  Inbox,
  LayoutDashboard,
  Megaphone,
  Search,
  Send,
  Users as UsersIcon,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/browser'

type IconType = typeof Inbox

type NavItem = {
  kind: 'nav'
  id: string
  label: string
  sublabel?: string
  href: string
  icon: IconType
  keywords: string
}

type EventItem = {
  kind: 'event'
  id: string
  title: string
  city: string
  href: string
}

type OrganizerItem = {
  kind: 'organizer'
  id: string
  name: string
  tier: string | null
  href: string
}

type Item = NavItem | EventItem | OrganizerItem

const NAV_ITEMS: NavItem[] = [
  {
    kind: 'nav',
    id: 'nav-overview',
    label: 'Overview',
    sublabel: 'Platform health, KPIs, top cities',
    href: '/admin',
    icon: LayoutDashboard,
    keywords: 'overview home dashboard kpi',
  },
  {
    kind: 'nav',
    id: 'nav-queue',
    label: 'Moderation queue',
    sublabel: 'Review event submissions',
    href: '/admin/queue',
    icon: Inbox,
    keywords: 'queue moderation review submissions pending',
  },
  {
    kind: 'nav',
    id: 'nav-placards',
    label: 'Placards',
    sublabel: 'Pankartat photo wall moderation',
    href: '/admin/placards',
    icon: ImageIcon,
    keywords: 'placards pankartat photos reports flagged',
  },
  {
    kind: 'nav',
    id: 'nav-organizers',
    label: 'Organizers',
    sublabel: 'Verify and manage organizer accounts',
    href: '/admin/organizers',
    icon: BadgeCheck,
    keywords: 'organizers verification kyc id',
  },
  {
    kind: 'nav',
    id: 'nav-volunteers',
    label: 'Volunteers',
    sublabel: 'New volunteer signups',
    href: '/admin/volunteers',
    icon: HandHeart,
    keywords: 'volunteers signups helpers',
  },
  {
    kind: 'nav',
    id: 'nav-events',
    label: 'Events',
    sublabel: 'Browse and edit every event',
    href: '/admin/events',
    icon: Megaphone,
    keywords: 'events list edit',
  },
  {
    kind: 'nav',
    id: 'nav-users',
    label: 'Users',
    sublabel: 'All user accounts',
    href: '/admin/users',
    icon: UsersIcon,
    keywords: 'users accounts profiles',
  },
  {
    kind: 'nav',
    id: 'nav-share-batch',
    label: 'Share batch',
    sublabel: 'Generate PNG kits for upcoming protests',
    href: '/admin/share-batch',
    icon: Send,
    keywords: 'share batch png zip kit social',
  },
]

function detectMac(): boolean {
  if (typeof navigator === 'undefined') return false
  return /mac/i.test(navigator.platform)
}

export default function AdminCommandPalette() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [events, setEvents] = useState<EventItem[]>([])
  const [organizers, setOrganizers] = useState<OrganizerItem[]>([])
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [mac, setMac] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const requestIdRef = useRef(0)
  const selectedRowRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    setMac(detectMac())
  }, [])

  // Global hotkey + custom event from the top-bar button
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen((o) => !o)
      }
    }
    const onCustomOpen = () => setOpen(true)
    window.addEventListener('keydown', onKey)
    window.addEventListener('admin:open-command-palette', onCustomOpen)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('admin:open-command-palette', onCustomOpen)
    }
  }, [])

  // Reset on close, focus on open
  useEffect(() => {
    if (open) {
      const t = setTimeout(() => inputRef.current?.focus(), 0)
      return () => clearTimeout(t)
    }
    setQuery('')
    setEvents([])
    setOrganizers([])
    setSelectedIndex(0)
  }, [open])

  // Filter the static nav items against the query
  const filteredNav = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return NAV_ITEMS
    return NAV_ITEMS.filter(
      (n) =>
        n.label.toLowerCase().includes(q) ||
        (n.sublabel?.toLowerCase().includes(q) ?? false) ||
        n.keywords.includes(q),
    )
  }, [query])

  // Debounced async search for events + organizers
  useEffect(() => {
    const q = query.trim()
    if (q.length < 2) {
      // Invalidate any in-flight request
      requestIdRef.current += 1
      setEvents([])
      setOrganizers([])
      return
    }
    const reqId = ++requestIdRef.current
    const timer = setTimeout(async () => {
      const supabase = createClient()
      const [evRes, orgRes] = await Promise.all([
        supabase
          .from('events')
          .select('id, slug, title, location_slug, country')
          .ilike('title', `%${q}%`)
          .order('created_at', { ascending: false })
          .limit(6),
        supabase
          .from('organizers')
          .select('id, display_name, slug, verification_tier')
          .ilike('display_name', `%${q}%`)
          .order('display_name', { ascending: true })
          .limit(6),
      ])
      if (reqId !== requestIdRef.current) return
      setEvents(
        ((evRes.data ?? []) as Array<{
          id: string
          slug: string
          title: string
          location_slug: string | null
          country: string | null
        }>).map((r) => ({
          kind: 'event' as const,
          id: r.id,
          title: r.title,
          city:
            r.location_slug?.replace(/-/g, ' ') || r.country || 'Unknown',
          href: `/admin/events/${r.id}/edit`,
        })),
      )
      setOrganizers(
        ((orgRes.data ?? []) as Array<{
          id: string
          display_name: string
          slug: string
          verification_tier: string | null
        }>).map((r) => ({
          kind: 'organizer' as const,
          id: r.id,
          name: r.display_name,
          tier: r.verification_tier,
          href: `/admin/organizers`,
        })),
      )
    }, 180)
    return () => clearTimeout(timer)
  }, [query])

  // Flat list for keyboard navigation
  const items: Item[] = useMemo(
    () => [...filteredNav, ...events, ...organizers],
    [filteredNav, events, organizers],
  )

  // Reset selection whenever the result set changes
  useEffect(() => {
    setSelectedIndex(0)
  }, [items.length, query])

  // Keep selected row in view
  useEffect(() => {
    if (open) selectedRowRef.current?.scrollIntoView({ block: 'nearest' })
  }, [selectedIndex, open])

  const activate = useCallback(
    (item: Item) => {
      router.push(item.href)
      setOpen(false)
    },
    [router],
  )

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      setOpen(false)
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex((i) => Math.min(i + 1, Math.max(items.length - 1, 0)))
      return
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex((i) => Math.max(i - 1, 0))
      return
    }
    if (e.key === 'Enter') {
      e.preventDefault()
      const item = items[selectedIndex]
      if (item) activate(item)
    }
  }

  if (!open) return null

  let runningIndex = 0
  const navStartIndex = runningIndex
  runningIndex += filteredNav.length
  const eventsStartIndex = runningIndex
  runningIndex += events.length
  const organizersStartIndex = runningIndex

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 px-4 pt-[10vh] backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) setOpen(false)
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Admin command palette"
        className="flex w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-ink-950 shadow-2xl ring-1 ring-flame-500/10"
        onKeyDown={onKeyDown}
      >
        <div className="flex items-center gap-3 border-b border-white/[0.06] px-4">
          <Search className="h-4 w-4 flex-shrink-0 text-white/40" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search events, organizers… or jump to a section"
            className="h-12 flex-1 bg-transparent text-[14px] text-white placeholder-white/35 outline-none"
            autoComplete="off"
            spellCheck={false}
          />
          <kbd className="rounded border border-white/10 bg-white/[0.04] px-1.5 py-0.5 font-mono text-[10px] text-white/45">
            esc
          </kbd>
        </div>

        <div className="max-h-[60vh] overflow-y-auto px-2 py-2">
          {items.length === 0 ? (
            <div className="px-3 py-10 text-center text-sm text-white/45">
              No results for &ldquo;{query}&rdquo;.
            </div>
          ) : (
            <>
              {filteredNav.length > 0 && (
                <Group label="Navigate">
                  {filteredNav.map((n, i) => {
                    const idx = navStartIndex + i
                    return (
                      <Row
                        key={n.id}
                        rowRef={selectedIndex === idx ? selectedRowRef : null}
                        active={selectedIndex === idx}
                        onClick={() => activate(n)}
                        onMouseMove={() => setSelectedIndex(idx)}
                        icon={<n.icon className="h-4 w-4" />}
                        label={n.label}
                        sublabel={n.sublabel}
                      />
                    )
                  })}
                </Group>
              )}
              {events.length > 0 && (
                <Group label="Events">
                  {events.map((ev, i) => {
                    const idx = eventsStartIndex + i
                    return (
                      <Row
                        key={ev.id}
                        rowRef={selectedIndex === idx ? selectedRowRef : null}
                        active={selectedIndex === idx}
                        onClick={() => activate(ev)}
                        onMouseMove={() => setSelectedIndex(idx)}
                        icon={<Calendar className="h-4 w-4" />}
                        label={ev.title}
                        sublabel={ev.city}
                        capitalizeSub
                      />
                    )
                  })}
                </Group>
              )}
              {organizers.length > 0 && (
                <Group label="Organizers">
                  {organizers.map((o, i) => {
                    const idx = organizersStartIndex + i
                    return (
                      <Row
                        key={o.id}
                        rowRef={selectedIndex === idx ? selectedRowRef : null}
                        active={selectedIndex === idx}
                        onClick={() => activate(o)}
                        onMouseMove={() => setSelectedIndex(idx)}
                        icon={<BadgeCheck className="h-4 w-4" />}
                        label={o.name}
                        sublabel={
                          o.tier === 'verified'
                            ? 'Verified'
                            : o.tier === 'established'
                              ? 'Established'
                              : 'Unverified'
                        }
                      />
                    )
                  })}
                </Group>
              )}
            </>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-white/[0.06] px-3 py-2 text-[10px] text-white/45">
          <div className="flex items-center gap-3">
            <Hint k="↑↓" label="Navigate" />
            <Hint k="↵" label="Open" />
            <Hint k="esc" label="Close" />
          </div>
          <span className="font-mono text-white/35">
            {mac ? '⌘K' : 'Ctrl+K'}
          </span>
        </div>
      </div>
    </div>
  )
}

function Group({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="px-1 py-1">
      <div className="px-2 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/35">
        {label}
      </div>
      <div className="space-y-0.5">{children}</div>
    </div>
  )
}

function Row({
  active,
  onClick,
  onMouseMove,
  icon,
  label,
  sublabel,
  capitalizeSub,
  rowRef,
}: {
  active: boolean
  onClick: () => void
  onMouseMove: () => void
  icon: React.ReactNode
  label: string
  sublabel?: string
  capitalizeSub?: boolean
  rowRef: React.RefObject<HTMLButtonElement | null> | null
}) {
  return (
    <button
      ref={rowRef ?? undefined}
      type="button"
      onClick={onClick}
      onMouseMove={onMouseMove}
      className={[
        'flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition',
        active
          ? 'bg-flame-500/[0.12] text-white ring-1 ring-flame-500/30'
          : 'text-white/85 hover:bg-white/[0.04]',
      ].join(' ')}
    >
      <span
        className={[
          'flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md',
          active
            ? 'bg-flame-500/20 text-flame-200'
            : 'bg-white/[0.04] text-white/60',
        ].join(' ')}
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-semibold">
          {label}
        </span>
        {sublabel && (
          <span
            className={[
              'block truncate text-[11px] text-white/45',
              capitalizeSub ? 'capitalize' : '',
            ].join(' ')}
          >
            {sublabel}
          </span>
        )}
      </span>
    </button>
  )
}

function Hint({ k, label }: { k: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <kbd className="rounded border border-white/10 bg-white/[0.04] px-1 py-0.5 font-mono text-[10px] text-white/55">
        {k}
      </kbd>
      <span>{label}</span>
    </span>
  )
}
