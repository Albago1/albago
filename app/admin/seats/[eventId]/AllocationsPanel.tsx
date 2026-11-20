'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, Loader2, Pause, Play, Plus, TriangleAlert } from 'lucide-react'
import { allocationTaken, parseBlocks } from '@/lib/seats/allocations'
import { parseEuroToCents } from '@/lib/seats/format'
import type { SeatAllocationRow } from '@/lib/seats/types'
import { consoleCall, errorText, eur, type ConsoleData } from './consoleShared'

/**
 * Tickets on request (phase 47): stock sold by count per block, exact seats
 * assigned later on each order (Orders tab). Buyers see these under the map.
 */

const INPUT =
  'h-9 w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 text-sm text-white placeholder:text-white/30 focus:border-flame-500/40 focus:outline-none'
const BTN =
  'inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border px-3 text-[13px] font-semibold transition disabled:cursor-not-allowed disabled:opacity-40'
const BTN_PRIMARY = `${BTN} border-flame-500/50 bg-flame-500 text-white hover:bg-flame-400`
const BTN_GHOST = `${BTN} border-white/10 bg-white/[0.03] text-white/80 hover:bg-white/[0.07]`

type Draft = {
  label: string
  area: string
  blocks: string
  rows: string
  quantity: string
  price: string
  note: string
}

const EMPTY: Draft = { label: '', area: '', blocks: '', rows: '', quantity: '', price: '', note: '' }

const centsToInput = (c: number) => String(c / 100).replace('.', ',')

function toDraft(a: SeatAllocationRow): Draft {
  return {
    label: a.label,
    area: a.area,
    blocks: a.blocks.join(', '),
    rows: a.rows_label ?? '',
    quantity: String(a.quantity),
    price: centsToInput(a.price_cents),
    note: a.note ?? '',
  }
}

/** The draft as the API body, or null while a field is not valid yet. */
function toBody(d: Draft) {
  const quantity = Number(d.quantity)
  const priceCents = parseEuroToCents(d.price)
  const blocks = parseBlocks(d.blocks)
  if (!d.label.trim() || !d.area.trim() || !blocks) return null
  if (!Number.isInteger(quantity) || quantity < 0 || quantity > 10_000 || priceCents === null) return null
  return {
    label: d.label.trim(),
    area: d.area.trim(),
    blocks,
    rows: d.rows.trim() || null,
    quantity,
    priceCents,
    note: d.note.trim() || null,
  }
}

export default function AllocationsPanel({ data }: { data: ConsoleData }) {
  const [adding, setAdding] = useState(false)
  const taken = useMemo(
    () => new Map(data.allocations.map((a) => [a.id, allocationTaken(a.id, data.reservations)])),
    [data.allocations, data.reservations],
  )

  return (
    <section>
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-white/40">Tickets on request</h2>
          <p className="mt-1.5 max-w-xl text-xs text-white/45">
            Tickets sold by number per block — no seat numbers yet. Buyers reserve a count; you assign the exact seats on
            each order (Orders tab) before the transfer.
          </p>
        </div>
        {!adding && (
          <button type="button" onClick={() => setAdding(true)} className={BTN_GHOST}>
            <Plus className="h-4 w-4" /> Add tickets
          </button>
        )}
      </div>

      {data.allocations.length === 0 && !adding && (
        <p className="mt-3 rounded-xl border border-white/[0.07] bg-white/[0.02] px-4 py-5 text-center text-sm text-white/45">
          None yet.
        </p>
      )}

      <ul className="mt-3 space-y-2.5">
        {data.allocations.map((a) => (
          <AllocationRow
            key={a.id}
            eventId={data.event.id}
            currency={data.sale.currency}
            allocation={a}
            taken={taken.get(a.id)}
          />
        ))}
        {adding && (
          <AllocationRow
            eventId={data.event.id}
            currency={data.sale.currency}
            sortOrder={data.allocations.length}
            onDone={() => setAdding(false)}
          />
        )}
      </ul>
    </section>
  )
}

