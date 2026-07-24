'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Plus, ScanLine, Search } from 'lucide-react'

const SECTION_TITLES: Record<string, string> = {
  '/admin': 'Overview',
  '/admin/queue': 'Moderation queue',
  '/admin/organizers': 'Organizers',
  '/admin/volunteers': 'Volunteers',
  '/admin/events/new': 'New event',
  '/admin/events': 'Events',
  '/admin/users': 'Users',
  '/admin/share-batch': 'Share batch',
}

function resolveTitle(pathname: string): string {
  const keys = Object.keys(SECTION_TITLES).sort((a, b) => b.length - a.length)
  for (const k of keys) {
    if (pathname === k || pathname.startsWith(k + '/')) return SECTION_TITLES[k]
  }
  return 'Admin'
}

export default function AdminTopBar() {
  const pathname = usePathname()
  const title = resolveTitle(pathname)

  return (
    <header className="sticky top-0 z-10 flex h-12 flex-shrink-0 items-center justify-between gap-3 border-b border-white/[0.06] bg-ink-950/95 px-4 backdrop-blur sm:px-6">
      <div className="flex min-w-0 items-center gap-2">
        <h1 className="truncate text-[13px] font-semibold text-white">
          {title}
        </h1>
      </div>
      <div className="flex items-center gap-2">
        <Link
          href="/scan"
          title="Scan a poster into an event"
          className="inline-flex h-7 items-center gap-1.5 rounded-md border border-white/10 bg-white/[0.03] px-2.5 text-[11px] font-semibold text-white/70 transition hover:bg-white/[0.06] hover:text-white"
        >
          <ScanLine className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Scan poster</span>
        </Link>
        <Link
          href="/admin/events/new"
          className="inline-flex h-7 items-center gap-1.5 rounded-md bg-flame-500 px-2.5 text-[11px] font-semibold text-white transition hover:bg-flame-400"
        >
          <Plus className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">New event</span>
        </Link>
        <button
          type="button"
          onClick={() =>
            window.dispatchEvent(new Event('admin:open-command-palette'))
          }
          title="Search"
          aria-label="Open command palette"
          className="inline-flex h-7 items-center gap-2 rounded-md border border-white/10 bg-white/[0.03] px-2 text-[11px] text-white/55 transition hover:bg-white/[0.06] hover:text-white/85"
        >
          <Search className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Search</span>
          <kbd className="hidden rounded border border-white/10 bg-white/[0.04] px-1 font-mono text-[10px] text-white/45 sm:inline">
            ⌘K
          </kbd>
        </button>
      </div>
    </header>
  )
}
