'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  AlertTriangle,
  ArrowRight,
  ClipboardList,
  Globe,
  Loader2,
  Radar,
  ScanSearch,
  Trash2,
  TriangleAlert,
} from 'lucide-react'
import type { EventImportCandidate, CandidateStatus } from '@/lib/radar/candidate'
import type { DiscoveryReport } from '@/lib/radar/discovery'
import type { TextImportResult } from '@/lib/radar/service'
import type { ScoutReport } from '@/lib/scout/service'
import { StatusBadge, ConfidenceBadge } from './badges'

type FilterKey = 'review' | 'decided' | 'failed' | 'all'

// Real, actionable events first: needs_review before anything else, then by
// confidence (high → low), then newest. So the "Festa e Birrës" rows float up
// and the bureaucratic/low ones sink — no digging after a discovery run.
const STATUS_RANK: Record<CandidateStatus, number> = {
  needs_review: 0,
  processing: 1,
  approved: 2,
  rejected: 3,
  failed: 4,
}
const CONFIDENCE_RANK: Record<string, number> = { high: 0, medium: 1, low: 2 }

function confRank(c: EventImportCandidate): number {
  return c.confidence ? (CONFIDENCE_RANK[c.confidence] ?? 3) : 3
}

function matchesFilter(c: EventImportCandidate, filter: FilterKey): boolean {
  if (filter === 'all') return true
  if (filter === 'review') return c.status === 'needs_review' || c.status === 'processing'
  if (filter === 'failed') return c.status === 'failed'
  return c.status === 'approved' || c.status === 'rejected' // decided
}

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

  const [scoutCity, setScoutCity] = useState('')
  const [scoutDays, setScoutDays] = useState('21')
  const [scouting, setScouting] = useState(false)
  const [scoutError, setScoutError] = useState<string | null>(null)
  const [scout, setScout] = useState<ScoutReport | null>(null)

  const [pasteText, setPasteText] = useState('')
  const [pasting, setPasting] = useState(false)
  const [pasteError, setPasteError] = useState<string | null>(null)
  const [pasteResult, setPasteResult] = useState<TextImportResult | null>(null)

  const [filter, setFilter] = useState<FilterKey>('review')
  const [clearing, setClearing] = useState(false)

  const canRun = url.trim().length > 0 && !running
  const canDiscover = sourceUrl.trim().length > 0 && !discovering
  const canPaste = pasteText.trim().length >= 10 && !pasting

  const counts = useMemo(() => {
    const c = { review: 0, decided: 0, failed: 0, all: initialCandidates.length }
    for (const cand of initialCandidates) {
      if (matchesFilter(cand, 'review')) c.review++
      else if (matchesFilter(cand, 'failed')) c.failed++
      else if (matchesFilter(cand, 'decided')) c.decided++
    }
    return c
  }, [initialCandidates])

  const visible = useMemo(() => {
    return initialCandidates
      .filter((c) => matchesFilter(c, filter))
      .sort((a, b) => {
        const s = STATUS_RANK[a.status] - STATUS_RANK[b.status]
        if (s !== 0) return s
        const cf = confRank(a) - confRank(b)
        if (cf !== 0) return cf
        return (b.created_at ?? '').localeCompare(a.created_at ?? '')
      })
  }, [initialCandidates, filter])

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

  async function runScoutSearch() {
    if (scouting) return
    setScouting(true)
    setScoutError(null)
    setScout(null)
    try {
      const res = await fetch('/api/admin/scout/run', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          city: scoutCity.trim() || undefined,
          days: Number.parseInt(scoutDays, 10) || undefined,
        }),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok || !json?.ok) {
        setScoutError(
          res.status === 403
            ? 'Not authorized — sign in as an admin.'
            : json?.message || `Search failed (${json?.error ?? res.status}).`,
        )
        return
      }
      setScout(json.report as ScoutReport)
      router.refresh()
    } catch {
      setScoutError('Something went wrong reaching the scout.')
    } finally {
      setScouting(false)
    }
  }

  async function runPasteImport() {
    if (!canPaste) return
    setPasting(true)
    setPasteError(null)
    setPasteResult(null)
    try {
      const res = await fetch('/api/admin/event-radar/import-text', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ text: pasteText.trim() }),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok || !json?.ok) {
        setPasteError(
          res.status === 403
            ? 'Not authorized — sign in as an admin.'
            : json?.error === 'text_required'
              ? 'Paste at least a few lines of event text first.'
              : json?.message || `Import failed (${json?.error ?? res.status}).`,
        )
        return
      }
      setPasteResult(json.result as TextImportResult)
      setPasteText('')
      // New candidates were written — pull the fresh list into the history.
      router.refresh()
    } catch {
      setPasteError('Something went wrong reaching the importer.')
    } finally {
      setPasting(false)
    }
  }

  async function clearFailed() {
    if (clearing || counts.failed === 0) return
    if (!confirm(`Remove all ${counts.failed} unreadable imports? They can't be reviewed.`)) return
    setClearing(true)
    try {
      const res = await fetch('/api/admin/event-radar/clear-failed', { method: 'POST' })
      if (res.ok) {
        if (filter === 'failed') setFilter('review')
        router.refresh()
      }
    } catch {
      /* leave them in place on failure */
    } finally {
      setClearing(false)
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
          <Globe className="h-4 w-4 text-flame-300" />
          <h2 className="text-sm font-semibold text-white/90">Search the web for events</h2>
        </div>
        <p className="mt-1.5 text-xs text-white/50">
          The scout searches the open web — no source list needed — and files every find as a
          candidate below. Each one is re-read from its own page before it lands, so the page
          overrules the search. This runs by itself every night at 03:00; use this to run it now.
        </p>

        <div className="mt-3 flex flex-col gap-3 sm:flex-row">
          <input
            type="text"
            value={scoutCity}
            onChange={(e) => setScoutCity(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void runScoutSearch()
            }}
            placeholder="City — leave empty for the nightly list"
            spellCheck={false}
            className="h-11 flex-1 rounded-xl border border-white/10 bg-white/[0.03] px-3.5 text-[14px] text-white placeholder:text-white/25 focus:border-flame-500/40 focus:outline-none focus:ring-1 focus:ring-flame-500/30"
          />
          <input
            type="number"
            min={1}
            max={90}
            value={scoutDays}
            onChange={(e) => setScoutDays(e.target.value)}
            aria-label="Days ahead to search"
            className="h-11 w-full rounded-xl border border-white/10 bg-white/[0.03] px-3.5 text-[14px] text-white focus:border-flame-500/40 focus:outline-none focus:ring-1 focus:ring-flame-500/30 sm:w-28"
          />
          <button
            type="button"
            onClick={() => void runScoutSearch()}
            disabled={scouting}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-flame-500/40 bg-flame-500/10 px-5 text-sm font-semibold text-flame-200 transition hover:bg-flame-500/20 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {scouting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Globe className="h-4 w-4" />}
            {scouting ? 'Searching…' : 'Search now'}
          </button>
        </div>

        {scouting && (
          <p className="mt-2.5 text-[11px] text-white/40">
            Searching, then reading each event&apos;s own page — this can take a few minutes.
          </p>
        )}
        {scoutError && (
          <div className="mt-2.5 flex items-start gap-2 rounded-lg border border-flame-500/30 bg-flame-500/10 px-3 py-2 text-xs text-flame-200">
            <TriangleAlert className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
            <span>{scoutError}</span>
          </div>
        )}
        {scout && (
          <div className="mt-3 rounded-xl border border-white/[0.07] bg-white/[0.02] px-3.5 py-3 text-xs text-white/70">
            {scout.found === 0 ? (
              <span className="text-white/50">
                The search came back with nothing it could stand behind. That is an honest answer,
                not a failure — try a wider window, or a different city.
              </span>
            ) : (
              <span>
                Searched{' '}
                <span className="font-semibold text-white">{scout.briefsProcessed}</span>{' '}
                {scout.briefsProcessed === 1 ? 'city' : 'cities'} · found{' '}
                <span className="font-semibold text-white">{scout.found}</span> ·{' '}
                <span className="font-semibold text-emerald-300">{scout.imported}</span> new
                {scout.duplicate > 0 && <> · {scout.duplicate} already imported</>}
                {scout.notEvent > 0 && <> · {scout.notEvent} not events</>}
                {scout.invalid > 0 && <> · {scout.invalid} unusable</>}
                {scout.errors > 0 && <> · {scout.errors} errored</>}
                . New candidates appear below.
              </span>
            )}
          </div>
        )}
      </div>

      <div className="mt-4 rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4 sm:p-5">
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
                {discovery.notEvent > 0 && <> · {discovery.notEvent} not events</>}
                {discovery.unreadable > 0 && <> · {discovery.unreadable} unreadable</>}
                {discovery.errors > 0 && <> · {discovery.errors} errored</>}
                . New candidates appear below.
              </span>
            )}
          </div>
        )}
      </div>

      <div className="mt-4 rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4 sm:p-5">
        <div className="flex items-center gap-2">
          <ClipboardList className="h-4 w-4 text-flame-300" />
          <h2 className="text-sm font-semibold text-white/90">Paste a list of events</h2>
        </div>
        <p className="mt-1.5 text-xs text-white/50">
          Copy an events list out of ChatGPT, an email, or a PDF and paste it here. No crawling —
          every event in the text is read into a scored candidate below. Best for sources the
          crawler can&apos;t reach (Facebook, Instagram, login-walled pages).
        </p>

        <textarea
          value={pasteText}
          onChange={(e) => setPasteText(e.target.value)}
          rows={5}
          placeholder={
            'Festa e Birrës — 22 August, 20:00, Sheshi Skënderbej, Tirana. Free.\nKoncert Elita 5 — 5 September, 21:00, Amfiteatri, Durrës. 1500 lekë.\n…'
          }
          spellCheck={false}
          className="mt-3 w-full resize-y rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-3 text-[13px] leading-relaxed text-white placeholder:text-white/25 focus:border-flame-500/40 focus:outline-none focus:ring-1 focus:ring-flame-500/30"
        />

        <div className="mt-3 flex items-center justify-between gap-3">
          <span className="text-[11px] text-white/35">
            {pasteText.trim().length > 0 ? `${pasteText.trim().length} characters` : 'Up to 25 events per paste'}
          </span>
          <button
            type="button"
            onClick={() => void runPasteImport()}
            disabled={!canPaste}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-flame-500/40 bg-flame-500/10 px-5 text-sm font-semibold text-flame-200 transition hover:bg-flame-500/20 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {pasting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ClipboardList className="h-4 w-4" />}
            {pasting ? 'Reading…' : 'Import events'}
          </button>
        </div>

        {pasting && (
          <p className="mt-2.5 text-[11px] text-white/40">
            Reading every event out of the text — this can take a moment.
          </p>
        )}
        {pasteError && (
          <div className="mt-2.5 flex items-start gap-2 rounded-lg border border-flame-500/30 bg-flame-500/10 px-3 py-2 text-xs text-flame-200">
            <TriangleAlert className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
            <span>{pasteError}</span>
          </div>
        )}
        {pasteResult && (
          <div className="mt-3 rounded-xl border border-white/[0.07] bg-white/[0.02] px-3.5 py-3 text-xs text-white/70">
            {pasteResult.found === 0 ? (
              <span className="text-white/50">
                No events found in that text. Make sure each event names at least a title and a date.
              </span>
            ) : (
              <span>
                Read <span className="font-semibold text-white">{pasteResult.found}</span>{' '}
                {pasteResult.found === 1 ? 'event' : 'events'} ·{' '}
                <span className="font-semibold text-emerald-300">{pasteResult.imported}</span> new
                {pasteResult.duplicate > 0 && <> · {pasteResult.duplicate} already imported</>}
                {pasteResult.notEvent > 0 && <> · {pasteResult.notEvent} skipped (not events)</>}
                {pasteResult.errors > 0 && <> · {pasteResult.errors} errored</>}
                . New candidates appear below.
              </span>
            )}
          </div>
        )}
      </div>

      <section className="mt-8">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5">
            {([
              ['review', 'To review', counts.review],
              ['decided', 'Decided', counts.decided],
              ['failed', 'Unreadable', counts.failed],
              ['all', 'All', counts.all],
            ] as [FilterKey, string, number][]).map(([key, label, n]) => (
              <button
                key={key}
                type="button"
                onClick={() => setFilter(key)}
                className={[
                  'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[12px] font-medium transition',
                  filter === key
                    ? 'bg-flame-500/20 text-flame-100 ring-1 ring-flame-500/40'
                    : 'bg-white/[0.03] text-white/55 ring-1 ring-white/10 hover:text-white/80',
                ].join(' ')}
              >
                {label}
                <span className={filter === key ? 'text-flame-200/90' : 'text-white/40'}>{n}</span>
              </button>
            ))}
          </div>
          {counts.failed > 0 && (
            <button
              type="button"
              onClick={() => void clearFailed()}
              disabled={clearing}
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-2.5 py-1 text-[12px] text-white/50 transition hover:border-flame-500/40 hover:text-flame-200 disabled:opacity-50"
            >
              {clearing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
              Clear {counts.failed} unreadable
            </button>
          )}
        </div>

        {initialCandidates.length === 0 ? (
          <p className="rounded-xl border border-white/[0.07] bg-white/[0.02] px-4 py-6 text-center text-sm text-white/45">
            No imports yet. Paste a URL above, discover a source, or run your sources to create candidates.
          </p>
        ) : visible.length === 0 ? (
          <p className="rounded-xl border border-white/[0.07] bg-white/[0.02] px-4 py-6 text-center text-sm text-white/45">
            Nothing in this view.
          </p>
        ) : (
          <ul className="space-y-2">
            {visible.map((c) => (
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
        <Radar className="h-3 w-3" />
        Managing sources that run automatically every night? Use{' '}
        <Link href="/admin/sources" className="text-white/55 underline-offset-2 hover:underline">
          Sources
        </Link>
        .
      </p>
    </div>
  )
}
