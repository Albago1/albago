'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import {
  ShieldCheck,
  BadgeCheck,
  CheckCircle2,
  XCircle,
  Loader2,
  ExternalLink,
  AlertTriangle,
  Phone,
  Globe,
  Mail,
  ArrowLeft,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/browser'
import type {
  Organizer,
  VerificationTier,
  IdReviewStatus,
} from '@/types/organizer'

type Row = Organizer

type Tab = 'pending' | 'verified' | 'established' | 'all'

const TIER_LABEL: Record<VerificationTier, string> = {
  unverified: 'Unverified',
  established: 'Established',
  verified: 'Verified',
}

const TIER_STYLE: Record<VerificationTier, string> = {
  unverified: 'border-white/15 bg-white/[0.05] text-white/60',
  established: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300',
  verified: 'border-flame-500/30 bg-flame-500/10 text-flame-400',
}

const ID_STATUS_LABEL: Record<IdReviewStatus, string> = {
  none: 'Not submitted',
  pending: 'Awaiting review',
  approved: 'Approved',
  rejected: 'Rejected',
}

export default function OrganizersAdminClient() {
  const supabase = createClient()

  const [tab, setTab] = useState<Tab>('pending')
  const [rows, setRows] = useState<Row[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [previewUrlByRow, setPreviewUrlByRow] = useState<Record<string, string>>(
    {},
  )
  const [notesByRow, setNotesByRow] = useState<Record<string, string>>({})

  const load = useCallback(async () => {
    setIsLoading(true)
    setErrorMessage(null)

    let q = supabase
      .from('organizers')
      .select('*')
      .order('id_reviewed_at', { ascending: false, nullsFirst: false })
      .order('updated_at', { ascending: false })
      .limit(200)

    if (tab === 'pending') {
      q = q.eq('id_review_status', 'pending')
    } else if (tab === 'verified') {
      q = q.eq('verification_tier', 'verified')
    } else if (tab === 'established') {
      q = q.eq('verification_tier', 'established')
    }

    const { data, error } = await q
    setIsLoading(false)
    if (error) {
      setErrorMessage(error.message)
      return
    }
    setRows((data ?? []) as Row[])
  }, [supabase, tab])

  useEffect(() => {
    void load()
  }, [load])

  const openDocument = async (row: Row) => {
    if (!row.id_document_url) return
    if (previewUrlByRow[row.id]) {
      window.open(previewUrlByRow[row.id], '_blank', 'noopener,noreferrer')
      return
    }
    const { data, error } = await supabase.storage
      .from('organizer-verification')
      .createSignedUrl(row.id_document_url, 60 * 5)
    if (error || !data?.signedUrl) {
      setErrorMessage(error?.message ?? 'Could not open document')
      return
    }
    setPreviewUrlByRow((m) => ({ ...m, [row.id]: data.signedUrl }))
    window.open(data.signedUrl, '_blank', 'noopener,noreferrer')
  }

  const approve = async (row: Row) => {
    setBusyId(row.id)
    setErrorMessage(null)
    const { error } = await supabase.rpc('admin_review_organizer_id', {
      p_organizer_id: row.id,
      p_decision: 'approved',
      p_notes: notesByRow[row.id] ?? null,
    })
    setBusyId(null)
    if (error) {
      setErrorMessage(error.message)
      return
    }
    await load()
  }

  const reject = async (row: Row) => {
    const notes = notesByRow[row.id]
    if (!notes || notes.trim().length === 0) {
      setErrorMessage(
        'Please add a short note explaining the rejection so the organizer can fix it.',
      )
      return
    }
    setBusyId(row.id)
    setErrorMessage(null)
    const { error } = await supabase.rpc('admin_review_organizer_id', {
      p_organizer_id: row.id,
      p_decision: 'rejected',
      p_notes: notes,
    })
    setBusyId(null)
    if (error) {
      setErrorMessage(error.message)
      return
    }
    await load()
  }

  const unverify = async (row: Row) => {
    const reason = window.prompt(
      `Drop ${row.display_name} back to unverified?\nEnter a short reason (optional):`,
    )
    if (reason === null) return
    setBusyId(row.id)
    setErrorMessage(null)
    const { error } = await supabase.rpc('admin_unverify_organizer', {
      p_organizer_id: row.id,
      p_reason: reason || null,
    })
    setBusyId(null)
    if (error) {
      setErrorMessage(error.message)
      return
    }
    await load()
  }

  return (
    <div className="mx-auto max-w-5xl">
      <Link
        href="/admin"
        className="inline-flex items-center gap-1.5 text-sm text-white/55 transition hover:text-white"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to admin
      </Link>

      <div className="mt-6 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04]">
          <ShieldCheck className="h-5 w-5 text-flame-400" />
        </div>
        <div>
          <h1 className="text-3xl font-bold">Organizer verification</h1>
          <p className="mt-0.5 text-sm text-white/55">
            Review ID submissions and manage trusted organizers.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="mt-8 flex flex-wrap gap-2">
        {([
          { key: 'pending', label: 'Awaiting review' },
          { key: 'verified', label: 'Verified' },
          { key: 'established', label: 'Established' },
          { key: 'all', label: 'All organizers' },
        ] as { key: Tab; label: string }[]).map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition ${
              tab === t.key
                ? 'border-white/20 bg-white/[0.08] text-white'
                : 'border-white/10 bg-transparent text-white/55 hover:bg-white/[0.04] hover:text-white/80'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {errorMessage && (
        <div className="mt-4 flex items-start gap-2 rounded-2xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-200">
          <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Rows */}
      <div className="mt-6 space-y-3">
        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-white/55">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading…
          </div>
        ) : rows.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-white/10 bg-white/[0.02] p-10 text-center text-sm text-white/55">
            Nothing here.
          </div>
        ) : (
          rows.map((row) => (
            <div
              key={row.id}
              className="rounded-3xl border border-white/10 bg-white/[0.03] p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/organizers/${row.slug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-lg font-semibold text-white transition hover:text-white/85"
                    >
                      {row.display_name}
                      <ExternalLink className="h-3.5 w-3.5 text-white/40" />
                    </Link>
                    <span
                      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${
                        TIER_STYLE[row.verification_tier]
                      }`}
                    >
                      {row.verification_tier === 'verified' ? (
                        <BadgeCheck className="h-3 w-3" />
                      ) : null}
                      {TIER_LABEL[row.verification_tier]}
                    </span>
                  </div>
                  <div className="mt-2 grid gap-1 text-xs text-white/55 sm:grid-cols-2">
                    <span className="inline-flex items-center gap-1.5">
                      <Mail className="h-3.5 w-3.5" />
                      {row.contact_email}
                    </span>
                    {row.phone && (
                      <span className="inline-flex items-center gap-1.5">
                        <Phone className="h-3.5 w-3.5" />
                        {row.phone}
                      </span>
                    )}
                    {row.website_url && (
                      <span className="inline-flex items-center gap-1.5">
                        <Globe className="h-3.5 w-3.5" />
                        <a
                          href={row.website_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:text-white"
                        >
                          {row.website_url}
                        </a>
                      </span>
                    )}
                    <span>
                      ID:{' '}
                      <strong className="text-white/85">
                        {ID_STATUS_LABEL[row.id_review_status]}
                      </strong>
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  {row.id_document_url && (
                    <button
                      type="button"
                      onClick={() => openDocument(row)}
                      className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-semibold text-white/85 transition hover:bg-white/[0.08] hover:text-white"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      View document
                    </button>
                  )}
                  {row.verification_tier === 'verified' && (
                    <button
                      type="button"
                      disabled={busyId === row.id}
                      onClick={() => unverify(row)}
                      className="inline-flex items-center gap-1.5 rounded-full border border-red-500/20 bg-red-500/10 px-3 py-1.5 text-xs font-semibold text-red-300 transition hover:bg-red-500/15 disabled:opacity-60"
                    >
                      {busyId === row.id && (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      )}
                      Un-verify
                    </button>
                  )}
                </div>
              </div>

              {row.id_review_status === 'pending' && (
                <div className="mt-4 space-y-3 rounded-2xl border border-white/10 bg-black/20 p-4">
                  <textarea
                    rows={2}
                    placeholder="Notes for the organizer (required to reject)"
                    value={notesByRow[row.id] ?? ''}
                    onChange={(e) =>
                      setNotesByRow((m) => ({
                        ...m,
                        [row.id]: e.target.value,
                      }))
                    }
                    className="w-full rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-sm text-white outline-none placeholder:text-white/30 focus:border-flame-500/40 focus:ring-2 focus:ring-flame-500/20"
                  />
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={busyId === row.id}
                      onClick={() => approve(row)}
                      className="inline-flex items-center gap-1.5 rounded-full bg-flame-500 px-4 py-2 text-sm font-semibold text-white shadow-[0_8px_20px_-8px_rgba(238,28,37,0.55)] transition hover:bg-flame-400 disabled:opacity-60"
                    >
                      {busyId === row.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <CheckCircle2 className="h-3.5 w-3.5" />
                      )}
                      Approve & verify
                    </button>
                    <button
                      type="button"
                      disabled={busyId === row.id}
                      onClick={() => reject(row)}
                      className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.04] px-4 py-2 text-sm font-semibold text-white/85 transition hover:bg-white/[0.08] disabled:opacity-60"
                    >
                      <XCircle className="h-3.5 w-3.5" />
                      Reject
                    </button>
                  </div>
                </div>
              )}

              {row.id_review_notes && row.id_review_status !== 'pending' && (
                <p className="mt-3 whitespace-pre-line rounded-2xl border border-white/10 bg-black/20 p-3 text-xs text-white/55">
                  {row.id_review_notes}
                </p>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
