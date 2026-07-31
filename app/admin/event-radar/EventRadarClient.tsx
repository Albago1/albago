'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  AlertTriangle,
  ArrowRight,
  ExternalLink,
  Loader2,
  Radar,
  ScanSearch,
  TriangleAlert,
} from 'lucide-react'
import type { EventImportCandidate } from '@/lib/radar/candidate'
import type { DiscoveryReport } from '@/lib/radar/discovery'
import { StatusBadge, ConfidenceBadge } from './badges'

/**
 * Event Radar (RADAR-1) admin surface. Paste ONE public event URL → a
 * reviewable candidate. The list below is the recent import history; each row
 * opens the full review page. Nothing here publishes.
 */

function warningCount(c: EventImportCandidate): number {
  return Array.isArray(c.warnings) ? c.warnings.length : 0
}
function missingCount(c: EventImportCandidate): number {
  return Array.isArray(c.missing_fields) ? c.missing_fields.length : 0
}

export default function EventRadarClient({
  initialCandidates,
}: {
  initialCandidates: EventImportCandidate[]
}) {
  const router = useRouter()
  const [url, setUrl] = useState('')
  const [running, setRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const [sourceUrl, setSourceUrl] = useState('')
  const [discovering, setDiscovering] = useState(false)
  const [discoveryError, setDiscoveryError] = useState<string | null>(null)
  const [discovery, setDiscovery] = useState<DiscoveryReport | null>(null)

  const canRun = url.trim().length > 0 && !running
  const canDiscover = sourceUrl.trim().length > 0 && !discovering

  async function runImport() {
    if (!canRun) return
    setRunning(true)
    setError(null)
    setNotice(null)
    try {
      const res = await fetch('/api/admin/event-radar', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ url: url.trim() }),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok || !json?.ok) {
        setError(
          res.status === 403
            ? 'Not authorized — sign in as an admin.'
            : json?.message || `Import failed (${json?.error ?? res.status}).`,
        )
        return
      }
      if (json.duplicate) {
        setNotice('This source was already imported — opening the existing candidate.')
      }
      setUrl('')
      router.push(`/admin/event-radar/${json.candidateId}`)
      router.refresh()
    } catch {
      setError('Something went wrong reaching the importer.')
    } finally {
      setRunning(false)
    }
  }

  async function runDiscover() {
    if (!canDiscover) return
    setDiscovering(true)
    setDiscoveryError(null)
    setDiscovery(null)
    try {
      const res = await fetch('/api/admin/event-radar/discover', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ sourceUrl: sourceUrl.trim() }),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok || !json?.ok) {
        setDiscoveryError(
          res.status === 403
            ? 'Not authorized — sign in as an admin.'
            : json?.message || `Discovery failed (${json?.error ?? res.status}).`,
        )
        return
      }
      setDiscovery(json.report as DiscoveryReport)
      // New candidates were written — pull the fresh list into "Recent imports".
      router.refresh()
    } catch {
      setDiscoveryError('Something went wrong reaching the discovery agent.')
    } finally {
      setDiscovering(false)
    }
  }

  return (
    <div className="mx-auto max-w-4xl">
      <header className="mb-6">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-flame-500/15 text-flame-300 ring-1 ring-flame-500/30">
            <ScanSearch className="h-4 w-4" />
          </span>
          <h1 className="text-lg font-semibold text-white">Event Radar</h1>
        </div>
        <p className="mt-2 text-sm text-white/55">
          Paste a public event page — an official site, ticket page, festival, tourism
          calendar, theatre or municipality listing. Radar reads it, adapts it to
          AlbaGo&apos;s event structure, and flags anything missing or uncertain for your
          review. Nothing is published — an approved candidate lands in the{' '}
          <span className="text-white/75">Queue</span> as a pending submission.
        </p>
      </header>

      <div className="flex flex-col gap-3 sm:flex-row">
        <input
          type="url"
          inputMode="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void runImport()
          }}
          placeholder="https://organizer.al/events/summer-festival-2026"
          spellCheck={false}
          className="h-11 flex-1 rounded-xl border border-white/10 bg-white/[0.03] px-3.5 text-[14px] text-white placeholder:text-white/25 focus:border-flame-500/40 focus:outline-none focus:ring-1 focus:ring-flame-500/30"
        />
        <button
          type="button"
          onClick={() => void runImport()}
          disabled={!canRun}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-flame-500 px-5 text-sm font-semibold text-white transition hover:bg-flame-400 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <ScanSearch className="h-4 w-4" />}
          {running ? 'Reading…' : 'Import'}
        </button>
      </div>

      {notice && <p className="mt-3 text-xs text-white/50">{notice}</p>}
      {error && (
        <div className="mt-3 flex items-start gap-2 rounded-lg border border-flame-500/30 bg-flame-500/10 px-3.5 py-2.5 text-sm text-flame-200">
          <TriangleAlert className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="mt-5 rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4 sm:p-5">
        <div className="flex items-center gap-2">
          <Radar className="h-4 w-4 text-flame-300" />
          <h2 className="text-sm font-semibold text-white/90">Discover a whole source</h2>
        </div>
        <p className="mt-1.5 text-xs text-white/50">
          Paste a listing page — a venue&apos;s &ldquo;what&apos;s on&rdquo;, a ticketing catalog,
          a culture calendar. The agent finds every event linked from it and reads each into a
          scored candidate below. Same nightly engine, run on demand.
        </p>

        <div className="mt-3 flex flex-col gap-3 sm:flex-row">
          <input
            type="url"
            inputMode="url"
            value={sourceUrl}
            onChange={(e) => setSourceUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void runDiscover()
            }}
            placeholder="https://venue.al/events"
            spellCheck={false}
            className="h-11 flex-1 rounded-xl border border-white/10 bg-white/[0.03] px-3.5 text-[14px] text-white placeholder:text-white/25 focus:border-flame-500/40 focus:outline-none focus:ring-1 focus:ring-flame-500/30"
          />
          <button
            type="button"
            onClick={() => void runDiscover()}
            disabled={!canDiscover}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-flame-500/40 bg-flame-500/10 px-5 text-sm font-semibold text-flame-200 transition hover:bg-flame-500/20 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {discovering ? <Loader2 className="h-4 w-4 animate-spin" /> : <Radar className="h-4 w-4" />}
            {discovering ? 'Discovering…' : 'Discover'}
          </button>
        </div>

        {discovering && (
          <p className="mt-2.5 text-[11px] text-white/40">
            Reading the source and each event it links to — this can take up to a minute.
          </p>
        )}
        {discoveryError && (
          <div className="mt-2.5 flex items-start gap-2 rounded-lg border border-flame-500/30 bg-flame-500/10 px-3 py-2 text-xs text-flame-200">
            <TriangleAlert className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
            <span>{discoveryError}</span>
          </div>
        )}
        {discovery && (
          <div className="mt-3 rounded-xl border border-white/[0.07] bg-white/[0.02] px-3.5 py-3 text-xs text-white/70">
            {discovery.eventUrlsFound === 0 ? (
              <span className="text-white/50">
                No event links found on that page. If the events are listed inline (not linked to
                their own pages), import them individually above for now.
              </span>
            ) : (
              <span>
                Found <span className="font-semibold text-white">{discovery.eventUrlsFound}</span>{' '}
                event {discovery.eventUrlsFound === 1 ? 'page' : 'pages'} ·{' '}
                <span className="font-semibold text-emerald-300">{discovery.imported}</span> new
                {discovery.skippedDuplicate > 0 && <> · {discovery.skippedDuplicate} already imported</>}
                {discovery.unreadable > 0 && <> · {discovery.unreadable} unreadable</>}
                {discovery.errors > 0 && <> · {discovery.errors} errored</>}
                . New candidates appear below.
              </span>
            )}
          </div>
        )}
      </div>

      <section className="mt-8">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-white/40">
          Recent imports
        </h2>

        {initialCandidates.length === 0 ? (
          <p className="rounded-xl border border-white/[0.07] bg-white/[0.02] px-4 py-6 text-center text-sm text-white/45">
            No imports yet. Paste a URL above to create your first candidate.
          </p>
        ) : (
          <ul className="space-y-2">
            {initialCandidates.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/admin/event-radar/${c.id}`}
                  className="group flex items-center gap-3 rounded-xl border border-white/[0.07] bg-white/[0.02] px-4 py-3 transition hover:border-white/15 hover:bg-white/[0.04]"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-medium text-white/90">
                        {c.title || <span className="text-white/40">Untitled — could not read a title</span>}
                      </p>
                    </div>
                    <p className="mt-0.5 truncate text-[11px] text-white/40">
                      {[c.event_date, c.venue_name, c.city_label].filter(Boolean).join(' · ') ||
                        c.source_name ||
                        c.source_url}
                    </p>
                  </div>

                  <div className="hidden shrink-0 items-center gap-3 text-[11px] text-white/45 sm:flex">
                    {warningCount(c) > 0 && (
                      <span className="inline-flex items-center gap-1 text-amber-300/80">
                        <AlertTriangle className="h-3 w-3" />
                        {warningCount(c)}
                      </span>
                    )}
                    {missingCount(c) > 0 && <span>{missingCount(c)} missing</span>}
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    <ConfidenceBadge confidence={c.confidence} />
                    <StatusBadge status={c.status} />
                  </div>
                  <ArrowRight className="h-4 w-4 shrink-0 text-white/25 transition group-hover:text-white/60" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="mt-8 flex items-center gap-1.5 text-[11px] text-white/35">
        <ExternalLink className="h-3 w-3" />
        Looking to import many sources at once? Use{' '}
        <Link href="/admin/crawl" className="text-white/55 underline-offset-2 hover:underline">
          Crawl
        </Link>
        .
      </p>
    </div>
  )
}
