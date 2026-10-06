'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, Loader2, TriangleAlert } from 'lucide-react'
import { SEAT_SALE_MODES, type SeatSaleMode } from '@/lib/seats/types'
import { consoleCall, errorText, type ConsoleData } from './consoleShared'

const INPUT =
  'h-10 w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 text-sm text-white placeholder:text-white/30 focus:border-flame-500/40 focus:outline-none'

const MODE_INFO: Record<SeatSaleMode, { title: string; body: string }> = {
  draft: {
    title: 'Draft',
    body: 'Only admins see the seat panel. Use it to test the whole flow — you can reserve and walk an order through every step.',
  },
  waitlist: {
    title: 'Waitlist',
    body: 'The public sees categories and prices and can join the list. Nobody can reserve yet.',
  },
  live: {
    title: 'Live',
    body: 'Signed-in buyers reserve seats. Each reservation is held for the hold time below until you mark it paid.',
  },
  closed: {
    title: 'Closed',
    body: 'The panel says sales are closed. Orders and the console keep working.',
  },
}

export default function SettingsPanel({ data }: { data: ConsoleData }) {
  const router = useRouter()
  const { sale } = data
  const [mode, setMode] = useState<SeatSaleMode>(sale.mode)
  const [deliverBy, setDeliverBy] = useState(sale.deliver_by ?? '')
  const [holdHours, setHoldHours] = useState(String(Math.round(sale.hold_minutes / 60)))
  const [maxPerOrder, setMaxPerOrder] = useState(String(sale.max_per_order))
  const [sellerName, setSellerName] = useState(sale.seller_name ?? '')
  const [publicNote, setPublicNote] = useState(sale.public_note ?? '')
  const [showFaceValue, setShowFaceValue] = useState(sale.show_face_value)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const pricedCount = data.categories.filter((c) => c.price_cents !== null).length
  const holdMinutes = Math.round(Number(holdHours) * 60)
  const maxNum = Number(maxPerOrder)
  const valid =
    Number.isFinite(holdMinutes) &&
    holdMinutes >= 30 &&
    holdMinutes <= 20160 &&
    Number.isInteger(maxNum) &&
    maxNum >= 1 &&
    maxNum <= 20

  const save = async () => {
    if (mode === 'live' && sale.mode !== 'live' && !confirm('Open sales to the public now?')) return
    setBusy(true)
    setError(null)
    setSaved(false)
    const result = await consoleCall(data.event.id, 'PATCH', {
      mode,
      deliverBy: deliverBy || null,
      holdMinutes,
      maxPerOrder: maxNum,
      sellerName,
      publicNote,
      showFaceValue,
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
    <div className="max-w-2xl space-y-7">
      <section>
        <h2 className="text-xs font-semibold uppercase tracking-wider text-white/40">Who can see the seat panel</h2>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {SEAT_SALE_MODES.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              aria-pressed={mode === m}
              className={`rounded-2xl border p-3.5 text-left transition ${
                mode === m
                  ? 'border-flame-500/60 bg-flame-500/10'
                  : 'border-white/[0.07] bg-white/[0.02] hover:border-white/20'
              }`}
            >
              <span className="text-sm font-semibold text-white">{MODE_INFO[m].title}</span>
              <span className="mt-1 block text-xs leading-snug text-white/55">{MODE_INFO[m].body}</span>
            </button>
          ))}
        </div>
        {(mode === 'live' || mode === 'waitlist') && pricedCount === 0 && (
          <p className="mt-3 flex items-start gap-2 rounded-lg border border-amber-400/25 bg-amber-400/[0.06] px-3 py-2 text-xs text-amber-100/90">
            <TriangleAlert className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
            No category has a price yet, so the public panel will be empty. Set prices under Stock & prices.
          </p>
        )}
        {mode === 'live' && (
          <p className="mt-3 flex items-start gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-white/65">
            <TriangleAlert className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-amber-300" />
            Online payment is not connected yet. Buyers get a hold plus an email saying payment details follow; you
            collect the money and click “Mark paid” on the order.
          </p>
        )}
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        <label>
          <span className="mb-1 block text-xs text-white/60">Delivery promised by</span>
          <input type="date" value={deliverBy} onChange={(e) => setDeliverBy(e.target.value)} className={INPUT} />
          <span className="mt-1 block text-[11px] text-white/40">
            Shown to buyers as the latest date for the Eventim transfer (refund if missed).
          </span>
        </label>
        <label>
          <span className="mb-1 block text-xs text-white/60">Hold unpaid reservations for (hours)</span>
          <input
            type="number"
            min={1}
            max={336}
            value={holdHours}
            onChange={(e) => setHoldHours(e.target.value)}
            className={INPUT}
          />
          <span className="mt-1 block text-[11px] text-white/40">After that the seats go back on sale automatically.</span>
        </label>
        <label>
          <span className="mb-1 block text-xs text-white/60">Max seats per buyer</span>
          <input
            type="number"
            min={1}
            max={20}
            value={maxPerOrder}
            onChange={(e) => setMaxPerOrder(e.target.value)}
            className={INPUT}
          />
        </label>
        <label>
          <span className="mb-1 block text-xs text-white/60">Sold by (shown to buyers)</span>
          <input
            value={sellerName}
            onChange={(e) => setSellerName(e.target.value)}
            className={INPUT}
            maxLength={120}
            placeholder="Your name or business name"
          />
        </label>
        <label className="sm:col-span-2">
          <span className="mb-1 block text-xs text-white/60">Note under the panel (optional)</span>
          <textarea
            value={publicNote}
            onChange={(e) => setPublicNote(e.target.value)}
            maxLength={600}
            rows={3}
            className="w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-flame-500/40 focus:outline-none"
            placeholder="e.g. Tickets are original Eventim tickets, transferred to your Eventim account."
          />
        </label>
        <label className="inline-flex items-center gap-2 text-sm text-white/75 sm:col-span-2">
          <input
            type="checkbox"
            checked={showFaceValue}
            onChange={(e) => setShowFaceValue(e.target.checked)}
            className="accent-flame-500"
          />
          Show the face value next to each price
        </label>
      </section>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => void save()}
          disabled={busy || !valid}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-flame-500 px-5 text-sm font-semibold text-white transition hover:bg-flame-400 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {busy && <Loader2 className="h-4 w-4 animate-spin" />}
          Save settings
        </button>
        {saved && (
          <span className="inline-flex items-center gap-1.5 text-xs text-emerald-300/90">
            <CheckCircle2 className="h-3.5 w-3.5" /> Saved
          </span>
        )}
        {error && <span className="text-xs text-flame-200">{error}</span>}
      </div>
    </div>
  )
}
