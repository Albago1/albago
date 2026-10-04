'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, ExternalLink, Loader2, Radar, Sparkles, TriangleAlert, X } from 'lucide-react'

export type ReviewCard = {
  id: string
  title: string
  eventType: string
  date: string
  time: string | null
  endDate: string | null
  endTime: string | null
  venue: string | null
  address: string | null
  locality: string | null
  countryCode: string | null
  price: { state: string; min: number | null; max: number | null; currency: string | null; note: string | null }
  performers: string[]
  relevance: 'relevant' | 'possible' | 'not_relevant' | null
  relevanceSignals: string[]
  sources: string[]
  issues: string[]
  possibleDuplicates: number
  provenance: Record<string, string>
  /** Reasons AlbaGo would still hold it back after approval (empty = would publish). */
  wouldPublish: string[]
}

export type RunSummary = { id: string; status: string; startedAt: string; stats: Record<string, number> }

type Edits = { title: string; start_date: string; start_time: string; locality: string }

const STATUS_TONE: Record<string, string> = {
  stated: 'text-emerald-300',
  derived: 'text-sky-300',
  missing: 'text-white/35',
  conflicting: 'text-amber-300',
}

function priceLabel(p: ReviewCard['price']): string {
  if (p.state === 'free') return 'Free'
  if (p.state === 'paid' && p.min != null) return `${p.min}${p.max ? `–${p.max}` : ''} ${p.currency ?? ''}`.trim()
  return 'Price not announced'
}

