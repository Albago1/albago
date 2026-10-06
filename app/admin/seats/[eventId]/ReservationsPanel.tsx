'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Check,
  ChevronDown,
  Copy,
  Download,
  Loader2,
  Plus,
  Search,
  TriangleAlert,
} from 'lucide-react'
import { effectiveStatus, seatsLine, toCsv } from '@/lib/seats/format'
import {
  PAYMENT_METHODS,
  type AdminReservationAction,
  type PaymentMethod,
  type ReservationStatus,
  type SeatReservationRow,
} from '@/lib/seats/types'
import {
  PAYMENT_LABEL,
  STATUS_BADGE,
  STATUS_LABEL,
  consoleCall,
  downloadCsv,
  errorText,
  eur,
  shortDateTime,
  timeLeft,
  type ConsoleData,
} from './consoleShared'

type Filter = 'all' | 'held' | 'paid' | 'transfer_sent' | 'delivered' | 'closed'

const FILTERS: Array<{ id: Filter; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'held', label: 'Awaiting payment' },
  { id: 'paid', label: 'To transfer' },
  { id: 'transfer_sent', label: 'Sent' },
  { id: 'delivered', label: 'Delivered' },
  { id: 'closed', label: 'Cancelled / refunded' },
]

const CLOSED: ReservationStatus[] = ['cancelled', 'expired', 'refunded']

const BTN =
  'inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border px-3 text-[13px] font-semibold transition disabled:cursor-not-allowed disabled:opacity-40'
const BTN_PRIMARY = `${BTN} border-flame-500/50 bg-flame-500 text-white hover:bg-flame-400`
const BTN_GHOST = `${BTN} border-white/10 bg-white/[0.03] text-white/80 hover:bg-white/[0.07]`
const BTN_DANGER = `${BTN} border-red-400/30 bg-red-500/10 text-red-200 hover:bg-red-500/20`
const INPUT =
  'h-9 w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 text-sm text-white placeholder:text-white/30 focus:border-flame-500/40 focus:outline-none'

