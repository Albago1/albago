'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Copy, Download, Trash2 } from 'lucide-react'
import { toCsv } from '@/lib/seats/format'
import type { SeatWaitlistRow } from '@/lib/seats/types'
import { consoleCall, downloadCsv, errorText, shortDateTime, type ConsoleData } from './consoleShared'

const BTN =
  'inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] px-3 text-[13px] font-semibold text-white/80 transition hover:bg-white/[0.07] disabled:cursor-not-allowed disabled:opacity-40'

export default function WaitlistPanel({ data }: { data: ConsoleData }) {
  const router = useRouter()
  const { waitlist } = data
  const [copied, setCopied] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const labels = useMemo(() => new Map(data.categories.map((c) => [c.code, c.label])), [data.categories])

  const seatsWanted = waitlist.reduce((n, w) => n + w.quantity, 0)

  const copyEmails = async () => {
    try {
      await navigator.clipboard.writeText(waitlist.map((w) => w.email).join(', '))
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* clipboard blocked */
    }
  }

  const exportCsv = () => {
    downloadCsv(
      `${data.event.slug}-seat-waitlist.csv`,
      toCsv(
        ['Name', 'Email', 'Phone', 'Category', 'Seats', 'City', 'Joined'],
        waitlist.map((w) => [
          w.name,
          w.email,
          w.phone ?? '',
          w.category ? labels.get(w.category) ?? w.category : 'Any',
          String(w.quantity),
          w.city ?? '',
          shortDateTime(w.created_at),
        ]),
      ),
    )
  }

  const remove = async (w: SeatWaitlistRow) => {
    if (!confirm(`Remove ${w.email} from the waitlist?`)) return
    setBusyId(w.id)
    setError(null)
    const result = await consoleCall(data.event.id, 'POST', { op: 'delete_waitlist', id: w.id })
    setBusyId(null)
    if (!result.ok) {
      setError(errorText(result.error))
      return
    }
    router.refresh()
  }

  if (waitlist.length === 0) {
    return (
      <p className="rounded-xl border border-white/[0.07] bg-white/[0.02] px-4 py-8 text-center text-sm text-white/45">
        Nobody on the waitlist yet. Switch the sale to Waitlist mode to start collecting interest before launch.
      </p>
    )
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <p className="flex-1 text-sm text-white/65">
          <span className="font-semibold text-white">{waitlist.length}</span> people · {seatsWanted} seats wanted
        </p>
        <button type="button" onClick={() => void copyEmails()} className={BTN}>
          {copied ? <Check className="h-4 w-4 text-emerald-300" /> : <Copy className="h-4 w-4" />} Copy all emails
        </button>
        <button type="button" onClick={exportCsv} className={BTN}>
          <Download className="h-4 w-4" /> CSV
        </button>
      </div>
      {error && <p className="mt-2 text-xs text-flame-200">{error}</p>}
      <ul className="mt-3 divide-y divide-white/[0.06] rounded-2xl border border-white/[0.07] bg-white/[0.02]">
        {waitlist.map((w) => (
          <li key={w.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-white">{w.name}</p>
              <p className="truncate text-xs text-white/50">
                {w.email}
                {w.phone ? ` · ${w.phone}` : ''}
                {w.city ? ` · ${w.city}` : ''}
              </p>
            </div>
            <span className="text-xs text-white/60">
              {w.quantity} × {w.category ? labels.get(w.category) ?? w.category : 'any category'}
            </span>
            <span className="text-[11px] text-white/35">{shortDateTime(w.created_at)}</span>
            <button
              type="button"
              onClick={() => void remove(w)}
              disabled={busyId === w.id}
              title="Remove"
              className="text-white/30 transition hover:text-flame-300 disabled:opacity-50"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
