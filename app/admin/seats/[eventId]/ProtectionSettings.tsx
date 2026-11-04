'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, Loader2, ShieldCheck, TriangleAlert } from 'lucide-react'
import {
  allowedQuantities,
  berlinDate,
  overrideFor,
  phaseOn,
  type QuantityOverride,
  type RuleContext,
  type SeatPhase,
} from '@/lib/seats/protection'
import type { FreeRun, SeatReservationRow } from '@/lib/seats/types'
import { canonicalJson, consoleCall, errorText, eur, freeRunsOf, runLabel, type ConsoleData } from './consoleShared'

/**
 * Single-seat protection settings (phase 46): the switch, the two phase
 * dates, per-group quantity limits, and a live preview of the quantity
 * buttons buyers see for every group today. The database enforces the same
 * rules (seat_run_allows); this screen only edits and previews them.
 */

const INPUT =
  'h-10 w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 text-sm text-white placeholder:text-white/30 focus:border-flame-500/40 focus:outline-none'

const PHASE_INFO: Record<SeatPhase, { label: string; pill: string; body: string }> = {
  protected: {
    label: 'Protected',
    pill: 'border-emerald-400/40 bg-emerald-400/10 text-emerald-200',
    body: 'Buyers take seats from one end of a group, and never so that one seat is left on its own.',
  },
  flexible: {
    label: 'Relaxed',
    pill: 'border-sky-400/40 bg-sky-400/10 text-sky-200',
    body: 'A seat may be left on its own only when no other group of that price fits the order.',
  },
  final: {
    label: 'Any quantity',
    pill: 'border-amber-400/40 bg-amber-400/10 text-amber-200',
    body: 'Any number of seats, as long as they sit side by side.',
  },
  off: {
    label: 'Off',
    pill: 'border-white/20 bg-white/[0.05] text-white/60',
    body: 'No protection: any number of seats side by side.',
  },
}

const sameOverride = (a: QuantityOverride, b: QuantityOverride) =>
  a.area === b.area && a.block === b.block && a.row === b.row && a.from === b.from && a.to === b.to

const lastSeat = (run: FreeRun) => run.first + run.len - 1