export default function ReservationsPanel({ data }: { data: ConsoleData }) {
  const { reservations, stock } = data
  const [filter, setFilter] = useState<Filter>('all')
  const [query, setQuery] = useState('')
  const [showManual, setShowManual] = useState(false)

  const rows = useMemo(
    () => reservations.map((r) => ({ ...r, status: effectiveStatus(r.status, r.expires_at) })),
    [reservations],
  )
  const counts = useMemo(() => {
    const c: Record<Filter, number> = { all: rows.length, held: 0, paid: 0, transfer_sent: 0, delivered: 0, closed: 0 }
    for (const r of rows) {
      if (CLOSED.includes(r.status)) c.closed += 1
      else c[r.status as Exclude<Filter, 'all' | 'closed'>] += 1
    }
    return c
  }, [rows])
  const attached = useMemo(() => {
    const ids = new Set<string>()
    for (const s of stock) if (s.reservation_id) ids.add(s.reservation_id)
    return ids
  }, [stock])

  const q = query.trim().toLowerCase()
  const filtered = rows.filter((r) => {
    if (filter === 'closed' ? !CLOSED.includes(r.status) : filter !== 'all' && r.status !== filter) return false
    if (!q) return true
    return [r.reference, r.buyer_name, r.buyer_email, r.eventim_email, r.phone ?? '']
      .some((v) => v.toLowerCase().includes(q))
  })

  const exportCsv = () => {
    const csv = toCsv(
      ['Reference', 'Status', 'Created', 'Buyer', 'Email', 'Eventim email', 'Phone', 'Category', 'Qty', 'Seats', 'Total', 'Payment', 'Payment ref', 'Paid', 'Transfer sent', 'Delivered', 'Source', 'Buyer note', 'Admin note'],
      filtered.map((r) => [
        r.reference,
        STATUS_LABEL[r.status],
        shortDateTime(r.created_at),
        r.buyer_name,
        r.buyer_email,
        r.eventim_email,
        r.phone ?? '',
        r.category_label,
        String(r.quantity),
        seatsLine(r.seats),
        (r.total_cents / 100).toFixed(2),
        r.payment_method ? PAYMENT_LABEL[r.payment_method] : '',
        r.payment_ref ?? '',
        shortDateTime(r.paid_at),
        shortDateTime(r.transfer_sent_at),
        shortDateTime(r.delivered_at),
        r.source,
        r.note ?? '',
        r.admin_note ?? '',
      ]),
    )
    downloadCsv(`${data.event.slug}-seat-orders.csv`, csv)
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-1 flex-wrap gap-1.5">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                filter === f.id
                  ? 'border-flame-500/50 bg-flame-500/15 text-white'
                  : 'border-white/10 bg-white/[0.02] text-white/55 hover:text-white/85'
              }`}
            >
              {f.label} <span className="tabular-nums text-white/40">{counts[f.id]}</span>
            </button>
          ))}
        </div>
        <button type="button" onClick={() => setShowManual((v) => !v)} className={BTN_PRIMARY}>
          <Plus className="h-4 w-4" /> Manual sale
        </button>
        <button type="button" onClick={exportCsv} disabled={filtered.length === 0} className={BTN_GHOST}>
          <Download className="h-4 w-4" /> CSV
        </button>
      </div>

      <div className="relative mt-3">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search reference, name, email, phone…"
          className={`${INPUT} pl-9`}
        />
      </div>

      {showManual && <ManualSaleForm data={data} onDone={() => setShowManual(false)} />}

      {filtered.length === 0 ? (
        <p className="mt-4 rounded-xl border border-white/[0.07] bg-white/[0.02] px-4 py-8 text-center text-sm text-white/45">
          {reservations.length === 0
            ? 'No orders yet. Reservations from the event page and manual sales land here.'
            : 'Nothing matches this filter.'}
        </p>
      ) : (
        <ul className="mt-4 space-y-2.5">
          {filtered.map((r) => (
            <ReservationItem
              key={r.id}
              eventId={data.event.id}
              currency={data.sale.currency}
              reservation={r}
              seatsAttached={attached.has(r.id)}
            />
          ))}
        </ul>
      )}
    </div>
  )
}

function CopyButton({ value }: { value: string }) {
  const [done, setDone] = useState(false)
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value)
          setDone(true)
          setTimeout(() => setDone(false), 1200)
        } catch {
          /* clipboard blocked */
        }
      }}
      title="Copy"
      className="inline-flex h-6 w-6 items-center justify-center rounded-md text-white/40 transition hover:bg-white/[0.08] hover:text-white"
    >
      {done ? <Check className="h-3.5 w-3.5 text-emerald-300" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  )
}

function ReservationItem({
  eventId,
  currency,
  reservation: r,
  seatsAttached,
}: {
  eventId: string
  currency: string
  reservation: SeatReservationRow
  seatsAttached: boolean
}) {
  const router = useRouter()
  const [open, setOpen] = useState(r.status === 'paid')
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [method, setMethod] = useState<PaymentMethod>(r.payment_method ?? 'bank_transfer')
  const [ref, setRef] = useState(r.payment_ref ?? '')
  const [note, setNote] = useState(r.admin_note ?? '')
  const [notify, setNotify] = useState(true)
  const [releaseOnRefund, setReleaseOnRefund] = useState(r.status === 'paid')

  const run = async (action: AdminReservationAction, extra: Record<string, unknown> = {}) => {
    if (busy) return
    if (action === 'cancel' && !confirm(`Cancel ${r.reference}? The seats go back on sale.`)) return
    if (
      action === 'refund' &&
      !confirm(
        `Mark ${r.reference} as refunded (${eur(r.total_cents, currency)})? Send the money back yourself first.${
          releaseOnRefund ? ' The seats go back on sale.' : ''
        }`,
      )
    )
      return
    setBusy(action)
    setError(null)
    setNotice(null)
    const result = await consoleCall(eventId, 'POST', {
      op: 'reservation',
      reservationId: r.id,
      action,
      notify,
      ...extra,
    })
    setBusy(null)
    if (!result.ok) {
      setError(errorText(result.error))
      return
    }
    if (result.emailed) setNotice('Buyer emailed.')
    router.refresh()
  }

  const left = r.status === 'held' ? timeLeft(r.expires_at) : null

  return (
    <li className="rounded-2xl border border-white/[0.07] bg-white/[0.02]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-3 text-left"
      >
        <span className="font-mono text-[13px] font-semibold tabular-nums text-white">{r.reference}</span>
        <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${STATUS_BADGE[r.status]}`}>
          {STATUS_LABEL[r.status]}
        </span>
        {left && <span className="text-[11px] text-amber-200/80">expires {left}</span>}
        <span className="min-w-0 flex-1 truncate text-sm text-white/75">
          {r.buyer_name} · {r.quantity} × {r.category_label}
        </span>
        <span className="text-sm font-semibold tabular-nums text-white">{eur(r.total_cents, currency)}</span>
        <ChevronDown className={`h-4 w-4 text-white/40 transition ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="border-t border-white/[0.06] px-4 py-4">
          <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
            <Field label="Seats" value={seatsLine(r.seats)} wide />
            <Field label="Buyer email" value={r.buyer_email} copy />
            <Field label="Eventim email (transfer to)" value={r.eventim_email} copy strong />
            {r.phone && <Field label="Phone" value={r.phone} copy />}
            <Field label="Created" value={`${shortDateTime(r.created_at)} · ${r.source === 'manual' ? 'manual sale' : 'online'}`} />
            {r.payment_method && (
              <Field
                label="Payment"
                value={`${PAYMENT_LABEL[r.payment_method]}${r.payment_ref ? ` · ${r.payment_ref}` : ''}${r.paid_at ? ` · ${shortDateTime(r.paid_at)}` : ''}`}
              />
            )}
            {r.transfer_sent_at && <Field label="Transfer sent" value={shortDateTime(r.transfer_sent_at)} />}
            {r.delivered_at && <Field label="Delivered" value={shortDateTime(r.delivered_at)} />}
            {r.note && <Field label="Buyer note" value={r.note} wide />}
          </dl>

          <div className="mt-4 space-y-3">
            {r.status === 'held' && (
              <div className="flex flex-wrap items-end gap-2">
                <label className="w-40">
                  <span className="mb-1 block text-[11px] text-white/45">Paid via</span>
                  <select value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)} className={INPUT}>
                    {PAYMENT_METHODS.map((m) => (
                      <option key={m} value={m} className="bg-ink-950">
                        {PAYMENT_LABEL[m]}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="min-w-[140px] flex-1">
                  <span className="mb-1 block text-[11px] text-white/45">Payment reference (optional)</span>
                  <input value={ref} onChange={(e) => setRef(e.target.value)} className={INPUT} maxLength={120} />
                </label>
                <button
                  type="button"
                  onClick={() => void run('mark_paid', { paymentMethod: method, paymentRef: ref })}
                  disabled={!!busy}
                  className={BTN_PRIMARY}
                >
                  {busy === 'mark_paid' && <Loader2 className="h-4 w-4 animate-spin" />} Mark paid
                </button>
                <button type="button" onClick={() => void run('extend_hold')} disabled={!!busy} className={BTN_GHOST}>
                  Extend hold
                </button>
                <button type="button" onClick={() => void run('cancel')} disabled={!!busy} className={BTN_DANGER}>
                  Cancel
                </button>
              </div>
            )}

            {r.status === 'paid' && (
              <div className="flex flex-wrap items-center gap-2">
                <button type="button" onClick={() => void run('transfer_sent')} disabled={!!busy} className={BTN_PRIMARY}>
                  {busy === 'transfer_sent' && <Loader2 className="h-4 w-4 animate-spin" />} I sent the Eventim transfer
                </button>
                <span className="text-[11px] text-white/45">
                  Transfer {r.quantity} ticket{r.quantity === 1 ? '' : 's'} in the Eventim app to {r.eventim_email}, then click.
                </span>
              </div>
            )}

            {r.status === 'transfer_sent' && (
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => void run('delivered')} disabled={!!busy} className={BTN_PRIMARY}>
                  Mark delivered
                </button>
                <button type="button" onClick={() => void run('undo_transfer')} disabled={!!busy} className={BTN_GHOST}>
                  Undo “sent”
                </button>
              </div>
            )}

            {(r.status === 'paid' || r.status === 'transfer_sent' || r.status === 'delivered') && (
              <div className="flex flex-wrap items-center gap-3 rounded-xl border border-red-400/15 bg-red-500/[0.04] px-3 py-2.5">
                <label className="inline-flex items-center gap-2 text-xs text-white/65">
                  <input
                    type="checkbox"
                    checked={releaseOnRefund}
                    onChange={(e) => setReleaseOnRefund(e.target.checked)}
                    className="accent-flame-500"
                  />
                  Seats are back in my Eventim account — put them on sale again
                </label>
                <button
                  type="button"
                  onClick={() => void run('refund', { release: releaseOnRefund })}
                  disabled={!!busy}
                  className={BTN_DANGER}
                >
                  Mark refunded
                </button>
              </div>
            )}

            {r.status === 'refunded' && seatsAttached && (
              <div className="flex flex-wrap items-center gap-2">
                <button type="button" onClick={() => void run('release_seats')} disabled={!!busy} className={BTN_GHOST}>
                  Seats are back — return them to stock
                </button>
              </div>
            )}

            <div className="flex flex-wrap items-end gap-2">
              <label className="min-w-[200px] flex-1">
                <span className="mb-1 block text-[11px] text-white/45">Private note</span>
                <input value={note} onChange={(e) => setNote(e.target.value)} className={INPUT} maxLength={1000} />
              </label>
              <button
                type="button"
                onClick={() => void run('note', { adminNote: note })}
                disabled={!!busy || note === (r.admin_note ?? '')}
                className={BTN_GHOST}
              >
                Save note
              </button>
              <label className="inline-flex h-9 items-center gap-2 text-xs text-white/55">
                <input
                  type="checkbox"
                  checked={notify}
                  onChange={(e) => setNotify(e.target.checked)}
                  className="accent-flame-500"
                />
                Email the buyer on changes
              </label>
            </div>
          </div>

          {error && (
            <p className="mt-3 flex items-start gap-2 text-sm text-flame-200">
              <TriangleAlert className="mt-0.5 h-4 w-4 flex-shrink-0" /> {error}
            </p>
          )}
          {notice && <p className="mt-3 text-xs text-emerald-300/90">{notice}</p>}
        </div>
      )}
    </li>
  )
}

function Field({
  label,
  value,
  copy,
  strong,
  wide,
}: {
  label: string
  value: string
  copy?: boolean
  strong?: boolean
  wide?: boolean
}) {
  return (
    <div className={wide ? 'sm:col-span-2' : undefined}>
      <dt className="text-[11px] text-white/40">{label}</dt>
      <dd className={`flex items-center gap-1 break-all ${strong ? 'font-semibold text-white' : 'text-white/80'}`}>
        {value}
        {copy && <CopyButton value={value} />}
      </dd>
    </div>
  )
}

function ManualSaleForm({ data, onDone }: { data: ConsoleData; onDone: () => void }) {
  const router = useRouter()
  const priced = data.categories.filter((c) => c.price_cents !== null)
  const [category, setCategory] = useState(priced[0]?.code ?? '')
  const [quantity, setQuantity] = useState(2)
  const [buyerName, setBuyerName] = useState('')
  const [buyerEmail, setBuyerEmail] = useState('')
  const [eventimEmail, setEventimEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [note, setNote] = useState('')
  const [paid, setPaid] = useState(true)
  const [method, setMethod] = useState<PaymentMethod>('cash')
  const [notify, setNotify] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async () => {
    setBusy(true)
    setError(null)
    const result = await consoleCall(data.event.id, 'POST', {
      op: 'manual_sale',
      category,
      quantity,
      buyerName,
      buyerEmail,
      eventimEmail,
      phone,
      note,
      paid,
      paymentMethod: paid ? method : null,
      notify,
    })
    setBusy(false)
    if (!result.ok) {
      setError(errorText(result.error))
      return
    }
    onDone()
    router.refresh()
  }

  if (priced.length === 0) {
    return (
      <p className="mt-3 rounded-xl border border-amber-400/25 bg-amber-400/[0.06] px-4 py-3 text-sm text-amber-100/90">
        Set a price on at least one category (Stock & prices) before recording a sale.
      </p>
    )
  }

  return (
    <div className="mt-3 rounded-2xl border border-flame-500/25 bg-flame-500/[0.04] p-4">
      <p className="text-sm font-semibold text-white">Record a sale made outside the site</p>
      <p className="mt-0.5 text-xs text-white/50">
        WhatsApp, Instagram, in person — same seat rules: the group sits together, no lonely seats left behind.
      </p>
      <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
        <label>
          <span className="mb-1 block text-[11px] text-white/45">Category</span>
          <select value={category} onChange={(e) => setCategory(e.target.value)} className={INPUT}>
            {priced.map((c) => (
              <option key={c.code} value={c.code} className="bg-ink-950">
                {c.label} ({c.code}) · {eur(c.price_cents, data.sale.currency)}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="mb-1 block text-[11px] text-white/45">Seats</span>
          <input
            type="number"
            min={1}
            max={20}
            value={quantity}
            onChange={(e) => setQuantity(Math.max(1, Math.min(20, Number(e.target.value) || 1)))}
            className={INPUT}
          />
        </label>
        <label>
          <span className="mb-1 block text-[11px] text-white/45">Buyer name</span>
          <input value={buyerName} onChange={(e) => setBuyerName(e.target.value)} className={INPUT} maxLength={120} />
        </label>
        <label>
          <span className="mb-1 block text-[11px] text-white/45">Buyer email</span>
          <input type="email" value={buyerEmail} onChange={(e) => setBuyerEmail(e.target.value)} className={INPUT} />
        </label>
        <label>
          <span className="mb-1 block text-[11px] text-white/45">Eventim email (if different)</span>
          <input type="email" value={eventimEmail} onChange={(e) => setEventimEmail(e.target.value)} className={INPUT} />
        </label>
        <label>
          <span className="mb-1 block text-[11px] text-white/45">Phone / WhatsApp</span>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} className={INPUT} maxLength={40} />
        </label>
        <label className="sm:col-span-2">
          <span className="mb-1 block text-[11px] text-white/45">Note</span>
          <input value={note} onChange={(e) => setNote(e.target.value)} className={INPUT} maxLength={500} />
        </label>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <label className="inline-flex items-center gap-2 text-sm text-white/75">
          <input type="checkbox" checked={paid} onChange={(e) => setPaid(e.target.checked)} className="accent-flame-500" />
          Already paid
        </label>
        {paid && (
          <select value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)} className={`${INPUT} w-40`}>
            {PAYMENT_METHODS.map((m) => (
              <option key={m} value={m} className="bg-ink-950">
                {PAYMENT_LABEL[m]}
              </option>
            ))}
          </select>
        )}
        <label className="inline-flex items-center gap-2 text-sm text-white/75">
          <input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} className="accent-flame-500" />
          Email the buyer
        </label>
        <button
          type="button"
          onClick={() => void submit()}
          disabled={busy || buyerName.trim().length < 2 || !buyerEmail.includes('@') || !category}
          className={`${BTN_PRIMARY} ml-auto`}
        >
          {busy && <Loader2 className="h-4 w-4 animate-spin" />} Assign seats
        </button>
      </div>
      {error && (
        <p className="mt-3 flex items-start gap-2 text-sm text-flame-200">
          <TriangleAlert className="mt-0.5 h-4 w-4 flex-shrink-0" /> {error}
        </p>
      )}
    </div>
  )
}
