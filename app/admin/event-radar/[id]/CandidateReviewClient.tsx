'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  AlertTriangle,
  ArrowLeft,
  BadgeCheck,
  Check,
  CircleAlert,
  ExternalLink,
  Loader2,
  RotateCcw,
  Save,
  Trash2,
  X,
} from 'lucide-react'
import type { EventImportCandidate } from '@/lib/radar/candidate'
import { LENS_CATEGORIES } from '@/lib/ai/posterReader'
import { missingApprovalFields } from '@/lib/radar/approvalValidation'
import { StatusBadge, ConfidenceBadge } from '../badges'

/**
 * Event Radar (RADAR-1) candidate review. Shows the extracted draft, the source
 * evidence, the transparent warnings + missing fields, and the edit/approve/
 * reject/retry actions. Approve mints a pending submission — it never publishes,
 * and the UI keeps "draft", "approved candidate", and "published" unmistakable.
 */

type EditableString =
  | 'title'
  | 'description'
  | 'date'
  | 'time'
  | 'end_time'
  | 'venue_name'
  | 'address'
  | 'city'
  | 'country'
  | 'price'
  | 'organizer_name'
  | 'organizer_website'

const TEXT_FIELDS: Array<{ key: EditableString; label: string; textarea?: boolean; placeholder?: string }> = [
  { key: 'title', label: 'Title' },
  { key: 'date', label: 'Date', placeholder: 'YYYY-MM-DD' },
  { key: 'time', label: 'Start time', placeholder: 'HH:MM' },
  { key: 'end_time', label: 'End time', placeholder: 'HH:MM' },
  { key: 'venue_name', label: 'Venue' },
  { key: 'address', label: 'Address' },
  { key: 'city', label: 'City' },
  { key: 'country', label: 'Country' },
  { key: 'price', label: 'Price', placeholder: 'exactly as stated' },
  { key: 'organizer_name', label: 'Organizer' },
  { key: 'organizer_website', label: 'Organizer website' },
  { key: 'description', label: 'Description', textarea: true },
]

// Fields the event_submissions queue requires (NOT NULL, no mapping fallback).
const REQUIRED_KEYS = new Set<EditableString>(['title', 'date', 'time'])

function fmtTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })
  } catch {
    return iso
  }
}

