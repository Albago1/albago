'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft,
  ShieldCheck,
  CheckCircle2,
  Clock,
  AlertCircle,
  Loader2,
  Upload,
  Phone,
  BadgeCheck,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/browser'
import LandingNavbar from '@/components/layout/LandingNavbar'
import type { Organizer } from '@/types/organizer'

type Props = {
  organizer: Organizer
  publishedRecentCount: number
}

const TIER_LABEL: Record<Organizer['verification_tier'], string> = {
  unverified: 'Unverified',
  established: 'Established',
  verified: 'Verified',
}

const TIER_DESCRIPTION: Record<Organizer['verification_tier'], string> = {
  unverified:
    'Every event you create is reviewed by an admin before it goes live.',
  established:
    'Your events publish instantly. You earned this by getting 2 events approved.',
  verified:
    'Your events publish instantly. Your profile shows a Verified badge across AlbaGo.',
}

export default function VerificationClient({
  organizer,
  publishedRecentCount,
}: Props) {
  const supabase = createClient()
  const router = useRouter()

  const [phone, setPhone] = useState(organizer.phone ?? '')
  const [file, setFile] = useState<File | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const tier = organizer.verification_tier
  const idStatus = organizer.id_review_status

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setErrorMessage(null)
    setSuccessMessage(null)

    if (!file) {
      setErrorMessage('Please attach an ID document (image or PDF).')
      return
    }
    if (file.size > 8 * 1024 * 1024) {
      setErrorMessage('File is too large — max 8 MB.')
      return
    }
    if (!phone || phone.trim().length < 5) {
      setErrorMessage('Please enter a valid phone number.')
      return
    }

    setIsSubmitting(true)

    const ext = file.name.split('.').pop()?.toLowerCase() || 'bin'
    const path = `${organizer.id}/id-${Date.now()}.${ext}`

    const { error: uploadError } = await supabase.storage
      .from('organizer-verification')
      .upload(path, file, { upsert: false, contentType: file.type })

    if (uploadError) {
      setIsSubmitting(false)
      setErrorMessage(`Upload failed: ${uploadError.message}`)
      return
    }

    const { error: rpcError } = await supabase.rpc(
      'submit_organizer_verification',
      { p_phone: phone.trim(), p_id_document_url: path },
    )

    setIsSubmitting(false)

    if (rpcError) {
      setErrorMessage(rpcError.message)
      return
    }

    setSuccessMessage('Submitted for review. We usually respond within 48 hours.')
    setFile(null)
    router.refresh()
  }

  const trackRecordPercent = Math.min(100, (publishedRecentCount / 2) * 100)

  return (
    <>
      <LandingNavbar />
      <main className="min-h-screen bg-ink-950 px-6 pb-24 pt-24 text-white">
        <div className="mx-auto max-w-2xl">
          <Link
            href="/organizer"
            className="inline-flex items-center gap-1.5 text-sm text-white/55 transition hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to organizer dashboard
          </Link>

          <div className="mt-6 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04]">
              <ShieldCheck className="h-5 w-5 text-flame-400" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">Verification</h1>
              <p className="mt-0.5 text-sm text-white/45">
                {organizer.display_name}
              </p>
            </div>
          </div>

          {/* Current tier card */}
          <div className="mt-10 rounded-3xl border border-white/10 bg-white/[0.03] p-6">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-white/45">
              Current status
            </div>
            <div className="mt-3 flex items-center gap-3">
              {tier === 'verified' ? (
                <BadgeCheck className="h-7 w-7 text-flame-400" />
              ) : tier === 'established' ? (
                <CheckCircle2 className="h-7 w-7 text-emerald-400" />
              ) : (
                <Clock className="h-7 w-7 text-white/45" />
              )}
              <div>
                <p className="text-2xl font-bold">{TIER_LABEL[tier]}</p>
                <p className="mt-0.5 text-sm text-white/55">
                  {TIER_DESCRIPTION[tier]}
                </p>
              </div>
            </div>
          </div>

          {/* Auto-promote progress */}
          {tier === 'unverified' && (
            <div className="mt-4 rounded-3xl border border-white/10 bg-white/[0.03] p-6">
              <h2 className="text-base font-semibold text-white">
                Path 1 — Earn Established status
              </h2>
              <p className="mt-1 text-sm text-white/55">
                Get 2 events approved by an admin within 90 days and your
                future events publish instantly. No paperwork.
              </p>
              <div className="mt-5 flex items-center justify-between text-xs text-white/55">
                <span>Approved events in the last 90 days</span>
                <span className="font-semibold text-white">
                  {publishedRecentCount} / 2
                </span>
              </div>
              <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-emerald-400 transition-all"
                  style={{ width: `${trackRecordPercent}%` }}
                />
              </div>
            </div>
          )}

          {/* Manual verification — visible to unverified + established (so
              established users can still upgrade to Verified for the public badge) */}
          {(tier === 'unverified' || tier === 'established') && (
            <div className="mt-4 rounded-3xl border border-white/10 bg-white/[0.03] p-6">
              <h2 className="text-base font-semibold text-white">
                Path 2 — Apply for Verified status
              </h2>
              <p className="mt-1 text-sm text-white/55">
                Submit a phone number and a valid ID document. After admin
                review, your events publish instantly and your profile shows a
                public Verified badge.
              </p>

              {idStatus === 'pending' ? (
                <div className="mt-6 flex items-start gap-3 rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4 text-sm text-amber-100">
                  <Clock className="mt-0.5 h-4 w-4 flex-shrink-0" />
                  <div>
                    <p className="font-semibold">Under review</p>
                    <p className="mt-1 text-amber-100/80">
                      We&apos;re reviewing your submission. You&apos;ll be
                      notified by email when there&apos;s an update.
                    </p>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                  {idStatus === 'rejected' && (
                    <div className="flex items-start gap-2 rounded-2xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-200">
                      <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                      <div>
                        <p className="font-semibold">Previous submission was rejected.</p>
                        {organizer.id_review_notes && (
                          <p className="mt-1 whitespace-pre-line text-red-200/80">
                            {organizer.id_review_notes}
                          </p>
                        )}
                        <p className="mt-1 text-red-200/80">
                          You can submit again below.
                        </p>
                      </div>
                    </div>
                  )}

                  <label className="block">
                    <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-white/55">
                      Phone number
                    </span>
                    <div className="relative">
                      <Phone className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
                      <input
                        required
                        type="tel"
                        autoComplete="tel"
                        placeholder="+355 69 123 4567"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        className="h-12 w-full rounded-2xl border border-white/10 bg-white/[0.04] pl-11 pr-4 text-sm outline-none transition placeholder:text-white/30 focus:border-flame-500/40 focus:ring-2 focus:ring-flame-500/20"
                      />
                    </div>
                  </label>

                  <label className="block">
                    <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-white/55">
                      ID document
                    </span>
                    <p className="mb-2 text-xs text-white/45">
                      Passport, national ID, or business registration. PNG, JPG,
                      or PDF. Max 8 MB.
                    </p>
                    <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-dashed border-white/15 bg-white/[0.02] p-4 text-sm text-white/65 transition hover:border-white/25 hover:bg-white/[0.04]">
                      <Upload className="h-4 w-4 text-white/45" />
                      <span className="truncate">
                        {file ? file.name : 'Click to attach a file'}
                      </span>
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/jpg,application/pdf"
                        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                        className="hidden"
                      />
                    </label>
                  </label>

                  {errorMessage && (
                    <div className="flex items-start gap-2 rounded-2xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-200">
                      <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                      <span>{errorMessage}</span>
                    </div>
                  )}

                  {successMessage && (
                    <div className="flex items-start gap-2 rounded-2xl border border-green-500/20 bg-green-500/10 p-3 text-sm text-green-200">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0" />
                      <span>{successMessage}</span>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-flame-500 text-sm font-semibold shadow-[0_12px_30px_-12px_rgba(238,28,37,0.6)] transition hover:bg-flame-400 disabled:opacity-60"
                  >
                    {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                    {isSubmitting ? 'Submitting...' : 'Submit for review'}
                  </button>
                </form>
              )}
            </div>
          )}

          {tier === 'verified' && (
            <div className="mt-4 rounded-3xl border border-flame-500/20 bg-flame-500/[0.06] p-6">
              <div className="flex items-center gap-2">
                <BadgeCheck className="h-5 w-5 text-flame-400" />
                <h2 className="text-base font-semibold text-white">
                  You&apos;re fully verified
                </h2>
              </div>
              <p className="mt-2 text-sm text-white/65">
                Events you create are published instantly and your profile shows
                a Verified badge to attendees. Weekly limit:{' '}
                <strong className="text-white">
                  {organizer.weekly_event_quota} events
                </strong>
                .
              </p>
            </div>
          )}
        </div>
      </main>
    </>
  )
}
