'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, ExternalLink, FlaskConical, Library, Loader2, Pause, Play, RefreshCw, X } from 'lucide-react'
import type { SourcePreview } from '@/engine/server'
import type { SourceRow } from '@/integrations/albago/runner'
import { ago, Meter } from './DiscoveryPanel'

export type SourcesPanelProps = {
  sources: SourceRow[]
  limits: { dailyPages: number; perRun: number }
  usage: { pagesToday: number; running: boolean }
}

const INTERVALS = [
  { hours: 24, label: 'Daily' },
  { hours: 72, label: 'Every 3 days' },
  { hours: 168, label: 'Weekly' },
]

const REASONS: Record<string, string> = {
  monitor_running: 'A check is already running. Try again in a few minutes.',
  daily_page_limit: 'Today’s page limit is reached (it protects the free AI quota). It resets at midnight UTC.',
  nothing_due: 'Every approved website was checked recently. Nothing is due yet.',
}

const UNREADABLE: Record<string, string> = {
  unreadable: 'Could not read this page: its robots.txt refuses AlbaGoBot, the site is down, or it is not a web page.',
  bad_url: 'This is not a usable web address.',
}

const COLLAPSED = 8

function hostPath(url: string): string {
  try {
    const u = new URL(url)
    return `${u.host.replace(/^www\./, '')}${u.pathname === '/' ? '' : u.pathname}${u.search}`
  } catch {
    return url
  }
}

function intervalLabel(hours: number): string {
  return INTERVALS.find((i) => i.hours === hours)?.label ?? `Every ${Math.round(hours / 24)} days`
}