function dayBefore(date: string): string {
  const d = new Date(`${date}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() - 1)
  return d.toISOString().slice(0, 10)
}

function niceDate(date: string): string {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' })
}

export default function ProtectionSettings({ data }: { data: ConsoleData }) {
  const router = useRouter()
  const { sale } = data
  const [protect, setProtect] = useState(sale.protect_singles ?? true)
  const [flexibleFrom, setFlexibleFrom] = useState(sale.flexible_from ?? '')
  const [finalFrom, setFinalFrom] = useState(sale.final_from ?? '')
  const [overrides, setOverrides] = useState<QuantityOverride[]>(sale.quantity_overrides ?? [])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const today = berlinDate()
  const phase = phaseOn({ protect, flexible_from: flexibleFrom || null, final_from: finalFrom || null }, today)
  const datesValid = !flexibleFrom || !finalFrom || flexibleFrom <= finalFrom

  const priceOf = useMemo(() => new Map(data.categories.map((c) => [c.code, c])), [data.categories])
  const runs = useMemo(() => {
    const reservations = new Map<string, SeatReservationRow>(data.reservations.map((r) => [r.id, r]))
    const priced = new Set(data.categories.filter((c) => c.price_cents !== null).map((c) => c.code))
    const natural = (a: string, b: string) => a.localeCompare(b, 'de', { numeric: true })
    return freeRunsOf(data.stock, reservations, priced).sort(
      (a, b) =>
        (priceOf.get(b.category)?.price_cents ?? 0) - (priceOf.get(a.category)?.price_cents ?? 0) ||
        natural(a.block, b.block) ||
        natural(a.row, b.row) ||
        a.first - b.first,
    )
  }, [data.stock, data.reservations, data.categories, priceOf])

  const ctx: RuleContext = { phase, overrides, runs, maxPerOrder: sale.max_per_order }
  // What the group offers today without any limit (to seed a new one).
  const baseCtx: RuleContext = { ...ctx, overrides: [] }
  const unmatched = overrides.filter((o) => !runs.some((r) => overrideFor(r, [o]) !== null))

  const dirty =
    protect !== (sale.protect_singles ?? true) ||
    (flexibleFrom || null) !== (sale.flexible_from ?? null) ||
    (finalFrom || null) !== (sale.final_from ?? null) ||
    canonicalJson(overrides) !== canonicalJson(sale.quantity_overrides ?? [])

  const setLimit = (run: FreeRun, quantities: number[] | null) => {
    setSaved(false)
    setOverrides((list) => {
      const current = overrideFor(run, list)
      const rest = current ? list.filter((o) => !sameOverride(o, current)) : list
      if (!quantities) return rest
      return [
        ...rest,
        { area: run.area, block: run.block, row: run.row, from: run.first, to: lastSeat(run), quantities: [...quantities].sort((a, b) => a - b) },
      ]
    })
  }

  const save = async () => {
    setBusy(true)
    setError(null)
    setSaved(false)
    const result = await consoleCall(data.event.id, 'PATCH', {
      protectSingles: protect,
      flexibleFrom: flexibleFrom || null,
      finalFrom: finalFrom || null,
      quantityOverrides: overrides,
    })
    setBusy(false)
    if (!result.ok) {
      setError(errorText(result.error))
      return
    }
    setSaved(true)
    router.refresh()
  }

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-xs font-semibold uppercase tracking-wider text-white/40">Single-seat protection</h2>
        <p className="mt-1.5 text-xs text-white/45">
          Keeps your groups sellable: buyers can’t pick a number of seats that leaves one seat alone in a row.
        </p>
      </div>

      <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.02] p-3.5">
        <input
          type="checkbox"
          checked={protect}
          onChange={(e) => {
            setProtect(e.target.checked)
            setSaved(false)
          }}
          className="mt-0.5 h-4 w-4 accent-flame-500"
        />
        <span>
          <span className="block text-sm font-semibold text-white">Don’t leave single seats</span>
          <span className="mt-0.5 block text-xs text-white/55">
            Off = any number of seats, still side by side. Your manual sales are never restricted.
          </span>
        </span>
      </label>

      <div className={`grid gap-4 sm:grid-cols-2 ${protect ? '' : 'pointer-events-none opacity-40'}`}>
        <label>
          <span className="mb-1 block text-xs text-white/60">Relaxed from (Berlin date)</span>
          <input
            type="date"
            value={flexibleFrom}
            onChange={(e) => {
              setFlexibleFrom(e.target.value)
              setSaved(false)
            }}
            className={INPUT}
          />
          <span className="mt-1 block text-[11px] text-white/40">{PHASE_INFO.flexible.body}</span>
        </label>
        <label>
          <span className="mb-1 block text-xs text-white/60">Any quantity from (Berlin date)</span>
          <input
            type="date"
            value={finalFrom}
            onChange={(e) => {
              setFinalFrom(e.target.value)
              setSaved(false)
            }}
            className={INPUT}
          />
          <span className="mt-1 block text-[11px] text-white/40">{PHASE_INFO.final.body}</span>
        </label>
      </div>
      {!datesValid && (
        <p className="flex items-start gap-2 rounded-lg border border-amber-400/25 bg-amber-400/[0.06] px-3 py-2 text-xs text-amber-100/90">
          <TriangleAlert className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
          “Any quantity” must start on or after “Relaxed”.
        </p>
      )}

      {protect && (
        <ol className="space-y-1 text-xs text-white/55">
          <li>
            <span className="font-semibold text-white/80">
              {flexibleFrom ? `Until ${niceDate(dayBefore(flexibleFrom))}` : finalFrom ? `Until ${niceDate(dayBefore(finalFrom))}` : 'Always'}
            </span>{' '}
            — {PHASE_INFO.protected.label.toLowerCase()}: {PHASE_INFO.protected.body.toLowerCase()}
          </li>
          {flexibleFrom && (
            <li>
              <span className="font-semibold text-white/80">
                {niceDate(flexibleFrom)}
                {finalFrom && datesValid ? `–${niceDate(dayBefore(finalFrom))}` : ' on'}
              </span>{' '}
              — relaxed
            </li>
          )}
          {finalFrom && (
            <li>
              <span className="font-semibold text-white/80">{niceDate(finalFrom)} on</span> — any quantity
            </li>
          )}
        </ol>
      )}

      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-white/[0.07] bg-white/[0.02] px-3.5 py-3">
        <ShieldCheck className="h-4 w-4 text-white/50" />
        <span className="text-xs text-white/60">Today ({niceDate(today)}):</span>
        <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${PHASE_INFO[phase].pill}`}>
          {PHASE_INFO[phase].label}
        </span>
        {dirty && <span className="text-[11px] text-white/40">(not saved yet)</span>}
      </div>

      <div>
        <h3 className="text-sm font-semibold text-white">What buyers can choose today</h3>
        <p className="mt-1 text-xs text-white/45">
          Each group is a set of free seats side by side. Tap “Limit” to allow only some numbers for a group (e.g. pairs
          only). A limit can only narrow the choice — while protection is on, a number that leaves one seat alone stays
          blocked.
        </p>
        {runs.length === 0 ? (
          <p className="mt-3 rounded-xl border border-white/[0.07] bg-white/[0.02] px-4 py-5 text-center text-sm text-white/45">
            No seats on sale right now.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {runs.map((run) => (
              <GroupRow
                key={`${run.category}|${run.area}|${run.block}|${run.row}|${run.first}`}
                run={run}
                label={priceOf.get(run.category)?.label ?? run.category}
                price={eur(priceOf.get(run.category)?.price_cents, sale.currency)}
                allowed={allowedQuantities(run, ctx)}
                base={allowedQuantities(run, baseCtx)}
                limit={overrideFor(run, overrides)}
                maxPerOrder={sale.max_per_order}
                phase={phase}
                onLimit={(q) => setLimit(run, q)}
              />
            ))}
          </ul>
        )}
        {unmatched.length > 0 && (
          <p className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-white/45">
            {unmatched.length} saved limit{unmatched.length === 1 ? '' : 's'} for seats that aren’t on sale right now (kept
            in case they come back).
            <button
              type="button"
              onClick={() => {
                setOverrides((list) => list.filter((o) => !unmatched.some((u) => sameOverride(u, o))))
                setSaved(false)
              }}
              className="font-semibold text-white/70 underline underline-offset-2 hover:text-white"
            >
              Remove
            </button>
          </p>
        )}
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => void save()}
          disabled={busy || !dirty || !datesValid}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-flame-500 px-5 text-sm font-semibold text-white transition hover:bg-flame-400 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {busy && <Loader2 className="h-4 w-4 animate-spin" />}
          Save protection
        </button>
        {saved && !dirty && (
          <span className="inline-flex items-center gap-1.5 text-xs text-emerald-300/90">
            <CheckCircle2 className="h-3.5 w-3.5" /> Saved
          </span>
        )}
        {error && <span className="text-xs text-flame-200">{error}</span>}
      </div>
    </section>
  )
}

