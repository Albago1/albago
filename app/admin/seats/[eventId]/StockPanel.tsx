'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, Loader2, TriangleAlert, Upload } from 'lucide-react'
import { parseEventimSeats, suggestCategories } from '@/lib/seats/parseEventimSeats'
import { parseEuroToCents } from '@/lib/seats/format'
import type { SeatCategoryRow, SeatReservationRow, SeatStockRow } from '@/lib/seats/types'
import {
  SEAT_CHIP,
  SEAT_STATE_LABEL,
  consoleCall,
  errorText,
  eur,
  seatState,
  type ConsoleData,
  type SeatState,
} from './consoleShared'

const INPUT =
  'h-9 w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 text-sm text-white placeholder:text-white/30 focus:border-flame-500/40 focus:outline-none'
const BTN =
  'inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border px-3 text-[13px] font-semibold transition disabled:cursor-not-allowed disabled:opacity-40'

const natural = (a: string, b: string) => a.localeCompare(b, 'de', { numeric: true })

export default function StockPanel({ data }: { data: ConsoleData }) {
  return (
    <div className="space-y-8">
      <CategoriesEditor data={data} />
      <SeatMap data={data} />
      <ImportBox data={data} />
    </div>
  )
}

function CategoriesEditor({ data }: { data: ConsoleData }) {
  const counts = useMemo(() => {
    const m = new Map<string, number>()
    for (const s of data.stock) m.set(s.category, (m.get(s.category) ?? 0) + 1)
    return m
  }, [data.stock])

  if (data.categories.length === 0) {
    return (
      <section>
        <h2 className="text-xs font-semibold uppercase tracking-wider text-white/40">Categories & prices</h2>
        <p className="mt-3 rounded-xl border border-white/[0.07] bg-white/[0.02] px-4 py-6 text-center text-sm text-white/45">
          Paste your seats below first — categories are created from them.
        </p>
      </section>
    )
  }

  return (
    <section>
      <h2 className="text-xs font-semibold uppercase tracking-wider text-white/40">Categories & prices</h2>
      <p className="mt-1.5 text-xs text-white/45">
        A category with no price stays hidden on the event page. The public label is what buyers see.
      </p>
      <ul className="mt-3 space-y-2.5">
        {data.categories.map((c) => (
          <CategoryRow key={c.code} eventId={data.event.id} category={c} seats={counts.get(c.code) ?? 0} />
        ))}
      </ul>
    </section>
  )
}

