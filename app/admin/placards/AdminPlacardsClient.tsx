'use client'

import { useMemo, useState } from 'react'
import { Check, Flame, Loader2, RotateCcw, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/browser'
import {
  PLACARD_CATEGORY_LABELS,
  PLACARD_LANGUAGE_LABELS,
} from '@/lib/placards'
import type { PlacardCategory, PlacardLanguage, PlacardRow } from '@/lib/placards'

type StatusTab = 'pending' | 'approved' | 'rejected'

type Props = {
  initialRows: PlacardRow[]
  migrationApplied: boolean
}

export default function AdminPlacardsClient({ initialRows, migrationApplied }: Props) {
  const [tab, setTab] = useState<StatusTab>('pending')
  const [rows, setRows] = useState<PlacardRow[]>(initialRows)
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const counts = useMemo(() => {
    return {
      pending: rows.filter((r) => r.status === 'pending').length,
      approved: rows.filter((r) => r.status === 'approved').length,
      rejected: rows.filter((r) => r.status === 'rejected').length,
    }
  }, [rows])

  const filtered = useMemo(() => rows.filter((r) => r.status === tab), [rows, tab])

  async function moderate(id: string, newStatus: StatusTab, note: string | null = null) {
    setError(null)
    setPendingId(id)
    const prev = rows
    setRows((all) =>
      all.map((r) =>
        r.id === id
          ? {
              ...r,
              status: newStatus,
              admin_note: note ?? r.admin_note,
              approved_at:
                newStatus === 'approved' ? new Date().toISOString() : r.approved_at,
              updated_at: new Date().toISOString(),
            }
          : r,
      ),
    )
    try {
      const supabase = createClient()
      const { error: rpcError } = await supabase.rpc('admin_moderate_placard', {
        placard_id: id,
        new_status: newStatus,
        note,
      })
      if (rpcError) throw rpcError
    } catch (e) {
      setRows(prev)
      const msg = e instanceof Error ? e.message : 'Operacioni dështoi.'
      setError(msg)
    } finally {
      setPendingId(null)
    }
  }

  if (!migrationApplied) {
    return (
      <div className="mx-auto max-w-2xl rounded-3xl border border-flame-500/30 bg-flame-500/[0.06] p-6 text-sm text-flame-100">
        <p className="font-semibold text-white">Migrimi Phase 20 nuk është aplikuar.</p>
        <p className="mt-2">
          Paste {`docs/seeds/phase-20-placard-library.sql`} në Supabase Studio për të
          aktivizuar moderimin.
        </p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-5xl">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight text-white">
          Pankartat — moderim
        </h1>
        <p className="text-sm text-white/55">
          Aprovo ose refuzo pankartat e dërguara nga komuniteti.
        </p>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-2">
        {(['pending', 'approved', 'rejected'] as StatusTab[]).map((s) => {
          const active = tab === s
          return (
            <button
              key={s}
              type="button"
              onClick={() => setTab(s)}
              className={[
                'inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition',
                active
                  ? 'border-flame-500/55 bg-flame-500/15 text-flame-100'
                  : 'border-white/10 bg-white/[0.04] text-white/70 hover:text-white',
              ].join(' ')}
            >
              <span>
                {s === 'pending'
                  ? 'Në pritje'
                  : s === 'approved'
                    ? 'Të miratuara'
                    : 'Të refuzuara'}
              </span>
              <span className="rounded-full bg-white/10 px-1.5 text-[10px] font-bold text-white/85">
                {counts[s]}
              </span>
            </button>
          )
        })}
      </div>

      {error && (
        <div className="mt-4 rounded-2xl border border-flame-500/40 bg-flame-500/10 px-4 py-3 text-sm text-flame-100">
          {error}
        </div>
      )}

      <div className="mt-6 flex flex-col gap-3">
        {filtered.length === 0 ? (
          <div className="rounded-3xl border border-white/10 bg-white/[0.02] p-8 text-center text-sm text-white/55">
            Asnjë pankartë në këtë status.
          </div>
        ) : (
          filtered.map((row) => {
            const cats = (row.categories ?? []) as PlacardCategory[]
            const lang = PLACARD_LANGUAGE_LABELS[row.language as PlacardLanguage]
            return (
              <div
                key={row.id}
                className="flex flex-col gap-4 rounded-3xl border border-white/10 bg-white/[0.02] p-5 sm:flex-row sm:items-center"
              >
                <div className="min-w-0 flex-1">
                  <p
                    className="text-white"
                    style={{
                      fontFamily: "'Instrument Serif', Georgia, serif",
                      fontSize: 24,
                      lineHeight: 1.15,
                    }}
                  >
                    {row.slogan}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px] text-white/55">
                    {lang && (
                      <span className="rounded-full bg-white/[0.05] px-2 py-0.5 font-semibold uppercase tracking-wide">
                        {lang.flag} {lang.label}
                      </span>
                    )}
                    {cats.map((c) => (
                      <span
                        key={c}
                        className="rounded-full bg-white/[0.05] px-2 py-0.5 font-semibold uppercase tracking-wide"
                      >
                        {PLACARD_CATEGORY_LABELS[c] ?? c}
                      </span>
                    ))}
                    {row.city && (
                      <span className="rounded-full bg-white/[0.05] px-2 py-0.5">
                        {row.city}
                      </span>
                    )}
                    <span className="inline-flex items-center gap-1 rounded-full bg-flame-500/10 px-2 py-0.5 text-flame-200">
                      <Flame className="h-3 w-3" /> {row.vote_count}
                    </span>
                    {row.submitter_name && (
                      <span className="text-white/45">· {row.submitter_name}</span>
                    )}
                  </div>
                  {row.admin_note && (
                    <p className="mt-2 text-[12px] italic text-white/45">
                      Shënim moderatori: {row.admin_note}
                    </p>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2 sm:flex-nowrap">
                  {row.status !== 'approved' && (
                    <button
                      type="button"
                      disabled={pendingId === row.id}
                      onClick={() => moderate(row.id, 'approved')}
                      className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-100 transition hover:bg-emerald-500/15 disabled:opacity-50"
                    >
                      {pendingId === row.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Check className="h-3.5 w-3.5" />
                      )}
                      Aprovo
                    </button>
                  )}
                  {row.status !== 'rejected' && (
                    <button
                      type="button"
                      disabled={pendingId === row.id}
                      onClick={() => moderate(row.id, 'rejected')}
                      className="inline-flex items-center gap-1.5 rounded-full border border-flame-500/40 bg-flame-500/10 px-3 py-1.5 text-xs font-semibold text-flame-100 transition hover:bg-flame-500/15 disabled:opacity-50"
                    >
                      <X className="h-3.5 w-3.5" />
                      Refuzo
                    </button>
                  )}
                  {row.status !== 'pending' && (
                    <button
                      type="button"
                      disabled={pendingId === row.id}
                      onClick={() => moderate(row.id, 'pending')}
                      className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.04] px-3 py-1.5 text-xs font-semibold text-white/75 transition hover:text-white disabled:opacity-50"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      Rivendos
                    </button>
                  )}
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
