'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import LandingNavbar from '@/components/layout/LandingNavbar'
import { createClient } from '@/lib/supabase/browser'
import { createOrganizer } from '@/lib/organizers'
import {
  EVENT_TYPE_OPTIONS,
  AGE_RANGE_OPTIONS,
  ATTENDANCE_SIZE_OPTIONS,
  YEARLY_REVENUE_OPTIONS,
  EVENTS_PER_YEAR_OPTIONS,
  type CreateOrganizerInput,
} from '@/types/organizer'

const STEP_LABELS = ['Your profile', 'About your events', 'Confirm']

export default function OnboardingClient({ email }: { email: string }) {
  const router = useRouter()

  const [step, setStep] = useState(1)
  const [form, setForm] = useState<CreateOrganizerInput>({
    displayName: '',
    contactEmail: email,
    websiteUrl: '',
    eventTypes: [],
    attendeeAgeRanges: [],
    expectedAttendanceSize: '',
    expectedYearlyRevenue: '',
    eventsPerYear: '',
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  function patch(update: Partial<CreateOrganizerInput>) {
    setForm(f => ({ ...f, ...update }))
  }

  function toggleMulti(field: 'eventTypes' | 'attendeeAgeRanges', value: string) {
    setForm(f => ({
      ...f,
      [field]: f[field].includes(value)
        ? f[field].filter(v => v !== value)
        : [...f[field], value],
    }))
  }

  function toggleSingle(
    field: 'expectedAttendanceSize' | 'expectedYearlyRevenue' | 'eventsPerYear',
    value: string
  ) {
    setForm(f => ({ ...f, [field]: f[field] === value ? '' : value }))
  }

  async function handleSubmit() {
    setIsSubmitting(true)
    setSubmitError(null)
    const { error } = await createOrganizer(createClient(), form)
    if (error) {
      setSubmitError(error)
      setIsSubmitting(false)
      return
    }
    router.replace('/organizer')
  }

  const step1Valid =
    form.displayName.trim().length > 0 && form.contactEmail.trim().length > 0

  // Shared chip class builder
  function chip(active: boolean) {
    return `rounded-full border px-3.5 py-1.5 text-sm transition ${
      active
        ? 'border-blue-500/50 bg-blue-500/15 text-blue-300'
        : 'border-white/10 bg-white/[0.03] text-white/60 hover:border-white/20 hover:text-white/80'
    }`
  }

  return (
    <>
      <LandingNavbar />
      <main className="min-h-screen bg-[#070b14] px-6 pb-20 pt-24 text-white">
        <div className="mx-auto max-w-lg">

          {/* Progress */}
          <div className="pb-8 pt-6">
            <p className="mb-3 text-xs text-white/40">
              Step {step} of 3 — {STEP_LABELS[step - 1]}
            </p>
            <div className="flex gap-1.5">
              {[1, 2, 3].map(n => (
                <div
                  key={n}
                  className={`h-1 flex-1 rounded-full transition-colors duration-300 ${
                    n <= step ? 'bg-blue-500' : 'bg-white/10'
                  }`}
                />
              ))}
            </div>
          </div>

          {/* ── Step 1: Profile ── */}
          {step === 1 && (
            <div className="space-y-6">
              <div>
                <h1 className="text-3xl font-bold">Create your organizer profile</h1>
                <p className="mt-2 text-sm text-white/50">
                  This is how you&apos;ll appear on AlbaGo.
                </p>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-white/50">
                    Display name <span className="text-blue-400">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Tirana Nights, Club XYZ"
                    value={form.displayName}
                    onChange={e => patch({ displayName: e.target.value })}
                    maxLength={60}
                    className="h-12 w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 text-sm outline-none placeholder:text-white/25 focus:border-blue-500/40"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-medium text-white/50">
                    Contact email <span className="text-blue-400">*</span>
                  </label>
                  <input
                    type="email"
                    placeholder="you@example.com"
                    value={form.contactEmail}
                    onChange={e => patch({ contactEmail: e.target.value })}
                    className="h-12 w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 text-sm outline-none placeholder:text-white/25 focus:border-blue-500/40"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-medium text-white/50">
                    Website{' '}
                    <span className="text-white/30">(optional)</span>
                  </label>
                  <input
                    type="text"
                    placeholder="https://yoursite.com"
                    value={form.websiteUrl}
                    onChange={e => patch({ websiteUrl: e.target.value })}
                    className="h-12 w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 text-sm outline-none placeholder:text-white/25 focus:border-blue-500/40"
                  />
                </div>
              </div>

              <button
                disabled={!step1Valid}
                onClick={() => setStep(2)}
                className="h-12 w-full rounded-2xl bg-blue-600 text-sm font-semibold transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Next
              </button>
            </div>
          )}

          {/* ── Step 2: Survey ── */}
          {step === 2 && (
            <div className="space-y-7">
              <div>
                <h1 className="text-3xl font-bold">About your events</h1>
                <p className="mt-2 text-sm text-white/50">
                  Help us understand your events. All optional — skip anything that doesn&apos;t apply.
                </p>
              </div>

              <div>
                <p className="mb-2.5 text-xs font-medium text-white/50">
                  What types of events do you organise?
                </p>
                <div className="flex flex-wrap gap-2">
                  {EVENT_TYPE_OPTIONS.map(opt => (
                    <button
                      key={opt}
                      onClick={() => toggleMulti('eventTypes', opt)}
                      className={chip(form.eventTypes.includes(opt))}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="mb-2.5 text-xs font-medium text-white/50">
                  Typical attendee age range
                </p>
                <div className="flex flex-wrap gap-2">
                  {AGE_RANGE_OPTIONS.map(opt => (
                    <button
                      key={opt}
                      onClick={() => toggleMulti('attendeeAgeRanges', opt)}
                      className={chip(form.attendeeAgeRanges.includes(opt))}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="mb-2.5 text-xs font-medium text-white/50">
                  Expected attendance per event
                </p>
                <div className="flex flex-wrap gap-2">
                  {ATTENDANCE_SIZE_OPTIONS.map(opt => (
                    <button
                      key={opt}
                      onClick={() => toggleSingle('expectedAttendanceSize', opt)}
                      className={chip(form.expectedAttendanceSize === opt)}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="mb-2.5 text-xs font-medium text-white/50">
                  Expected yearly revenue
                </p>
                <div className="flex flex-wrap gap-2">
                  {YEARLY_REVENUE_OPTIONS.map(opt => (
                    <button
                      key={opt}
                      onClick={() => toggleSingle('expectedYearlyRevenue', opt)}
                      className={chip(form.expectedYearlyRevenue === opt)}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="mb-2.5 text-xs font-medium text-white/50">
                  Events per year
                </p>
                <div className="flex flex-wrap gap-2">
                  {EVENTS_PER_YEAR_OPTIONS.map(opt => (
                    <button
                      key={opt}
                      onClick={() => toggleSingle('eventsPerYear', opt)}
                      className={chip(form.eventsPerYear === opt)}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setStep(1)}
                  className="h-12 flex-1 rounded-2xl border border-white/10 bg-white/[0.03] text-sm font-semibold text-white/70 transition hover:bg-white/[0.06]"
                >
                  Back
                </button>
                <button
                  onClick={() => setStep(3)}
                  className="h-12 flex-[2] rounded-2xl bg-blue-600 text-sm font-semibold transition hover:bg-blue-500"
                >
                  Next
                </button>
              </div>
            </div>
          )}

          {/* ── Step 3: Confirm ── */}
          {step === 3 && (
            <div className="space-y-6">
              <div>
                <h1 className="text-3xl font-bold">Looks good?</h1>
                <p className="mt-2 text-sm text-white/50">
                  Review your details and create your organizer account.
                </p>
              </div>

              <div className="divide-y divide-white/[0.06] rounded-3xl border border-white/10 bg-white/[0.03] px-5 py-4">
                <div className="pb-3">
                  <p className="text-xs text-white/40">Display name</p>
                  <p className="mt-0.5 font-semibold">{form.displayName}</p>
                </div>
                <div className="py-3">
                  <p className="text-xs text-white/40">Contact email</p>
                  <p className="mt-0.5 text-sm text-white/80">{form.contactEmail}</p>
                </div>
                {form.websiteUrl && (
                  <div className="py-3">
                    <p className="text-xs text-white/40">Website</p>
                    <p className="mt-0.5 text-sm text-white/80">{form.websiteUrl}</p>
                  </div>
                )}
                {form.eventTypes.length > 0 && (
                  <div className="pt-3">
                    <p className="text-xs text-white/40">Event types</p>
                    <p className="mt-0.5 text-sm text-white/80">
                      {form.eventTypes.join(', ')}
                    </p>
                  </div>
                )}
              </div>

              {submitError && (
                <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-200">
                  {submitError}
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => setStep(2)}
                  disabled={isSubmitting}
                  className="h-12 flex-1 rounded-2xl border border-white/10 bg-white/[0.03] text-sm font-semibold text-white/70 transition hover:bg-white/[0.06] disabled:opacity-40"
                >
                  Back
                </button>
                <button
                  disabled={isSubmitting}
                  onClick={handleSubmit}
                  className="h-12 flex-[2] rounded-2xl bg-blue-600 text-sm font-semibold transition hover:bg-blue-500 disabled:opacity-60"
                >
                  {isSubmitting ? 'Creating account…' : 'Get started'}
                </button>
              </div>
            </div>
          )}

        </div>
      </main>
    </>
  )
}