function CategoryRow({ eventId, category, seats }: { eventId: string; category: SeatCategoryRow; seats: number }) {
  const router = useRouter()
  const centsToInput = (c: number | null) => (c === null ? '' : String(c / 100).replace('.', ','))
  const [label, setLabel] = useState(category.label)
  const [face, setFace] = useState(centsToInput(category.face_value_cents))
  const [price, setPrice] = useState(centsToInput(category.price_cents))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const faceCents = face.trim() ? parseEuroToCents(face) : null
  const priceCents = price.trim() ? parseEuroToCents(price) : null
  const invalid = (face.trim() !== '' && faceCents === null) || (price.trim() !== '' && priceCents === null) || !label.trim()
  const dirty =
    label.trim() !== category.label ||
    faceCents !== category.face_value_cents ||
    priceCents !== category.price_cents
  const aboveFace = priceCents !== null && faceCents !== null && priceCents > faceCents

  const save = async () => {
    setBusy(true)
    setError(null)
    setSaved(false)
    const result = await consoleCall(eventId, 'POST', {
      op: 'category',
      code: category.code,
      label: label.trim(),
      faceValueCents: faceCents,
      priceCents,
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
    <li className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-md bg-white/[0.06] px-2 py-0.5 font-mono text-xs text-white/70">{category.code}</span>
        <span className="text-xs text-white/45">
          {seats} seat{seats === 1 ? '' : 's'}
        </span>
        {category.price_cents === null && (
          <span className="rounded-full border border-white/15 px-2 py-0.5 text-[10px] font-semibold uppercase text-white/50">
            Hidden — no price
          </span>
        )}
      </div>
      <div className="mt-3 grid gap-2.5 sm:grid-cols-[2fr_1fr_1fr_auto] sm:items-end">
        <label>
          <span className="mb-1 block text-[11px] text-white/45">Public label</span>
          <input value={label} onChange={(e) => setLabel(e.target.value)} className={INPUT} maxLength={80} />
        </label>
        <label>
          <span className="mb-1 block text-[11px] text-white/45">Face value (€)</span>
          <input value={face} onChange={(e) => setFace(e.target.value)} className={INPUT} inputMode="decimal" placeholder="e.g. 250" />
        </label>
        <label>
          <span className="mb-1 block text-[11px] text-white/45">Your price (€)</span>
          <input value={price} onChange={(e) => setPrice(e.target.value)} className={INPUT} inputMode="decimal" placeholder="empty = hidden" />
        </label>
        <button
          type="button"
          onClick={() => void save()}
          disabled={busy || invalid || !dirty}
          className={`${BTN} border-flame-500/50 bg-flame-500 text-white hover:bg-flame-400`}
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : saved && !dirty ? <CheckCircle2 className="h-4 w-4" /> : null}
          Save
        </button>
      </div>
      {aboveFace && (
        <p className="mt-2.5 flex items-start gap-2 rounded-lg border border-amber-400/25 bg-amber-400/[0.06] px-3 py-2 text-xs text-amber-100/90">
          <TriangleAlert className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
          Above face value ({eur(faceCents)}). Eventim&apos;s standard organizer terms forbid passing tickets on above
          face value plus proportionate fees and allow cancelling tickets that break them. Check the terms on your order.
        </p>
      )}
      {error && <p className="mt-2 text-xs text-flame-200">{error}</p>}
    </li>
  )
}

function SeatMap({ data }: { data: ConsoleData }) {
  const router = useRouter()
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const reservations = useMemo(
    () => new Map<string, SeatReservationRow>(data.reservations.map((r) => [r.id, r])),
    [data.reservations],
  )
  const priced = useMemo(
    () => new Set(data.categories.filter((c) => c.price_cents !== null).map((c) => c.code)),
    [data.categories],
  )
  const labels = useMemo(() => new Map(data.categories.map((c) => [c.code, c.label])), [data.categories])

  // category → "area · Block x · Row y" → seats
  const groups = useMemo(() => {
    const byCat = new Map<string, Map<string, SeatStockRow[]>>()
    const sorted = [...data.stock].sort(
      (a, b) =>
        natural(a.category, b.category) ||
        natural(a.area, b.area) ||
        natural(a.block, b.block) ||
        natural(a.row_label, b.row_label) ||
        a.seat_number - b.seat_number,
    )
    for (const s of sorted) {
      const rowKey = `${s.area}${s.block !== '-' ? ` · Block ${s.block}` : ''} · Row ${s.row_label}`
      const cat = byCat.get(s.category) ?? new Map<string, SeatStockRow[]>()
      cat.set(rowKey, [...(cat.get(rowKey) ?? []), s])
      byCat.set(s.category, cat)
    }
    return byCat
  }, [data.stock])

  const legendCounts = useMemo(() => {
    const m = new Map<SeatState, number>()
    for (const s of data.stock) {
      const state = seatState(s, reservations, priced)
      m.set(state, (m.get(state) ?? 0) + 1)
    }
    return m
  }, [data.stock, reservations, priced])

  const toggle = async (seat: SeatStockRow, state: SeatState) => {
    if (busyId) return
    if (state !== 'free' && state !== 'unpriced' && state !== 'withdrawn') return
    setBusyId(seat.id)
    setError(null)
    const result = await consoleCall(data.event.id, 'POST', {
      op: 'seat',
      seatId: seat.id,
      withdrawn: state !== 'withdrawn',
    })
    setBusyId(null)
    if (!result.ok) {
      setError(errorText(result.error))
      return
    }
    router.refresh()
  }

  if (data.stock.length === 0) return null

  return (
    <section>
      <h2 className="text-xs font-semibold uppercase tracking-wider text-white/40">Seat map</h2>
      <p className="mt-1.5 text-xs text-white/45">
        Click a seat on sale to keep it back for yourself (it disappears from the shop); click again to put it back.
      </p>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {[...legendCounts.entries()].map(([state, n]) => (
          <span key={state} className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${SEAT_CHIP[state]}`}>
            {SEAT_STATE_LABEL[state]} · {n}
          </span>
        ))}
      </div>
      {error && <p className="mt-2 text-xs text-flame-200">{error}</p>}
      <div className="mt-4 space-y-5">
        {[...groups.entries()].map(([cat, rows]) => (
          <div key={cat}>
            <p className="text-sm font-semibold text-white">
              {labels.get(cat) ?? cat} <span className="font-mono text-xs text-white/40">{cat}</span>
            </p>
            <div className="mt-2 space-y-2">
              {[...rows.entries()].map(([rowKey, seats]) => (
                <div key={rowKey} className="flex flex-wrap items-center gap-1.5 rounded-xl border border-white/[0.06] bg-white/[0.015] px-3 py-2">
                  <span className="mr-1 w-full text-[11px] text-white/45 sm:w-auto sm:min-w-[260px]">{rowKey}</span>
                  {seats.map((s) => {
                    const state = seatState(s, reservations, priced)
                    const r = s.reservation_id ? reservations.get(s.reservation_id) : undefined
                    const clickable = state === 'free' || state === 'unpriced' || state === 'withdrawn'
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => void toggle(s, state)}
                        disabled={!clickable || busyId === s.id}
                        title={`Seat ${s.seat_number} · ${SEAT_STATE_LABEL[state]}${r ? ` · ${r.reference} · ${r.buyer_name}` : ''}`}
                        className={`flex h-8 min-w-[2rem] items-center justify-center rounded-md border px-1.5 text-xs font-semibold tabular-nums transition ${SEAT_CHIP[state]} ${clickable ? '' : 'cursor-default'}`}
                      >
                        {busyId === s.id ? <Loader2 className="h-3 w-3 animate-spin" /> : s.seat_number}
                      </button>
                    )
                  })}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

function ImportBox({ data }: { data: ConsoleData }) {
  const router = useRouter()
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [problems, setProblems] = useState<string[]>([])

  const preview = useMemo(() => (text.trim() ? parseEventimSeats(text) : null), [text])
  const previewCats = preview ? suggestCategories(preview.seats) : []

  const importSeats = async () => {
    setBusy(true)
    setError(null)
    setResult(null)
    const res = await consoleCall(data.event.id, 'POST', { op: 'import', text })
    setBusy(false)
    if (!res.ok) {
      setError(errorText(res.error))
      return
    }
    const added = Number(res.added ?? 0)
    const dupes = Number(res.duplicates ?? 0)
    setResult(`${added} seat${added === 1 ? '' : 's'} added${dupes ? ` · ${dupes} already in stock` : ''}.`)
    setProblems(Array.isArray(res.problems) ? (res.problems as string[]) : [])
    setText('')
    router.refresh()
  }

  return (
    <section>
      <h2 className="text-xs font-semibold uppercase tracking-wider text-white/40">Add seats</h2>
      <p className="mt-1.5 text-xs text-white/45">
        Open your order in the Eventim account, select the whole ticket list, copy, and paste it here. Seats already in
        stock are skipped, so pasting the full list again is safe.
      </p>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={6}
        spellCheck={false}
        placeholder={'Nord-Tribüne Oberrang Block 114, Reihe 22, Platz 7\nCat 8\n…'}
        className="mt-3 w-full resize-y rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-3 font-mono text-[12px] leading-relaxed text-white placeholder:text-white/25 focus:border-flame-500/40 focus:outline-none"
      />
      {preview && (
        <p className="mt-2 text-xs text-white/60">
          Found <span className="font-semibold text-white">{preview.seats.length}</span> seat
          {preview.seats.length === 1 ? '' : 's'}
          {previewCats.length > 0 && <> — {previewCats.map((c) => `${c.code}: ${c.count}`).join(' · ')}</>}
          {preview.duplicates > 0 && <> · {preview.duplicates} duplicate lines</>}
          {preview.problems.length > 0 && <span className="text-amber-200"> · {preview.problems.length} unreadable</span>}
        </p>
      )}
      <button
        type="button"
        onClick={() => void importSeats()}
        disabled={busy || !preview || preview.seats.length === 0}
        className={`${BTN} mt-3 border-flame-500/50 bg-flame-500 text-white hover:bg-flame-400`}
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
        Add {preview?.seats.length ?? ''} seats
      </button>
      {result && (
        <p className="mt-3 inline-flex items-center gap-1.5 text-xs text-emerald-300/90">
          <CheckCircle2 className="h-3.5 w-3.5" /> {result}
        </p>
      )}
      {error && <p className="mt-3 text-xs text-flame-200">{error}</p>}
      {problems.length > 0 && (
        <ul className="mt-2 space-y-0.5 text-[11px] text-amber-200/80">
          {problems.slice(0, 10).map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      )}
    </section>
  )
}
