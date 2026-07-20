'use client'

import { useMemo, useState } from 'react'
import {
  Check,
  CircleSlash,
  CopyCheck,
  Globe,
  Loader2,
  Radar,
  TriangleAlert,
} from 'lucide-react'

/**
 * Admin surface for AlbaGo Crawl (master plan CRAWL-1). Paste a list of event
 * domains / listing pages / event pages, run a dry run, review what the crawler
 * found, then send the good ones to the moderation queue. Uses the admin
 * session (same-origin fetch carries the cookie), so no CRAWL_SECRET is needed
 * here — that token is only for the headless batch script.
 */

type Outcome =
  | 'would_submit'
  | 'submitted'
  | 'duplicate_live'
  | 'duplicate_in_review'
  | 'not_an_event'
  | 'unreadable'
  | 'error'

type CrawlItem = {
  url: string
  discoveredFrom?: string
  outcome: Outcome
  title?: string
  confidence?: number
  resolution?: { city: string; duplicate: string }
  note?: string
}

type CrawlRemaining = { sourceUrls?: string[]; listingUrls?: string[]; siteUrls?: string[] }

type CrawlReport = {
  counts: Record<Outcome, number>
  items: CrawlItem[]
  totalInputs: number
  processedInputs: number
  remaining?: CrawlRemaining
}

const OUTCOME_META: Record<Outcome, { label: string; className: string }> = {
  would_submit: { label: 'Would queue', className: 'bg-emerald-500/15 text-emerald-300 ring-emerald-500/30' },
  submitted: { label: 'Queued', className: 'bg-emerald-500/20 text-emerald-200 ring-emerald-500/40' },
  duplicate_live: { label: 'Already live', className: 'bg-white/[0.06] text-white/55 ring-white/10' },
  duplicate_in_review: { label: 'Already in review', className: 'bg-white/[0.06] text-white/55 ring-white/10' },
  not_an_event: { label: 'Not an event', className: 'bg-white/[0.04] text-white/40 ring-white/10' },
  unreadable: { label: 'Unreadable', className: 'bg-amber-500/12 text-amber-300/90 ring-amber-500/25' },
  error: { label: 'Error', className: 'bg-flame-500/15 text-flame-300 ring-flame-500/30' },
}

/** Split pasted text into inputs, classifying bare domains as site mode and
 *  path'd URLs as listing mode (matching scripts/crawl-batch.mjs). */
function classifyInputs(text: string): { siteUrls: string[]; listingUrls: string[]; skipped: string[] } {
  const siteUrls: string[] = []
  const listingUrls: string[] = []
  const skipped: string[] = []
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue
    let u: URL | null = null
    try {
      u = new URL(line)
    } catch {
      try {
        u = new URL(`https://${line}`) // allow "venue.al" without a scheme
      } catch {
        u = null
      }
    }
    if (!u || (u.protocol !== 'http:' && u.protocol !== 'https:')) {
      skipped.push(line)
      continue
    }
    const bare = u.pathname === '/' || u.pathname === ''
    if (bare) siteUrls.push(u.toString())
    else listingUrls.push(u.toString())
  }
  return { siteUrls, listingUrls, skipped }
}

const MAX_ROUNDS = 200

