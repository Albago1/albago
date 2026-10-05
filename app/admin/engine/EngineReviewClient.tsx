'use client'

import { Fragment, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { Check, ExternalLink, Loader2, Sparkles, TriangleAlert, X } from 'lucide-react'

export type ReviewCard = {
  id: string
  version: number
  /** review = waiting for a decision; approved = verified but not on AlbaGo yet; published = live on AlbaGo. */
  stage: 'review' | 'approved' | 'published'
  albagoSlug: string | null
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

export type RunSummary = { id: string; goal: string; status: string; startedAt: string; stats: Record<string, number> }

type Edits = { title: string; start_date: string; start_time: string; locality: string; price_state: string; price_amount: string; price_currency: string }

const CURRENCIES = ['ALL', 'EUR', 'USD', 'GBP', 'CHF']

const STAGE_HEADING: Record<ReviewCard['stage'], { title: string; hint?: string }> = {
  approved: { title: 'Approved, not on AlbaGo yet', hint: 'Fix what holds it back, then publish.' },
  review: { title: 'Waiting for review' },
  published: { title: 'On AlbaGo', hint: 'Correct anything here and save. The AlbaGo page updates.' },
}

const FIELD = 'mt-1 w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white [&>option]:bg-[#111]'

/** The reviewer's price choice as a contract price, or undefined when unchanged. */
function priceEdit(card: ReviewCard, e: Edits): ReviewCard['price'] | undefined {
  const amount = e.price_amount.trim() === '' ? null : Number(e.price_amount)
  const same =
    e.price_state === card.price.state &&
    (e.price_state !== 'paid' || (amount === card.price.min && e.price_currency === (card.price.currency ?? '')))
  if (same) return undefined
  if (e.price_state === 'free') return { state: 'free', min: null, max: null, currency: null, note: card.price.note }
  if (e.price_state === 'paid') return { state: 'paid', min: amount, max: null, currency: e.price_currency || null, note: card.price.note }
  return { state: 'unknown', min: null, max: null, currency: null, note: null }
}

const STATUS_TONE: Record<string, string> = {
  stated: 'text-emerald-300',
  derived: 'text-sky-300',
  missing: 'text-white/35',
  conflicting: 'text-amber-300',
}

function host(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

export default function EngineReviewClient({ initialCards, recentRuns, discovery }: { initialCards: ReviewCard[]; recentRuns: RunSummary[]; discovery?: ReactNode }) {
  const router = useRouter()
  // Cards handled in this session, keyed by id:version — every approval bumps
  // the version, so a card that comes back after a refresh (held back) shows again.
  const [handled, setHandled] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState<string | null>(null)
  const [notice, setNotice] = useState<{ tone: 'ok' | 'error'; text: string; href?: string } | null>(null)
  const [edits, setEdits] = useState<Record<string, Edits>>({})

  const editsFor = (c: ReviewCard): Edits =>
    edits[c.id] ?? {
      title: c.title,
      start_date: c.date,
      start_time: c.time ?? '',
      locality: c.locality ?? '',
      price_state: c.price.state,
      price_amount: c.price.min != null ? String(c.price.min) : '',
      price_currency: c.price.currency ?? 'ALL',
    }

  async function act(card: ReviewCard, action: 'verify' | 'reject') {
    setBusy(card.id)
    setNotice(null)
    try {
      let payload: Record<string, unknown> = { id: card.id, action }
      if (action === 'verify') {
        const e = editsFor(card)
        const changed: Record<string, unknown> = {}
        if (e.title.trim() && e.title.trim() !== card.title) changed.title = e.title.trim()
        if (e.start_date && e.start_date !== card.date) changed.start_date = e.start_date
        if (e.start_time !== (card.time ?? '')) changed.start_time = e.start_time
        if (e.locality.trim() !== (card.locality ?? '')) changed.locality = e.locality.trim()
        const price = priceEdit(card, e)
        if (price) {
          if (price.state === 'paid' && (price.min == null || !Number.isFinite(price.min) || price.min < 0)) throw new Error('Enter the ticket price as a number.')
          changed.price = price
        }
        if (card.stage === 'published' && Object.keys(changed).length === 0) {
          setNotice({ tone: 'ok', text: 'Nothing changed.' })
          return
        }
        payload = { ...payload, edits: changed }
      } else {
        const reason = window.prompt('Why reject this? (kept as a correction for the engine)', 'not a real event / wrong details')
        if (reason === null) return
        payload = { ...payload, reason }
      }
      const res = await fetch('/api/admin/engine/review', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      const body = await res.json()
      if (!res.ok || !body.ok) throw new Error(body.message ?? body.error ?? 'failed')
      setHandled((prev) => new Set(prev).add(`${card.id}:${card.version}`))
      if (action === 'reject') setNotice({ tone: 'ok', text: `Rejected “${card.title}”.` })
      else if (body.delivery?.delivered) setNotice({ tone: 'ok', text: `${body.delivery.updated ? 'Updated' : 'Published'} on AlbaGo: “${card.title}”. Open it →`, href: `/events/${body.delivery.slug}` })
      else setNotice({ tone: 'ok', text: `Approved, but not on AlbaGo yet: ${(body.delivery?.reasons ?? []).join(', ')}. Fix it under “Approved, not on AlbaGo yet”.` })
    } catch (error) {
      setNotice({ tone: 'error', text: error instanceof Error ? error.message : 'Something went wrong' })
    } finally {
      setBusy(null)
      router.refresh() // a failed publish leaves the event approved — the refresh moves it to that section
    }
  }

  const visible = initialCards.filter((c) => !handled.has(`${c.id}:${c.version}`))
  const stageCount = (stage: ReviewCard['stage']) => visible.filter((c) => c.stage === stage).length

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
      </div>

      {discovery}

      {notice && (
        <div className={`mt-4 rounded-2xl border px-4 py-3 text-sm ${notice.tone === 'ok' ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-100' : 'border-red-500/30 bg-red-500/10 text-red-100'}`}>
          {notice.href ? (
            <a href={notice.href} target="_blank" rel="noopener noreferrer" className="underline-offset-2 hover:underline">
              {notice.text}
            </a>
          ) : (
            notice.text
          )}
        </div>
      )}

      {recentRuns.length > 0 && (
        <div className="mt-5 flex flex-wrap gap-2 text-xs text-white/50">
          {recentRuns.map((r) => (
            <span key={r.id} className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1">
              {new Date(r.startedAt).toLocaleString()} · {r.goal} · {r.status} · {r.stats.new ?? 0} new · {r.stats.searches ?? 0} searches
            </span>
          ))}
        </div>
      )}

      {visible.length === 0 ? (
        <div className="mt-8 rounded-3xl border border-white/10 bg-white/[0.03] p-10 text-center text-white/55">
          <Sparkles className="mx-auto h-6 w-6 text-flame-300" />
          <p className="mt-3">Nothing waiting for review. Run AI discovery to find events.</p>
        </div>
      ) : (
        <ul className="mt-6 space-y-4">
          {visible.map((c, i) => {
            const e = editsFor(c)
            const setE = (patch: Partial<Edits>) => setEdits((prev) => ({ ...prev, [c.id]: { ...e, ...patch } }))
            const approved = c.stage === 'approved'
            const published = c.stage === 'published'
            const firstOfStage = i === 0 || visible[i - 1].stage !== c.stage
            return (
              <Fragment key={c.id}>
              {firstOfStage && (
                <li className={i === 0 ? '' : 'pt-4'}>
                  <h2 className="text-sm font-semibold text-white/80">
                    {STAGE_HEADING[c.stage].title} · {stageCount(c.stage)}
                  </h2>
                  {STAGE_HEADING[c.stage].hint && <p className="mt-0.5 text-xs text-white/45">{STAGE_HEADING[c.stage].hint}</p>}
                </li>
              )}
              <li className={`rounded-3xl border p-5 ${approved ? 'border-sky-400/25 bg-sky-500/[0.04]' : published ? 'border-emerald-400/20 bg-emerald-500/[0.03]' : 'border-white/10 bg-white/[0.03]'}`}>
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
                  <div className="flex flex-wrap gap-2">
                  {approved && <span className="rounded-full bg-sky-500/15 px-3 py-1 text-xs font-semibold text-sky-200">Approved</span>}
                  {published && c.albagoSlug && (
                    <a href={`/events/${c.albagoSlug}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-semibold text-emerald-200 hover:bg-emerald-500/25">
                      On AlbaGo <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${c.relevance === 'relevant' ? 'bg-emerald-500/15 text-emerald-200' : c.relevance === 'possible' ? 'bg-amber-500/15 text-amber-200' : 'bg-white/10 text-white/60'}`}
                  >
                    {c.relevance ? `Albanian relevance: ${c.relevance.replace('_', ' ')}` : 'relevance not assessed'}
                  </span>
                  </div>
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
                    <label>
                      Price
                      <select value={e.price_state} onChange={(ev) => setE({ price_state: ev.target.value })} className={FIELD}>
                        <option value="unknown">Not announced</option>
                        <option value="free">Free entry</option>
                        <option value="paid">Paid</option>
                      </select>
                    </label>
                    {e.price_state === 'paid' && (
                      <div className="mt-2 flex gap-2">
                        <input
                          inputMode="decimal"
                          placeholder="Amount"
                          aria-label="Ticket price"
                          value={e.price_amount}
                          onChange={(ev) => setE({ price_amount: ev.target.value.replace(',', '.') })}
                          className={`${FIELD} mt-0 min-w-0 flex-1`}
                        />
                        <select aria-label="Currency" value={e.price_currency} onChange={(ev) => setE({ price_currency: ev.target.value })} className={`${FIELD} mt-0 w-24`}>
                          {[...new Set([...CURRENCIES, e.price_currency])].map((cur) => (
                            <option key={cur} value={cur}>
                              {cur}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                    {c.price.note && <p className="mt-1 text-[11px] text-white/40">Source says: {c.price.note}</p>}
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

                {(c.issues.length > 0 || c.possibleDuplicates > 0 || c.wouldPublish.length > 0 || approved) && (
                  <div className="mt-3 space-y-1 text-xs text-amber-200/90">
                    {c.possibleDuplicates > 0 && (
                      <p className="flex items-center gap-1.5"><TriangleAlert className="h-3.5 w-3.5" /> Possible duplicate of {c.possibleDuplicates} other event{c.possibleDuplicates > 1 ? 's' : ''}</p>
                    )}
                    {c.issues.length > 0 && <p className="flex items-center gap-1.5"><TriangleAlert className="h-3.5 w-3.5" /> Reading issues: {c.issues.join(', ')}</p>}
                    {c.wouldPublish.length > 0 && <p className="flex items-center gap-1.5"><TriangleAlert className="h-3.5 w-3.5" /> {approved ? 'Held back from AlbaGo' : 'AlbaGo would hold it back'}: {c.wouldPublish.join(', ')}</p>}
                    {approved && c.wouldPublish.length === 0 && <p className="flex items-center gap-1.5"><TriangleAlert className="h-3.5 w-3.5" /> Publishing failed last time. Try again.</p>}
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
                    {published ? 'Save changes' : approved ? 'Publish to AlbaGo' : 'Approve & publish'}
                  </button>
                  <button
                    type="button"
                    disabled={busy === c.id}
                    onClick={() => act(c, 'reject')}
                    className="inline-flex items-center gap-2 rounded-full border border-white/15 px-4 py-2 text-sm font-semibold text-white/80 transition hover:bg-white/[0.06] disabled:opacity-60"
                  >
                    <X className="h-4 w-4" /> {published ? 'Reject & unpublish' : 'Reject'}
                  </button>
                </div>
              </li>
              </Fragment>
            )
          })}
        </ul>
      )}
    </div>
  )
}