function AllocationRow({
  eventId,
  currency,
  allocation,
  taken,
  sortOrder = 0,
  onDone,
}: {
  eventId: string
  currency: string
  /** Absent for the "add" form. */
  allocation?: SeatAllocationRow
  taken?: { sold: number; held: number }
  sortOrder?: number
  onDone?: () => void
}) {
  const router = useRouter()
  const initial = allocation ? toDraft(allocation) : EMPTY
  const [draft, setDraft] = useState<Draft>(initial)
  const [busy, setBusy] = useState<'save' | 'toggle' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const body = toBody(draft)
  const dirty = (Object.keys(draft) as Array<keyof Draft>).some((k) => draft[k].trim() !== initial[k].trim())
  const set = (key: keyof Draft) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setSaved(false)
    setDraft((d) => ({ ...d, [key]: e.target.value }))
  }

  const sold = taken?.sold ?? 0
  const held = taken?.held ?? 0
  const left = allocation ? Math.max(allocation.quantity - sold - held, 0) : 0
  const active = allocation?.active ?? true

  const send = async (kind: 'save' | 'toggle', nextActive: boolean) => {
    if (!body) return
    setBusy(kind)
    setError(null)
    setSaved(false)
    const result = await consoleCall(eventId, 'POST', {
      op: 'allocation',
      id: allocation?.id ?? null,
      ...body,
      active: nextActive,
      sortOrder: allocation?.sort_order ?? sortOrder,
    })
    setBusy(null)
    if (!result.ok) {
      setError(errorText(result.error))
      return
    }
    if (allocation) setSaved(true)
    onDone?.()
    router.refresh()
  }

  return (
    <li
      className={`rounded-2xl border p-4 ${
        allocation ? 'border-amber-400/20 bg-amber-400/[0.03]' : 'border-flame-500/25 bg-flame-500/[0.04]'
      }`}
    >
      <div className="flex flex-wrap items-center gap-2">
        {allocation ? (
          <>
            <span
              className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${
                active ? 'border-emerald-400/35 bg-emerald-400/10 text-emerald-200' : 'border-white/15 bg-white/[0.04] text-white/50'
              }`}
            >
              {active ? 'On sale' : 'Paused'}
            </span>
            <span className="text-xs tabular-nums text-white/55">
              {sold} sold · {held} held · <span className="font-semibold text-white/85">{left} left</span> of{' '}
              {allocation.quantity}
            </span>
            <span className="ml-auto text-sm font-semibold tabular-nums text-white">
              {eur(allocation.price_cents, currency)} <span className="text-xs font-normal text-white/45">/ ticket</span>
            </span>
          </>
        ) : (
          <span className="text-sm font-semibold text-white">New tickets on request</span>
        )}
      </div>

      <div className="mt-3 grid gap-2.5 sm:grid-cols-6">
        <Labeled label="Name buyers see" className="sm:col-span-3">
          <input value={draft.label} onChange={set('label')} placeholder="Block 14 / 17" maxLength={80} className={INPUT} />
        </Labeled>
        <Labeled label="Area" className="sm:col-span-3">
          <input value={draft.area} onChange={set('area')} placeholder="Nord-Tribüne Unterrang" maxLength={80} className={INPUT} />
        </Labeled>
        <Labeled label="Blocks (for the map)" className="sm:col-span-2">
          <input value={draft.blocks} onChange={set('blocks')} placeholder="14, 17" className={INPUT} />
        </Labeled>
        <Labeled label="Rows (empty = to be confirmed)" className="sm:col-span-2">
          <input value={draft.rows} onChange={set('rows')} placeholder="1–5" maxLength={40} className={INPUT} />
        </Labeled>
        <Labeled label="Tickets" className="sm:col-span-1">
          <input value={draft.quantity} onChange={set('quantity')} inputMode="numeric" placeholder="20" className={INPUT} />
        </Labeled>
        <Labeled label="Price / ticket (€)" className="sm:col-span-1">
          <input value={draft.price} onChange={set('price')} inputMode="decimal" placeholder="150" className={INPUT} />
        </Labeled>
        <Labeled label="Note buyers see (optional)" className="sm:col-span-6">
          <input value={draft.note} onChange={set('note')} placeholder="VIP benefits to be confirmed" maxLength={200} className={INPUT} />
        </Labeled>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => void send('save', active)}
          disabled={!body || !!busy || (!!allocation && !dirty)}
          className={BTN_PRIMARY}
        >
          {busy === 'save' && <Loader2 className="h-4 w-4 animate-spin" />}
          {allocation ? 'Save' : 'Put on sale'}
        </button>
        {allocation && (
          <button
            type="button"
            onClick={() => void send('toggle', !active)}
            disabled={!body || !!busy}
            title={dirty ? 'Also saves your changes' : undefined}
            className={BTN_GHOST}
          >
            {busy === 'toggle' ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : active ? (
              <Pause className="h-4 w-4" />
            ) : (
              <Play className="h-4 w-4" />
            )}
            {active ? 'Pause' : 'Resume sale'}
          </button>
        )}
        {!allocation && (
          <button type="button" onClick={onDone} disabled={!!busy} className={BTN_GHOST}>
            Cancel
          </button>
        )}
        {allocation && sold + held > 0 && (
          <span className="text-[11px] text-white/40">Can’t go below {sold + held} — buyers already have those.</span>
        )}
        {saved && !dirty && (
          <span className="inline-flex items-center gap-1 text-xs text-emerald-300/90">
            <CheckCircle2 className="h-3.5 w-3.5" /> Saved
          </span>
        )}
      </div>

      {error && (
        <p className="mt-3 flex items-start gap-2 text-sm text-flame-200">
          <TriangleAlert className="mt-0.5 h-4 w-4 flex-shrink-0" /> {error}
        </p>
      )}
    </li>
  )
}

function Labeled({ label, className, children }: { label: string; className?: string; children: React.ReactNode }) {
  return (
    <label className={className}>
      <span className="mb-1 block text-[11px] text-white/45">{label}</span>
      {children}
    </label>
  )
}