function GroupRow({
  run,
  label,
  price,
  allowed,
  base,
  limit,
  maxPerOrder,
  phase,
  onLimit,
}: {
  run: FreeRun
  label: string
  price: string
  allowed: number[]
  base: number[]
  limit: QuantityOverride | null
  maxPerOrder: number
  phase: SeatPhase
  onLimit: (quantities: number[] | null) => void
}) {
  const sizes = Array.from({ length: Math.min(run.len, maxPerOrder) }, (_, i) => i + 1)
  const limitsApply = phase === 'protected' || phase === 'flexible'

  const toggle = (q: number) => {
    if (!limit) return
    const next = limit.quantities.includes(q) ? limit.quantities.filter((x) => x !== q) : [...limit.quantities, q]
    if (next.length > 0) onLimit(next)
  }

  return (
    <li className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-3.5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-white">{runLabel(run)}</p>
          <p className="mt-0.5 text-[11px] text-white/45">
            {label} · {price} · {run.len} together
          </p>
        </div>
        <button
          type="button"
          onClick={() => onLimit(limit ? null : base.length > 0 ? base : [run.len])}
          aria-pressed={!!limit}
          className={`h-8 rounded-lg border px-3 text-xs font-semibold transition ${
            limit
              ? 'border-flame-500/50 bg-flame-500/15 text-flame-100 hover:bg-flame-500/25'
              : 'border-white/10 bg-white/[0.03] text-white/70 hover:bg-white/[0.07]'
          }`}
        >
          {limit ? 'Remove limit' : 'Limit'}
        </button>
      </div>

      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
        <span className="mr-1 text-[11px] text-white/45">Buyers see:</span>
        {allowed.length === 0 ? (
          <span className="text-[11px] text-amber-200/90">nothing — this group can’t be sold today</span>
        ) : (
          allowed.map((q) => (
            <span
              key={q}
              className="flex h-7 min-w-[1.75rem] items-center justify-center rounded-full border border-emerald-400/40 bg-emerald-400/10 px-2 text-xs font-semibold tabular-nums text-emerald-100"
            >
              {q}
            </span>
          ))
        )}
      </div>

      {limit && (
        <div className="mt-2.5 rounded-xl border border-white/[0.06] bg-black/20 p-2.5">
          <p className="text-[11px] text-white/50">
            Allow only{!limitsApply && ' (not used while protection is off or in “any quantity”)'}:
          </p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {sizes.map((q) => {
              const on = limit.quantities.includes(q)
              const strands = run.len - q === 1
              return (
                <button
                  key={q}
                  type="button"
                  onClick={() => toggle(q)}
                  aria-pressed={on}
                  title={strands ? 'Leaves one seat alone — blocked while protected' : undefined}
                  className={`flex h-8 min-w-[2rem] items-center justify-center rounded-lg border px-2 text-xs font-semibold tabular-nums transition ${
                    on
                      ? 'border-flame-500/60 bg-flame-500/20 text-white'
                      : 'border-white/10 bg-white/[0.03] text-white/45 hover:bg-white/[0.07]'
                  } ${strands ? 'border-dashed' : ''}`}
                >
                  {q}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </li>
  )
}