export default function CandidateReviewClient({ candidate }: { candidate: EventImportCandidate }) {
  const router = useRouter()
  const reading = candidate.reading

  const [form, setForm] = useState<Record<EditableString, string>>(() => {
    const base = {} as Record<EditableString, string>
    for (const { key } of TEXT_FIELDS) base[key] = (reading?.[key] as string) ?? ''
    return base
  })
  const [category, setCategory] = useState<string>(reading?.category ?? '')
  const [tags, setTags] = useState<string>((reading?.tags ?? []).join(', '))
  const [isCivic, setIsCivic] = useState<boolean>(reading?.is_civic ?? false)

  const [busy, setBusy] = useState<null | 'save' | 'approve' | 'reject' | 'retry' | 'delete'>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [rejecting, setRejecting] = useState(false)
  const [rejectNote, setRejectNote] = useState('')

  const isOpen = candidate.status === 'needs_review'
  const isApproved = candidate.status === 'approved'
  const isFailed = candidate.status === 'failed'
  const dupSlug = candidate.duplicate_event_slug

  // Required-for-queue fields still blank, computed from the LIVE form so the
  // "Required before approval" list and the disabled Approve button update the
  // instant the admin types — no re-import needed. Same validator the server
  // uses, so the two can never disagree.
  const blockers = useMemo(
    () => missingApprovalFields({ title: form.title, date: form.date, time: form.time }),
    [form.title, form.date, form.time],
  )
  const blockedKeys = new Set<string>(blockers.map((b) => b.field))
  const canSubmit = blockers.length === 0

  const focusFirstBlocker = () => {
    const first = blockers[0]
    if (first) document.getElementById(`radar-field-${first.field}`)?.focus()
  }

  const patch = useMemo(
    () => ({
      ...form,
      category,
      is_civic: isCivic,
      tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
    }),
    [form, category, isCivic, tags],
  )

  async function act(
    kind: NonNullable<typeof busy>,
    body: Record<string, unknown>,
  ): Promise<Record<string, unknown> | null> {
    setBusy(kind)
    setError(null)
    setMessage(null)
    try {
      const res = await fetch(`/api/admin/event-radar/${candidate.id}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok || !json?.ok) {
        setError(json?.message || `Action failed (${json?.error ?? res.status}).`)
        return null
      }
      return json
    } catch {
      setError('Something went wrong reaching the server.')
      return null
    } finally {
      setBusy(null)
    }
  }

  const save = async () => {
    if (await act('save', { action: 'save', patch })) {
      setMessage('Edits saved.')
      router.refresh()
    }
  }
  const approve = async () => {
    // Guard before touching the server: never fire a known-invalid approval.
    if (!canSubmit) {
      setError(
        `Cannot approve yet — ${blockers.map((b) => b.label).join(', ')} ${
          blockers.length === 1 ? 'is' : 'are'
        } required by the submission queue.`,
      )
      focusFirstBlocker()
      return
    }
    // Save any pending edits first so the submission reflects what's on screen.
    await act('save', { action: 'save', patch })
    const res = await act('approve', { action: 'approve' })
    if (res) {
      setMessage(
        res.alreadyApproved
          ? 'Already sent to the Queue — no duplicate created.'
          : 'Approved — a pending submission is now in the Queue.',
      )
      router.refresh()
    }
  }
  const reject = async () => {
    if (await act('reject', { action: 'reject', note: rejectNote })) {
      setRejecting(false)
      router.refresh()
    }
  }
  const retry = async () => {
    if (await act('retry', { action: 'retry' })) {
      setMessage('Re-read the source.')
      router.refresh()
    }
  }
  const remove = async () => {
    if (!window.confirm('Delete this candidate permanently?')) return
    setBusy('delete')
    setError(null)
    try {
      const res = await fetch(`/api/admin/event-radar/${candidate.id}`, { method: 'DELETE' })
      const json = await res.json().catch(() => null)
      if (!res.ok || !json?.ok) {
        setError(json?.message || 'Delete failed.')
        setBusy(null)
        return
      }
      router.push('/admin/event-radar')
      router.refresh()
    } catch {
      setError('Delete failed.')
      setBusy(null)
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <Link
        href="/admin/event-radar"
        className="mb-5 inline-flex items-center gap-1.5 text-sm text-white/55 transition hover:text-white"
      >
        <ArrowLeft className="h-4 w-4" />
        Event Radar
      </Link>

      {/* Header / evidence */}
      <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5">
        <div className="flex flex-wrap items-center gap-2">
          <ConfidenceBadge confidence={candidate.confidence} />
          <StatusBadge status={candidate.status} />
          {isCivic && (
            <span className="rounded-full bg-flame-500/15 px-2 py-0.5 text-[11px] font-medium text-flame-300 ring-1 ring-flame-500/30">
              civic
            </span>
          )}
        </div>
        <h1 className="mt-3 text-xl font-semibold text-white">
          {candidate.title || 'Untitled candidate'}
        </h1>
        <div className="mt-2 flex flex-col gap-1 text-xs text-white/45">
          <a
            href={candidate.source_url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex w-fit items-center gap-1.5 text-white/60 hover:text-white"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            {candidate.source_name || candidate.source_url}
          </a>
          <span>Imported {fmtTime(candidate.created_at)}</span>
        </div>
      </div>

      {/* Lifecycle banners — the three states must never be confused (§10) */}
      {isApproved && (
        <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-emerald-500/25 bg-emerald-500/[0.07] px-4 py-3 text-sm text-emerald-200">
          <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            Approved. A <strong>pending submission</strong> was created — it is not public yet.
            Finish publishing it in the{' '}
            <Link href="/admin/queue" className="underline underline-offset-2">
              Queue
            </Link>
            .
          </span>
        </div>
      )}
      {isFailed && (
        <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-flame-500/25 bg-flame-500/[0.07] px-4 py-3 text-sm text-flame-200">
          <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{candidate.error || 'The source could not be read.'}</span>
        </div>
      )}

      {/* Duplicate + warnings + missing */}
      {dupSlug && (
        <div className="mt-4 rounded-xl border border-amber-500/25 bg-amber-500/[0.06] px-4 py-3 text-sm text-amber-200">
          A published event may already cover this.{' '}
          <a
            href={`/events/${dupSlug}`}
            target="_blank"
            rel="noreferrer"
            className="underline underline-offset-2"
          >
            Open it
          </a>{' '}
          before approving.
        </div>
      )}

      {/* Required-before-approval — the hard gate. Distinct from soft warnings
          so the admin sees exactly what blocks the queue (spec UI + §2). */}
      {isOpen && blockers.length > 0 && (
        <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/[0.06] p-4">
          <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-red-300">
            <CircleAlert className="h-3.5 w-3.5" />
            Required before approval
          </h3>
          <ul className="space-y-1 text-[13px] text-white/80">
            {blockers.map((b) => (
              <li key={b.field} className="flex items-center gap-1.5">
                <span className="h-1 w-1 shrink-0 rounded-full bg-red-400" />
                {b.label}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[12px] text-white/45">
            Enter {blockers.length === 1 ? 'this value' : 'these values'} and Save edits — the source
            didn&apos;t provide {blockers.length === 1 ? 'it' : 'them'}, and nothing is guessed.
          </p>
        </div>
      )}

      {(candidate.warnings?.length > 0 || candidate.missing_fields?.length > 0) && (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {candidate.warnings?.length > 0 && (
            <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4">
              <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-amber-300/80">
                <AlertTriangle className="h-3.5 w-3.5" />
                Additional warnings ({candidate.warnings.length})
              </h3>
              <ul className="space-y-1.5 text-[13px] leading-snug text-white/70">
                {candidate.warnings.map((w) => (
                  <li key={w.code} className="flex gap-1.5">
                    <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-amber-400/70" />
                    {w.message}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {candidate.missing_fields?.length > 0 && (
            <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-white/40">
                Missing fields ({candidate.missing_fields.length})
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {candidate.missing_fields.map((f) => (
                  <span
                    key={f}
                    className="rounded-full bg-white/[0.05] px-2 py-0.5 text-[11px] capitalize text-white/60"
                  >
                    {f}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {candidate.image_url && (
        <div className="mt-4">
          <p className="mb-1.5 flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-white/40">
            <BadgeCheck className="h-3.5 w-3.5 text-emerald-400/70" />
            Cover image
            {isOpen && (
              <span className="font-normal normal-case tracking-normal text-white/45">
                — published as the event&apos;s cover on approval
              </span>
            )}
          </p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={candidate.image_url}
            alt=""
            className="max-h-56 rounded-xl border border-white/10 object-contain"
          />
        </div>
      )}

      {/* Editable draft */}
      {reading && (
        <div className="mt-6">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-white/40">
            Extracted draft {isOpen ? '(editable)' : '(read-only)'}
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {TEXT_FIELDS.map((field) => {
              const required = REQUIRED_KEYS.has(field.key)
              const blocked = blockedKeys.has(field.key)
              const inputClass = [
                'w-full rounded-lg border bg-white/[0.03] px-3 py-2 text-[13px] text-white placeholder:text-white/25 focus:outline-none disabled:opacity-60',
                blocked
                  ? 'border-red-500/60 focus:border-red-500'
                  : 'border-white/10 focus:border-flame-500/40',
              ].join(' ')
              return (
                <label
                  key={field.key}
                  className={field.textarea ? 'sm:col-span-2 block' : 'block'}
                >
                  <span className="mb-1 block text-[11px] font-medium text-white/45">
                    {field.label}
                    {required && <span className="ml-0.5 text-red-400">*</span>}
                  </span>
                  {field.textarea ? (
                    <textarea
                      id={`radar-field-${field.key}`}
                      rows={4}
                      disabled={!isOpen}
                      value={form[field.key]}
                      onChange={(e) => setForm((f) => ({ ...f, [field.key]: e.target.value }))}
                      className={`resize-y ${inputClass}`}
                    />
                  ) : (
                    <input
                      id={`radar-field-${field.key}`}
                      type="text"
                      disabled={!isOpen}
                      value={form[field.key]}
                      placeholder={field.placeholder}
                      onChange={(e) => setForm((f) => ({ ...f, [field.key]: e.target.value }))}
                      className={inputClass}
                    />
                  )}
                </label>
              )
            })}

            <label className="block">
              <span className="mb-1 block text-[11px] font-medium text-white/45">Category</span>
              <select
                disabled={!isOpen}
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-[13px] text-white focus:border-flame-500/40 focus:outline-none disabled:opacity-60"
              >
                <option value="">— none —</option>
                {LENS_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-1 block text-[11px] font-medium text-white/45">Tags (comma-separated)</span>
              <input
                type="text"
                disabled={!isOpen}
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-[13px] text-white focus:border-flame-500/40 focus:outline-none disabled:opacity-60"
              />
            </label>

            <label className="flex items-center gap-2 sm:col-span-2">
              <input
                type="checkbox"
                disabled={!isOpen}
                checked={isCivic}
                onChange={(e) => setIsCivic(e.target.checked)}
                className="h-4 w-4 accent-flame-500"
              />
              <span className="text-[13px] text-white/70">Civic event (protest / commemoration / assembly)</span>
            </label>
          </div>
        </div>
      )}

      {message && <p className="mt-4 text-sm text-emerald-300/90">{message}</p>}
      {error && (
        <div className="mt-4 flex items-start gap-2 rounded-lg border border-flame-500/30 bg-flame-500/10 px-3.5 py-2.5 text-sm text-flame-200">
          <X className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Actions */}
      <div className="mt-6 flex flex-wrap items-center gap-2 border-t border-white/[0.06] pt-5">
        {isOpen && reading && (
          <>
            <button
              type="button"
              onClick={() => void save()}
              disabled={busy !== null}
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-semibold text-white/85 transition hover:bg-white/[0.08] disabled:opacity-40"
            >
              {busy === 'save' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save edits
            </button>
            <button
              type="button"
              onClick={() => void approve()}
              disabled={busy !== null || !canSubmit}
              title={
                canSubmit
                  ? 'Create a pending submission in the Queue'
                  : `Add ${blockers.map((b) => b.label).join(', ')} first`
              }
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {busy === 'approve' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              Approve → Queue
            </button>
            {!canSubmit && (
              <span className="text-[12px] text-white/45">
                Approval needs {blockers.map((b) => b.label).join(', ')}.
              </span>
            )}
            <button
              type="button"
              onClick={() => setRejecting((v) => !v)}
              disabled={busy !== null}
              className="inline-flex items-center gap-1.5 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm font-semibold text-red-200 transition hover:bg-red-500/20 disabled:opacity-40"
            >
              <X className="h-4 w-4" />
              Reject
            </button>
          </>
        )}

        {(isOpen || isFailed) && (
          <button
            type="button"
            onClick={() => void retry()}
            disabled={busy !== null}
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-semibold text-white/85 transition hover:bg-white/[0.08] disabled:opacity-40"
          >
            {busy === 'retry' ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
            Retry extraction
          </button>
        )}

        <button
          type="button"
          onClick={() => void remove()}
          disabled={busy !== null}
          className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-red-500/30 bg-red-500/[0.05] px-3 py-2 text-sm font-medium text-red-200/90 transition hover:bg-red-500/15 disabled:opacity-40"
        >
          {busy === 'delete' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
          Delete
        </button>
      </div>

      {rejecting && (
        <div className="mt-3 rounded-xl border border-white/10 bg-white/[0.02] p-4">
          <textarea
            rows={2}
            value={rejectNote}
            onChange={(e) => setRejectNote(e.target.value)}
            placeholder="Optional reason for rejecting…"
            className="w-full resize-none rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-[13px] text-white placeholder:text-white/25 focus:border-flame-500/40 focus:outline-none"
          />
          <div className="mt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setRejecting(false)}
              className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-semibold text-white/70 hover:bg-white/[0.08]"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void reject()}
              disabled={busy !== null}
              className="rounded-lg bg-red-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-red-500 disabled:opacity-40"
            >
              Confirm reject
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
