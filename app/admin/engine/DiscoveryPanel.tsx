'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Globe2, Loader2, Radar, TriangleAlert, X } from 'lucide-react'

export type PlanItem = { id: string; label: string; kind: 'worldwide' | 'region' | 'diaspora' | 'artists'; lastRun: number | null; due: number }
export type DiscoveryOverviewProps = {
  usage: { monthSearches: number; todayRuns: number; running: boolean }
  limits: { monthlySearches: number; dailyRuns: number }
  searchConfigured: boolean
  plan: PlanItem[]
  artists: number
}
export type ArtistCandidate = { id: string; name: string; seenIn: string[] }

const REASONS: Record<string, string> = {
  search_key_missing: 'Search is not configured on this server (TAVILY_API_KEY).',
  another_run_in_progress: 'Another discovery run is still going. Try again in a few minutes.',
  daily_run_limit: 'Daily run limit reached (protects the free AI quota). It resets at midnight UTC.',
  monthly_search_budget_used: 'This month’s free search budget is used up. It resets on the 1st.',
  nothing_due: 'Everything was researched recently. Nothing is due yet.',
  unknown_goal: 'That target no longer exists. Refresh the page.',
}

const GROUPS: Array<{ kind: PlanItem['kind']; label: string }> = [
  { kind: 'worldwide', label: 'Worldwide' },
  { kind: 'region', label: 'Albanian region' },
  { kind: 'diaspora', label: 'Diaspora cities' },
  { kind: 'artists', label: 'Artist watch' },
]

function ago(ts: number | null): string {
  if (ts == null) return 'never'
  const days = Math.floor((Date.now() - ts) / 86_400_000)
  if (days <= 0) return 'today'
  return days === 1 ? '1 day ago' : `${days} days ago`
}

