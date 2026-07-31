'use client'

import { useRef, useState } from 'react'
import Link from 'next/link'
import {
  CheckCircle2,
  ExternalLink,
  ListChecks,
  Loader2,
  Play,
  Plus,
  Radar,
  Trash2,
  TriangleAlert,
  Upload,
} from 'lucide-react'
import type { CrawlSourceRow } from '@/lib/crawl/sourceStore'
import type { DiscoveryReport } from '@/lib/radar/discovery'

/**
 * Source registry admin panel. Paste a whole list of links (one per line) or
 * upload a .txt/.csv file → saved as sources the nightly cron crawls. Toggle,
 * delete, and "Run all now" for an on-demand pass. Nothing here publishes; finds
 * land in the Event Radar review queue.
 */

function hostOf(url: string): string {
  try {
    return new URL(url).host.replace(/^www\./, '')
  } catch {
    return url
  }
}

function lastRunLabel(s: CrawlSourceRow): string {
  if (!s.last_run_at) return 'Never run'
  const when = new Date(s.last_run_at).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  })
  if (s.last_status === 'error') return `Errored · ${when}`
  const n = s.last_found_count ?? 0
  return `${n} new · ${when}`
}

export default function SourcesClient({
  initialSources,
}: {
  initialSources: CrawlSourceRow[]
}) {
  const [sources, setSources] = useState<CrawlSourceRow[]>(initialSources)
  const [text, setText] = useState('')
  const [adding, setAdding] = useState(false)
  const [addNotice, setAddNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [running, setRunning] = useState(false)
  const [runReport, setRunReport] = useState<DiscoveryReport | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const lineCount = text.split('\n').filter((l) => l.trim().length > 0).length
  const enabledCount = sources.filter((s) => s.enabled).length

  async function refresh() {
    try {
      const res = await fetch('/api/admin/sources', { method: 'GET' })
      const json = await res.json().catch(() => null)
      if (json?.ok) setSources(json.sources as CrawlSourceRow[])
    } catch {
      /* keep the current list on a refresh hiccup */
    }
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const content = await file.text()
    setText((prev) => (prev.trim() ? `${prev.trim()}\n${content}` : content))
    if (fileRef.current) fileRef.current.value = ''
  }

  async function addAll() {
    const urls = text.split('\n').map((l) => l.trim()).filter(Boolean)
    if (urls.length === 0 || adding) return
    setAdding(true)
    setError(null)
    setAddNotice(null)
    try {
      const res = await fetch('/api/admin/sources', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ urls }),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok || !json?.ok) {
        setError(res.status === 403 ? 'Not authorized — sign in as an admin.' : 'Could not add the sources.')
        return
      }
      const parts = [`${json.added} added`]
      if (json.duplicates > 0) parts.push(`${json.duplicates} already listed`)
      if (json.invalid?.length > 0) parts.push(`${json.invalid.length} skipped (not valid public links)`)
      setAddNotice(parts.join(' · '))
      setText('')
      await refresh()
    } catch {
      setError('Something went wrong reaching the server.')
    } finally {
      setAdding(false)
    }
  }

  async function toggle(s: CrawlSourceRow) {
    setBusyId(s.id)
    setSources((prev) => prev.map((r) => (r.id === s.id ? { ...r, enabled: !r.enabled } : r)))
    try {
      await fetch('/api/admin/sources', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id: s.id, enabled: !s.enabled }),
      })
    } catch {
      setSources((prev) => prev.map((r) => (r.id === s.id ? { ...r, enabled: s.enabled } : r)))
    } finally {
      setBusyId(null)
    }
  }

  async function remove(s: CrawlSourceRow) {
    if (!confirm(`Remove ${hostOf(s.url)} from the source list?`)) return
    setBusyId(s.id)
    try {
      const res = await fetch('/api/admin/sources', {
        method: 'DELETE',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id: s.id }),
      })
      if (res.ok) setSources((prev) => prev.filter((r) => r.id !== s.id))
    } catch {
      /* leave it in place on failure */
    } finally {
      setBusyId(null)
    }
  }

  async function runAll() {
    if (running) return
    setRunning(true)
    setError(null)
    setRunReport(null)
    try {
      const res = await fetch('/api/admin/sources/run', { method: 'POST' })
      const json = await res.json().catch(() => null)
      if (!res.ok || !json?.ok) {
        setError('The discovery run failed. Check the logs and try again.')
        return
      }
      setRunReport(json.report as DiscoveryReport)
      await refresh()
    } catch {
      setError('Something went wrong starting the run.')
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className="mx-auto max-w-4xl">
      <header className="mb-6">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-flame-500/15 text-flame-300 ring-1 ring-flame-500/30">
            <ListChecks className="h-4 w-4" />
          </span>
          <h1 className="text-lg font-semibold text-white">Sources</h1>
        </div>
        <p className="mt-2 text-sm text-white/55">
          The list of pages the nightly agent checks on its own. Paste a whole list of links —
          venue &ldquo;what&apos;s on&rdquo; pages, ticketing catalogs, culture calendars, or direct
          event links — or upload a .txt/.csv file. Every enabled source is crawled each night and
          its finds land in the{' '}
          <Link href="/admin/event-radar" className="text-white/75 underline-offset-2 hover:underline">
            Event Radar
          </Link>{' '}
          review queue. Nothing is ever published automatically.
        </p>
      </header>

      {/* Bulk add */}
      <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4 sm:p-5">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={'https://venue.al/events\nhttps://ticketing.al/whats-on\nhttps://culture.gov.al/calendar'}
          spellCheck={false}
          rows={5}
          className="w-full resize-y rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-3 font-mono text-[13px] leading-relaxed text-white placeholder:text-white/25 focus:border-flame-500/40 focus:outline-none focus:ring-1 focus:ring-flame-500/30"
        />
        <div className="mt-3 flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => void addAll()}
            disabled={lineCount === 0 || adding}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-flame-500 px-4 text-sm font-semibold text-white transition hover:bg-flame-400 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            {adding ? 'Adding…' : `Add ${lineCount || ''} ${lineCount === 1 ? 'source' : 'sources'}`.trim()}
          </button>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-4 text-sm font-medium text-white/80 transition hover:bg-white/[0.06]"
          >
            <Upload className="h-4 w-4" />
            Upload a file
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".txt,.csv,text/plain,text/csv"
            onChange={(e) => void onFile(e)}
            className="hidden"
          />
          <span className="text-[11px] text-white/35">One link per line</span>
        </div>
        {addNotice && (
          <p className="mt-3 inline-flex items-center gap-1.5 text-xs text-emerald-300/90">
            <CheckCircle2 className="h-3.5 w-3.5" /> {addNotice}
          </p>
        )}
      </div>

      {error && (
        <div className="mt-3 flex items-start gap-2 rounded-lg border border-flame-500/30 bg-flame-500/10 px-3.5 py-2.5 text-sm text-flame-200">
          <TriangleAlert className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Run + list header */}
      <div className="mt-8 mb-3 flex items-center justify-between gap-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-white/40">
          {sources.length} {sources.length === 1 ? 'source' : 'sources'} · {enabledCount} active
        </h2>
        <button
          type="button"
          onClick={() => void runAll()}
          disabled={running || enabledCount === 0}
          className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-flame-500/40 bg-flame-500/10 px-3.5 text-[13px] font-semibold text-flame-200 transition hover:bg-flame-500/20 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
          {running ? 'Running…' : 'Run all now'}
        </button>
      </div>

      {running && (
        <p className="mb-3 text-[11px] text-white/40">
          Crawling every active source and reading each event — this can take a minute or more.
        </p>
      )}
      {runReport && (
        <div className="mb-3 flex items-start gap-2 rounded-xl border border-white/[0.07] bg-white/[0.02] px-3.5 py-3 text-xs text-white/70">
          <Radar className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-flame-300" />
          <span>
            Ran {runReport.sourcesProcessed}/{runReport.sourcesRequested} sources · found{' '}
            {runReport.eventUrlsFound} event pages ·{' '}
            <span className="font-semibold text-emerald-300">{runReport.imported} new</span>
            {runReport.skippedDuplicate > 0 && <> · {runReport.skippedDuplicate} already imported</>}
            {runReport.notEvent > 0 && <> · {runReport.notEvent} not events</>}
            {runReport.unreadable > 0 && <> · {runReport.unreadable} unreadable</>}. New candidates are
            in{' '}
            <Link href="/admin/event-radar" className="text-white/85 underline-offset-2 hover:underline">
              Event Radar
            </Link>
            .
          </span>
        </div>
      )}

      {sources.length === 0 ? (
        <p className="rounded-xl border border-white/[0.07] bg-white/[0.02] px-4 py-6 text-center text-sm text-white/45">
          No sources yet. Paste a list of links above to build your registry.
        </p>
      ) : (
        <ul className="space-y-2">
          {sources.map((s) => (
            <li
              key={s.id}
              className="flex items-center gap-3 rounded-xl border border-white/[0.07] bg-white/[0.02] px-4 py-3"
            >
              <button
                type="button"
                onClick={() => void toggle(s)}
                disabled={busyId === s.id}
                title={s.enabled ? 'Enabled — click to pause' : 'Paused — click to enable'}
                className={[
                  'relative h-5 w-9 flex-shrink-0 rounded-full transition disabled:opacity-50',
                  s.enabled ? 'bg-flame-500' : 'bg-white/15',
                ].join(' ')}
              >
                <span
                  className={[
                    'absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all',
                    s.enabled ? 'left-4' : 'left-0.5',
                  ].join(' ')}
                />
              </button>

              <div className="min-w-0 flex-1">
                <p className={`truncate text-sm font-medium ${s.enabled ? 'text-white/90' : 'text-white/45'}`}>
                  {s.label || hostOf(s.url)}
                </p>
                <p className="mt-0.5 truncate text-[11px] text-white/40">{s.url}</p>
              </div>

              <span className="hidden shrink-0 text-[11px] text-white/45 sm:block">{lastRunLabel(s)}</span>

              <a
                href={s.url}
                target="_blank"
                rel="noopener noreferrer"
                title="Open source"
                className="shrink-0 text-white/30 transition hover:text-white/70"
              >
                <ExternalLink className="h-4 w-4" />
              </a>
              <button
                type="button"
                onClick={() => void remove(s)}
                disabled={busyId === s.id}
                title="Remove source"
                className="shrink-0 text-white/30 transition hover:text-flame-300 disabled:opacity-50"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