export default function CrawlClient() {
  const [text, setText] = useState('')
  const [live, setLive] = useState(false)
  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [items, setItems] = useState<CrawlItem[]>([])
  const [totals, setTotals] = useState<Record<string, number>>({})

  const parsed = useMemo(() => classifyInputs(text), [text])
  const inputCount = parsed.siteUrls.length + parsed.listingUrls.length

  async function postOnce(remaining: CrawlRemaining, dryRun: boolean): Promise<CrawlReport> {
    const res = await fetch('/api/admin/crawl', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        dryRun,
        siteUrls: remaining.siteUrls ?? [],
        listingUrls: remaining.listingUrls ?? [],
      }),
    })
    const json = await res.json().catch(() => null)
    if (!res.ok || !json?.ok) {
      const code = json?.error ?? res.status
      throw new Error(
        res.status === 403
          ? 'Not authorized — make sure you are signed in as an admin.'
          : `Crawl failed (${code}).`,
      )
    }
    return json.report as CrawlReport
  }

  async function run(dryRun: boolean) {
    if (inputCount === 0 || running) return
    setRunning(true)
    setError(null)
    setItems([])
    setTotals({})
    setProgress('Starting…')

    const collected: CrawlItem[] = []
    const runningTotals: Record<string, number> = {}
    let remaining: CrawlRemaining = { siteUrls: parsed.siteUrls, listingUrls: parsed.listingUrls }
    let rounds = 0

    try {
      while (
        (remaining.siteUrls?.length || 0) + (remaining.listingUrls?.length || 0) > 0 &&
        rounds < MAX_ROUNDS
      ) {
        rounds++
        const left = (remaining.siteUrls?.length || 0) + (remaining.listingUrls?.length || 0)
        setProgress(`Reading… ${collected.length} event(s) so far, ${left} source(s) left`)
        const report = await postOnce(remaining, dryRun)
        for (const it of report.items) collected.push(it)
        for (const [k, v] of Object.entries(report.counts)) {
          runningTotals[k] = (runningTotals[k] || 0) + v
        }
        setItems([...collected])
        setTotals({ ...runningTotals })
        remaining = report.remaining ?? { siteUrls: [], listingUrls: [] }
      }
      setProgress(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
      setProgress(null)
    } finally {
      setRunning(false)
    }
  }

  const queued = (totals.would_submit || 0) + (totals.submitted || 0)

  return (
    <div className="mx-auto max-w-4xl">
      <header className="mb-6">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-flame-500/15 text-flame-300 ring-1 ring-flame-500/30">
            <Radar className="h-4 w-4" />
          </span>
          <h1 className="text-lg font-semibold text-white">Crawl</h1>
        </div>
        <p className="mt-2 text-sm text-white/55">
          Paste event sources — one per line. A bare domain
          (<code className="text-white/70">venue.al</code>) is searched site-wide via its
          sitemap; a listing page reads every event on it; an event page reads that one.
          Nothing is published — finds land in the{' '}
          <span className="text-white/75">Queue</span> as pending for your review.
        </p>
      </header>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={7}
        spellCheck={false}
        placeholder={'https://venue-one.al\nhttps://promoter.al/events\nticketsite.al'}
        className="w-full resize-y rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-3 font-mono text-[13px] text-white placeholder:text-white/25 focus:border-flame-500/40 focus:outline-none focus:ring-1 focus:ring-flame-500/30"
      />

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <span className="text-xs text-white/50">
          {inputCount} source{inputCount === 1 ? '' : 's'}
          {parsed.siteUrls.length > 0 && ` · ${parsed.siteUrls.length} site`}
          {parsed.listingUrls.length > 0 && ` · ${parsed.listingUrls.length} page`}
          {parsed.skipped.length > 0 && ` · ${parsed.skipped.length} unreadable line(s)`}
        </span>

        <label className="ml-auto flex cursor-pointer items-center gap-2 text-xs text-white/60">
          <input
            type="checkbox"
            checked={live}
            onChange={(e) => setLive(e.target.checked)}
            disabled={running}
            className="h-3.5 w-3.5 accent-flame-500"
          />
          Send finds to the queue (off = dry run, writes nothing)
        </label>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <button
          type="button"
          onClick={() => run(!live)}
          disabled={inputCount === 0 || running}
          className="inline-flex h-9 items-center gap-2 rounded-lg bg-flame-500 px-4 text-sm font-semibold text-white transition hover:bg-flame-400 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Globe className="h-4 w-4" />}
          {running ? 'Crawling…' : live ? 'Crawl & queue' : 'Dry run'}
        </button>
        {progress && <span className="text-xs text-white/50">{progress}</span>}
      </div>

      {error && (
        <div className="mt-4 flex items-start gap-2 rounded-lg border border-flame-500/30 bg-flame-500/10 px-3.5 py-2.5 text-sm text-flame-200">
          <TriangleAlert className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {(items.length > 0 || Object.keys(totals).length > 0) && (
        <section className="mt-7">
          <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-white/55">
            <span className="inline-flex items-center gap-1.5 font-medium text-emerald-300">
              {live ? <CopyCheck className="h-3.5 w-3.5" /> : <Check className="h-3.5 w-3.5" />}
              {queued} {live ? 'queued' : 'ready to queue'}
            </span>
            {(totals.duplicate_live || 0) + (totals.duplicate_in_review || 0) > 0 && (
              <span>{(totals.duplicate_live || 0) + (totals.duplicate_in_review || 0)} duplicate</span>
            )}
            {(totals.not_an_event || 0) + (totals.unreadable || 0) > 0 && (
              <span className="inline-flex items-center gap-1.5">
                <CircleSlash className="h-3.5 w-3.5" />
                {(totals.not_an_event || 0) + (totals.unreadable || 0)} skipped
              </span>
            )}
            {(totals.error || 0) > 0 && <span className="text-flame-300">{totals.error} error</span>}
          </div>

          <div className="overflow-hidden rounded-xl border border-white/[0.07]">
            <table className="w-full text-left text-[13px]">
              <thead>
                <tr className="border-b border-white/[0.07] text-[11px] uppercase tracking-wider text-white/40">
                  <th className="px-3.5 py-2 font-medium">Event</th>
                  <th className="px-3.5 py-2 font-medium">City</th>
                  <th className="px-3.5 py-2 font-medium">Result</th>
                </tr>
              </thead>
              <tbody>
                {items.map((it, i) => {
                  const meta = OUTCOME_META[it.outcome]
                  return (
                    <tr key={`${it.url}-${i}`} className="border-b border-white/[0.04] last:border-0">
                      <td className="max-w-0 px-3.5 py-2.5">
                        <div className="truncate font-medium text-white/90">
                          {it.title || <span className="text-white/40">{it.note || '—'}</span>}
                        </div>
                        <a
                          href={it.url}
                          target="_blank"
                          rel="noreferrer"
                          className="block truncate text-[11px] text-white/35 hover:text-white/60"
                        >
                          {it.url}
                        </a>
                      </td>
                      <td className="whitespace-nowrap px-3.5 py-2.5 text-white/60">
                        {it.resolution?.city || '—'}
                      </td>
                      <td className="whitespace-nowrap px-3.5 py-2.5">
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ${meta.className}`}
                        >
                          {meta.label}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {queued > 0 && !live && (
            <p className="mt-3 text-xs text-white/50">
              Happy with these? Tick “Send finds to the queue” and run again to add the{' '}
              {queued} event{queued === 1 ? '' : 's'} as pending, then approve them in the Queue.
            </p>
          )}
        </section>
      )}
    </div>
  )
}