function host(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

export default function EngineReviewClient({ initialCards, recentRuns }: { initialCards: ReviewCard[]; recentRuns: RunSummary[] }) {
  const router = useRouter()
  const [cards, setCards] = useState(initialCards)
  const [busy, setBusy] = useState<string | null>(null)
  const [notice, setNotice] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null)
  const [edits, setEdits] = useState<Record<string, Edits>>({})
  const [running, setRunning] = useState(false)

  const editsFor = (c: ReviewCard): Edits =>
    edits[c.id] ?? { title: c.title, start_date: c.date, start_time: c.time ?? '', locality: c.locality ?? '' }

  async function act(card: ReviewCard, action: 'verify' | 'reject') {
    setBusy(card.id)
    setNotice(null)
    try {
      let payload: Record<string, unknown> = { id: card.id, action }
      if (action === 'verify') {
        const e = editsFor(card)
        const changed: Record<string, string> = {}
        if (e.title.trim() && e.title.trim() !== card.title) changed.title = e.title.trim()
        if (e.start_date && e.start_date !== card.date) changed.start_date = e.start_date
        if (e.start_time !== (card.time ?? '')) changed.start_time = e.start_time
        if (e.locality.trim() !== (card.locality ?? '')) changed.locality = e.locality.trim()
        payload = { ...payload, edits: changed }
      } else {
        const reason = window.prompt('Why reject this? (kept as a correction for the engine)', 'not a real event / wrong details')
        if (reason === null) return
        payload = { ...payload, reason }
      }
      const res = await fetch('/api/admin/engine/review', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      const body = await res.json()
      if (!res.ok || !body.ok) throw new Error(body.message ?? body.error ?? 'failed')
      setCards((prev) => prev.filter((c) => c.id !== card.id))
      if (action === 'reject') setNotice({ tone: 'ok', text: `Rejected “${card.title}”.` })
      else if (body.delivery?.delivered) setNotice({ tone: 'ok', text: `Verified and published on AlbaGo: /events/${body.delivery.slug}` })
      else setNotice({ tone: 'ok', text: `Verified. Not published on AlbaGo yet: ${(body.delivery?.reasons ?? []).join(', ')}` })
    } catch (error) {
      setNotice({ tone: 'error', text: error instanceof Error ? error.message : 'Something went wrong' })
    } finally {
      setBusy(null)
    }
  }

  async function runDiscovery() {
    setRunning(true)
    setNotice({ tone: 'ok', text: 'AI discovery running — searching the web for Tirana events (up to ~4 minutes)…' })
    try {
      const res = await fetch('/api/admin/engine/discover', { method: 'POST' })
      const body = await res.json()
      if (!res.ok || !body.ok) throw new Error(body.message ?? body.error ?? 'failed')
      const s = body.stats ?? {}
      setNotice({ tone: 'ok', text: `Run ${body.status}: ${s.searches ?? 0} searches, ${s.pages_read ?? 0} pages read, ${s.new ?? 0} new, ${s.attached ?? 0} merged.` })
      router.refresh()
    } catch (error) {
      setNotice({ tone: 'error', text: error instanceof Error ? error.message : 'Discovery failed' })
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className="mx-auto max-w-5xl">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-flame-300/80">Event Engine</p>
          <h1 className="mt-1 text-2xl font-semibold text-white">Review AI-found events</h1>
          <p className="mt-1 max-w-xl text-sm text-white/55">
            Approve to confirm an event is real and correct. AlbaGo then publishes it if it meets AlbaGo&apos;s rules.
          </p>
        </div>
        <button
          type="button"
          onClick={runDiscovery}
          disabled={running}
          className="inline-flex items-center gap-2 rounded-full border border-flame-500/40 bg-flame-500/10 px-4 py-2.5 text-sm font-semibold text-flame-100 transition hover:bg-flame-500/20 disabled:opacity-60"
        >
          {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Radar className="h-4 w-4" />}
          Run AI discovery: Tirana, 14 days
        </button>
      </div>

      {notice && (
        <div className={`mt-4 rounded-2xl border px-4 py-3 text-sm ${notice.tone === 'ok' ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-100' : 'border-red-500/30 bg-red-500/10 text-red-100'}`}>
          {notice.text}
        </div>
      )}

      {recentRuns.length > 0 && (
        <div className="mt-5 flex flex-wrap gap-2 text-xs text-white/50">
          {recentRuns.map((r) => (
            <span key={r.id} className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1">
              {new Date(r.startedAt).toLocaleString()} · {r.status} · {r.stats.new ?? 0} new · {r.stats.searches ?? 0} searches
            </span>
          ))}
        </div>
      )}

      {cards.length === 0 ? (
        <div className="mt-8 rounded-3xl border border-white/10 bg-white/[0.03] p-10 text-center text-white/55">
          <Sparkles className="mx-auto h-6 w-6 text-flame-300" />
          <p className="mt-3">Nothing waiting for review. Run AI discovery to find events.</p>
        </div>
      ) : (
        <ul className="mt-6 space-y-4">
          {cards.map((c) => {
            const e = editsFor(c)
            const setE = (patch: Partial<Edits>) => setEdits((prev) => ({ ...prev, [c.id]: { ...e, ...patch } }))
            return (
              <li key={c.id} className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <input
                      value={e.title}
                      onChange={(ev) => setE({ title: ev.target.value })}
                      aria-label="Title"
                      className="w-full bg-transparent text-lg font-semibold text-white outline-none focus:underline"
                    />
                    <p className="mt-1 text-xs uppercase tracking-wide text-white/45">
                      {c.eventType.replace(/_/g, ' ')} · {c.venue ?? 'venue unknown'} · {c.locality ?? 'city unknown'}
                      {c.countryCode ? `, ${c.countryCode}` : ''}
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${c.relevance === 'relevant' ? 'bg-emerald-500/15 text-emerald-200' : c.relevance === 'possible' ? 'bg-amber-500/15 text-amber-200' : 'bg-white/10 text-white/60'}`}
                  >
                    {c.relevance ? `Albanian relevance: ${c.relevance.replace('_', ' ')}` : 'relevance not assessed'}
                  </span>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-4">
                  <label className="text-xs text-white/50">
                    Date
                    <input type="date" value={e.start_date} onChange={(ev) => setE({ start_date: ev.target.value })} className="mt-1 w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white" />
                  </label>
                  <label className="text-xs text-white/50">
                    Start time {c.time ? '' : <span className="text-amber-300">(unknown)</span>}
                    <input type="time" value={e.start_time} onChange={(ev) => setE({ start_time: ev.target.value })} className="mt-1 w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white" />
                  </label>
                  <label className="text-xs text-white/50">
                    City
                    <input value={e.locality} onChange={(ev) => setE({ locality: ev.target.value })} className="mt-1 w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white" />
                  </label>
                  <div className="text-xs text-white/50">
                    Price
                    <p className="mt-1 rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2 text-sm text-white/80">{priceLabel(c.price)}</p>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px]">
                  {Object.entries(c.provenance).map(([field, status]) => (
                    <span key={field} className={STATUS_TONE[status] ?? 'text-white/40'}>
                      {field}: {status}
                    </span>
                  ))}
                </div>

                {c.performers.length > 0 && <p className="mt-2 text-sm text-white/65">With {c.performers.join(', ')}</p>}
                {c.relevanceSignals.length > 0 && <p className="mt-1 text-xs text-white/45">Why relevant: {c.relevanceSignals.join(' · ')}</p>}

                <div className="mt-3 flex flex-wrap gap-2">
                  {c.sources.map((s) => (
                    <a key={s} href={s} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-full border border-white/10 px-3 py-1 text-xs text-white/70 hover:text-white">
                      {host(s)} <ExternalLink className="h-3 w-3" />
                    </a>
                  ))}
                </div>

                {(c.issues.length > 0 || c.possibleDuplicates > 0 || c.wouldPublish.length > 0) && (
                  <div className="mt-3 space-y-1 text-xs text-amber-200/90">
                    {c.possibleDuplicates > 0 && (
                      <p className="flex items-center gap-1.5"><TriangleAlert className="h-3.5 w-3.5" /> Possible duplicate of {c.possibleDuplicates} other event{c.possibleDuplicates > 1 ? 's' : ''}</p>
                    )}
                    {c.issues.length > 0 && <p className="flex items-center gap-1.5"><TriangleAlert className="h-3.5 w-3.5" /> Reading issues: {c.issues.join(', ')}</p>}
                    {c.wouldPublish.length > 0 && <p className="flex items-center gap-1.5"><TriangleAlert className="h-3.5 w-3.5" /> AlbaGo would hold it back: {c.wouldPublish.join(', ')}</p>}
                  </div>
                )}

                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={busy === c.id}
                    onClick={() => act(c, 'verify')}
                    className="inline-flex items-center gap-2 rounded-full bg-flame-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-flame-400 disabled:opacity-60"
                  >
                    {busy === c.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                    Approve &amp; publish
                  </button>
                  <button
                    type="button"
                    disabled={busy === c.id}
                    onClick={() => act(c, 'reject')}
                    className="inline-flex items-center gap-2 rounded-full border border-white/15 px-4 py-2 text-sm font-semibold text-white/80 transition hover:bg-white/[0.06] disabled:opacity-60"
                  >
                    <X className="h-4 w-4" /> Reject
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