function Meter({ label, used, max }: { label: string; used: number; max: number }) {
  const pct = Math.min(100, Math.round((used / Math.max(max, 1)) * 100))
  return (
    <div className="min-w-[9rem] flex-1">
      <div className="flex justify-between text-[11px] text-white/50">
        <span>{label}</span>
        <span className="tabular-nums">
          {used} / {max}
        </span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/10">
        <div className={`h-full rounded-full ${pct >= 90 ? 'bg-amber-400' : 'bg-flame-500'}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

export default function DiscoveryPanel({ overview, candidates }: { overview: DiscoveryOverviewProps; candidates: ArtistCandidate[] }) {
  const router = useRouter()
  const [target, setTarget] = useState('next')
  const [running, setRunning] = useState(false)
  const [notice, setNotice] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null)
  const [decided, setDecided] = useState<Set<string>>(new Set())
  const due = overview.plan.filter((p) => p.due >= 1).length
  const next = overview.plan.find((p) => p.due >= 1)

  async function run() {
    setRunning(true)
    setNotice({ tone: 'ok', text: 'Researching… this takes up to 4 minutes.' })
    try {
      const res = await fetch('/api/admin/engine/discover', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ goal: target }) })
      const body = await res.json()
      if (!res.ok || !body.ok) throw new Error(body.message ?? body.error ?? 'failed')
      if (!body.ran) {
        setNotice({ tone: 'error', text: REASONS[body.reason] ?? body.reason })
        return
      }
      const s = body.stats ?? {}
      setNotice({
        tone: 'ok',
        text: `${body.goal}: ${s.searches ?? 0} searches, ${s.pages_read ?? 0} pages read, ${s.new ?? 0} new events, ${s.attached ?? 0} merged${s.entities_proposed ? `, ${s.entities_proposed} new artists to confirm` : ''}.`,
      })
      router.refresh()
    } catch (error) {
      setNotice({ tone: 'error', text: error instanceof Error ? error.message : 'Discovery failed' })
    } finally {
      setRunning(false)
    }
  }

  async function decide(c: ArtistCandidate, decision: 'confirm' | 'reject') {
    setDecided((prev) => new Set(prev).add(c.id))
    const res = await fetch('/api/admin/engine/artists', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: c.id, decision }) }).catch(() => null)
    if (!res?.ok) {
      setDecided((prev) => {
        const nextSet = new Set(prev)
        nextSet.delete(c.id)
        return nextSet
      })
      setNotice({ tone: 'error', text: `Could not save the decision for ${c.name}.` })
    }
  }

  const open = candidates.filter((c) => !decided.has(c.id))

  return (
    <section className="mt-6 rounded-3xl border border-white/10 bg-white/[0.03] p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Globe2 className="h-4 w-4 text-flame-300" />
          <h2 className="text-sm font-semibold text-white">Worldwide discovery</h2>
          <span className="text-xs text-white/45">
            {due} of {overview.plan.length} targets due · {overview.artists} artists watched
          </span>
        </div>
      </div>
      <p className="mt-1 text-xs text-white/55">
        Runs by itself 5× a day and always picks what is most overdue. Nothing to choose. Use the button only to search something right now.
      </p>

      <div className="mt-4 flex flex-wrap gap-4">
        <Meter label="Searches this month (free plan)" used={overview.usage.monthSearches} max={overview.limits.monthlySearches} />
        <Meter label="Runs today" used={overview.usage.todayRuns} max={overview.limits.dailyRuns} />
      </div>

      {!overview.searchConfigured && (
        <p className="mt-3 flex items-center gap-1.5 text-xs text-amber-200/90">
          <TriangleAlert className="h-3.5 w-3.5" /> Search is not configured on this server. Add TAVILY_API_KEY in Vercel to run discovery here.
        </p>
      )}

      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <select
          value={target}
          onChange={(e) => setTarget(e.target.value)}
          aria-label="What to research"
          className="min-w-0 flex-1 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm text-white [&_option]:bg-[#111]"
        >
          <option value="next">Automatic: most overdue{next ? ` (now: ${next.label})` : ' (nothing due)'}</option>
          {GROUPS.map((g) => (
            <optgroup key={g.kind} label={g.label}>
              {overview.plan
                .filter((p) => p.kind === g.kind)
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label} · {ago(p.lastRun)}
                    {p.due >= 1 ? ' · due' : ''}
                  </option>
                ))}
            </optgroup>
          ))}
        </select>
        <button
          type="button"
          onClick={run}
          disabled={running || overview.usage.running}
          className="inline-flex items-center justify-center gap-2 rounded-full border border-flame-500/40 bg-flame-500/10 px-4 py-2.5 text-sm font-semibold text-flame-100 transition hover:bg-flame-500/20 disabled:opacity-60"
        >
          {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Radar className="h-4 w-4" />}
          {overview.usage.running && !running ? 'A run is in progress' : 'Search now'}
        </button>
      </div>

      {notice && (
        <p className={`mt-3 rounded-2xl border px-4 py-2.5 text-sm ${notice.tone === 'ok' ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-100' : 'border-amber-500/30 bg-amber-500/10 text-amber-100'}`}>{notice.text}</p>
      )}

      {open.length > 0 && (
        <div className="mt-5">
          <h3 className="text-sm font-semibold text-white/80">New artists to confirm · {open.length}</h3>
          <p className="mt-0.5 text-xs text-white/45">Found in Albanian events. Confirm the Albanian ones and the engine watches them worldwide.</p>
          <ul className="mt-3 flex flex-wrap gap-2">
            {open.map((c) => (
              <li key={c.id} className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] py-1 pl-3 pr-1 text-sm text-white">
                <span title={c.seenIn.length ? `Seen in: ${c.seenIn.join(' · ')}` : undefined}>{c.name}</span>
                <button type="button" onClick={() => decide(c, 'confirm')} aria-label={`${c.name} is Albanian`} className="rounded-full p-1.5 text-emerald-300 transition hover:bg-emerald-500/15">
                  <Check className="h-3.5 w-3.5" />
                </button>
                <button type="button" onClick={() => decide(c, 'reject')} aria-label={`${c.name} is not Albanian`} className="rounded-full p-1.5 text-white/50 transition hover:bg-white/10 hover:text-white">
                  <X className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}