function TestResult({ preview }: { preview: SourcePreview }) {
  if (!preview.ok) return <p className="text-xs text-amber-200/90">{UNREADABLE[preview.reason] ?? preview.reason}</p>
  const albanian = preview.events.filter((e) => e.relevance === 'relevant').length
  const known = preview.events.filter((e) => e.known).length
  if (!preview.events.length) {
    return (
      <p className="text-xs text-white/60">
        No upcoming Albanian events on this page right now
        {preview.notRelevant ? ` (${preview.notRelevant} other events)` : ''}
        {preview.skipped ? ` · ${preview.skipped} past or far ahead` : ''}.
      </p>
    )
  }
  return (
    <div>
      <p className="text-xs text-white/75">
        <span className="font-semibold text-white">{preview.events.length}</span> upcoming events · {albanian} Albanian
        {known ? ` · ${known} already known` : ''}
        {preview.notRelevant ? ` · ${preview.notRelevant} others left out` : ''}
      </p>
      <ul className="mt-2 space-y-1">
        {preview.events.slice(0, 6).map((e, i) => (
          <li key={i} className="flex gap-2 text-xs text-white/65">
            <span className="shrink-0 tabular-nums text-white/45">{e.date ?? '—'}</span>
            <span className="min-w-0 truncate">
              {e.title}
              {e.place ? <span className="text-white/40"> · {e.place}</span> : null}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export default function SourcesPanel({ sources, limits, usage }: SourcesPanelProps) {
  const router = useRouter()
  const [busy, setBusy] = useState<string | null>(null)
  const [tests, setTests] = useState<Record<string, SourcePreview | 'loading'>>({})
  const [notice, setNotice] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null)
  const [showAll, setShowAll] = useState(false)
  const [running, setRunning] = useState(false)

  const proposed = sources.filter((s) => s.status === 'proposed')
  const active = sources.filter((s) => s.status === 'active')
  const paused = sources.filter((s) => s.status === 'paused')
  const rejected = sources.filter((s) => s.status === 'rejected')

  async function act(s: SourceRow, action: 'approve' | 'reject' | 'pause' | 'interval', hours?: number) {
    setBusy(s.id)
    try {
      const res = await fetch('/api/admin/engine/sources', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: s.id, action, hours }) })
      const body = await res.json().catch(() => ({}))
      if (!res.ok || !body.ok) throw new Error(body.message ?? body.error ?? 'failed')
      router.refresh()
    } catch {
      setNotice({ tone: 'error', text: `Could not save the change for ${s.label}.` })
    } finally {
      setBusy(null)
    }
  }

  async function test(s: SourceRow) {
    setTests((t) => ({ ...t, [s.id]: 'loading' }))
    try {
      const res = await fetch('/api/admin/engine/sources/test', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: s.id }) })
      const body = await res.json()
      if (!res.ok || !body.ok) throw new Error(body.message ?? body.error ?? 'failed')
      setTests((t) => ({ ...t, [s.id]: body.preview as SourcePreview }))
    } catch (error) {
      setTests((t) => {
        const next = { ...t }
        delete next[s.id]
        return next
      })
      setNotice({ tone: 'error', text: `Test of ${s.label} failed: ${error instanceof Error ? error.message : 'unknown error'}` })
    }
  }

  async function checkNow() {
    setRunning(true)
    setNotice({ tone: 'ok', text: 'Reading the approved websites that are due… this can take a few minutes.' })
    try {
      const res = await fetch('/api/admin/engine/sources/run', { method: 'POST' })
      const body = await res.json()
      if (!res.ok || !body.ok) throw new Error(body.message ?? body.error ?? 'failed')
      if (!body.ran) {
        setNotice({ tone: 'error', text: REASONS[body.reason] ?? body.reason })
        return
      }
      const s = body.stats ?? {}
      setNotice({ tone: 'ok', text: `${s.sources ?? 0} websites read: ${s.new ?? 0} new events, ${s.known ?? 0} already known, ${s.unchanged ?? 0} unchanged${s.errors ? `, ${s.errors} could not be read` : ''}.` })
      router.refresh()
    } catch (error) {
      setNotice({ tone: 'error', text: error instanceof Error ? error.message : 'Check failed' })
    } finally {
      setRunning(false)
    }
  }

  const testButton = (s: SourceRow) => (
    <button
      type="button"
      onClick={() => test(s)}
      disabled={tests[s.id] === 'loading'}
      className="inline-flex items-center gap-1.5 rounded-full border border-white/10 px-3 py-1.5 text-xs text-white/75 transition hover:bg-white/10 disabled:opacity-60"
    >
      {tests[s.id] === 'loading' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FlaskConical className="h-3.5 w-3.5" />}
      Test
    </button>
  )

  const testBlock = (s: SourceRow) => {
    const t = tests[s.id]
    if (!t) return null
    return (
      <div className="mt-3 rounded-2xl border border-white/10 bg-black/20 px-3 py-2.5">
        {t === 'loading' ? <p className="text-xs text-white/55">Reading the page… up to a minute.</p> : <TestResult preview={t} />}
      </div>
    )
  }

  const title = (s: SourceRow) => (
    <a href={s.url} target="_blank" rel="noreferrer" className="group inline-flex min-w-0 items-center gap-1.5 text-sm font-semibold text-white hover:text-flame-200">
      <span className="truncate">{hostPath(s.url)}</span>
      <ExternalLink className="h-3.5 w-3.5 shrink-0 text-white/35 group-hover:text-flame-200" />
    </a>
  )

  const shown = showAll ? proposed : proposed.slice(0, COLLAPSED)

  return (
    <section className="mt-6 rounded-3xl border border-white/10 bg-white/[0.03] p-5">
      <div className="flex flex-wrap items-center gap-2">
        <Library className="h-4 w-4 text-flame-300" />
        <h2 className="text-sm font-semibold text-white">Known websites</h2>
        <span className="text-xs text-white/45">
          {active.length} watched · {proposed.length} waiting for you
        </span>
      </div>
      <p className="mt-1 text-xs text-white/55">
        Websites you approve are read again 3× a day, without using any searches. A page that hasn’t changed costs nothing. Test a site first to see what it would bring in.
      </p>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
        <Meter label="Pages read today" used={usage.pagesToday} max={limits.dailyPages} />
        {active.length > 0 && (
          <button
            type="button"
            onClick={checkNow}
            disabled={running || usage.running}
            className="inline-flex items-center justify-center gap-2 rounded-full border border-flame-500/40 bg-flame-500/10 px-4 py-2.5 text-sm font-semibold text-flame-100 transition hover:bg-flame-500/20 disabled:opacity-60"
          >
            {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            {usage.running && !running ? 'A check is running' : 'Check due websites now'}
          </button>
        )}
      </div>

      {notice && (
        <p className={`mt-3 rounded-2xl border px-4 py-2.5 text-sm ${notice.tone === 'ok' ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-100' : 'border-amber-500/30 bg-amber-500/10 text-amber-100'}`}>{notice.text}</p>
      )}

      {proposed.length > 0 && (
        <div className="mt-5">
          <h3 className="text-sm font-semibold text-white/80">Waiting for your OK · {proposed.length}</h3>
          <p className="mt-0.5 text-xs text-white/45">Found by the research agent or carried over from the old crawler. Approve the ones that list real events.</p>
          <ul className="mt-3 space-y-2">
            {shown.map((s) => (
              <li key={s.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    {title(s)}
                    {s.why && <p className="mt-0.5 text-xs text-white/50">{s.why}</p>}
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-1.5">
                    {testButton(s)}
                    <button
                      type="button"
                      onClick={() => act(s, 'approve')}
                      disabled={busy === s.id}
                      className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-100 transition hover:bg-emerald-500/20 disabled:opacity-60"
                    >
                      <Check className="h-3.5 w-3.5" /> Approve
                    </button>
                    <button
                      type="button"
                      onClick={() => act(s, 'reject')}
                      disabled={busy === s.id}
                      aria-label={`Reject ${s.label}`}
                      className="inline-flex items-center gap-1.5 rounded-full border border-white/10 px-3 py-1.5 text-xs text-white/60 transition hover:bg-white/10 hover:text-white disabled:opacity-60"
                    >
                      <X className="h-3.5 w-3.5" /> Reject
                    </button>
                  </div>
                </div>
                {testBlock(s)}
              </li>
            ))}
          </ul>
          {proposed.length > COLLAPSED && (
            <button type="button" onClick={() => setShowAll((v) => !v)} className="mt-2 text-xs font-semibold text-flame-200 hover:text-flame-100">
              {showAll ? 'Show fewer' : `Show all ${proposed.length}`}
            </button>
          )}
        </div>
      )}

      {active.length > 0 && (
        <div className="mt-5">
          <h3 className="text-sm font-semibold text-white/80">Watched · {active.length}</h3>
          <ul className="mt-3 space-y-2">
            {active.map((s) => (
              <li key={s.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    {title(s)}
                    <p className="mt-0.5 text-xs text-white/50">
                      {s.lastChecked ? `Checked ${ago(Date.parse(s.lastChecked))}` : 'Not checked yet'}
                      {s.due ? ' · due' : ''} · {s.card.visits} visits · {s.card.events_found} events found · {s.card.relevant_found} Albanian · {s.verified} approved by you
                    </p>
                    {s.lastStatus === 'error' && s.lastError && <p className="mt-0.5 text-xs text-amber-200/90">Last read failed: {s.lastError}</p>}
                    {s.lastStatus === 'empty' && <p className="mt-0.5 text-xs text-white/40">Last read found no events.</p>}
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                    <select
                      value={s.intervalHours}
                      onChange={(e) => act(s, 'interval', Number(e.target.value))}
                      disabled={busy === s.id}
                      aria-label={`How often to read ${s.label}`}
                      className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-white [&_option]:bg-[#111]"
                    >
                      {[...INTERVALS, ...(INTERVALS.some((i) => i.hours === s.intervalHours) ? [] : [{ hours: s.intervalHours, label: intervalLabel(s.intervalHours) }])].map((i) => (
                        <option key={i.hours} value={i.hours}>
                          {i.label}
                        </option>
                      ))}
                    </select>
                    {testButton(s)}
                    <button
                      type="button"
                      onClick={() => act(s, 'pause')}
                      disabled={busy === s.id}
                      className="inline-flex items-center gap-1.5 rounded-full border border-white/10 px-3 py-1.5 text-xs text-white/60 transition hover:bg-white/10 hover:text-white disabled:opacity-60"
                    >
                      <Pause className="h-3.5 w-3.5" /> Pause
                    </button>
                  </div>
                </div>
                {testBlock(s)}
              </li>
            ))}
          </ul>
        </div>
      )}

      {paused.length > 0 && (
        <div className="mt-5">
          <h3 className="text-sm font-semibold text-white/80">Paused · {paused.length}</h3>
          <ul className="mt-3 space-y-2">
            {paused.map((s) => (
              <li key={s.id} className="flex flex-col gap-2 rounded-2xl border border-white/10 bg-white/[0.03] p-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  {title(s)}
                  {s.statusReason && <p className="mt-0.5 text-xs text-amber-200/80">{s.statusReason}</p>}
                </div>
                <button
                  type="button"
                  onClick={() => act(s, 'approve')}
                  disabled={busy === s.id}
                  className="inline-flex shrink-0 items-center gap-1.5 self-start rounded-full border border-white/10 px-3 py-1.5 text-xs text-white/75 transition hover:bg-white/10 disabled:opacity-60"
                >
                  <Play className="h-3.5 w-3.5" /> Resume
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {rejected.length > 0 && (
        <details className="mt-5">
          <summary className="cursor-pointer text-xs text-white/45 hover:text-white/70">Rejected · {rejected.length}</summary>
          <ul className="mt-2 space-y-1">
            {rejected.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-2 text-xs text-white/50">
                <span className="min-w-0 truncate">{hostPath(s.url)}</span>
                <button type="button" onClick={() => act(s, 'approve')} disabled={busy === s.id} className="shrink-0 text-flame-200 hover:text-flame-100">
                  Approve instead
                </button>
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  )
}
