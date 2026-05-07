'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Calendar, Clock3, MapPin, Send } from 'lucide-react'
import LandingNavbar from '@/components/layout/LandingNavbar'
import { useLanguage } from '@/lib/i18n/LanguageProvider'
import { createClient } from '@/lib/supabase/client'
import { getLocationBySlug, locations } from '@/lib/locations'

const categories = ['nightlife', 'music', 'sports', 'culture', 'food']

export default function SubmitEventPage() {
  const { t } = useLanguage()
  const supabase = createClient()
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setIsSubmitting(true)
    setSubmitError(null)

    const formData = new FormData(event.currentTarget)
    const locationSlug = String(formData.get('locationSlug'))
    const selectedLocation = getLocationBySlug(locationSlug)

    const submission = {
      title: String(formData.get('title')),
      venue_name: String(formData.get('venueName')),
      date: String(formData.get('date')),
      time: String(formData.get('time')),
      category: String(formData.get('category')),
      contact_email: String(formData.get('contactEmail')),
      description: String(formData.get('description')),
      country: selectedLocation.country,
      region: selectedLocation.region ?? null,
      location_slug: selectedLocation.slug,
      status: 'pending',
    }

    const { error } = await supabase.from('event_submissions').insert(submission)

    setIsSubmitting(false)

    if (error) {
      setSubmitError(error.message)
      return
    }

    setIsSubmitted(true)
  }

  return (
    <main className="min-h-screen bg-[#070b14] text-white">
      <LandingNavbar />

      <section className="relative overflow-hidden px-4 pb-20 pt-32">
        <div className="relative z-10 mx-auto max-w-3xl">
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-medium text-white/75 transition hover:bg-white/[0.08] hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Link>

          <div className="mt-8">
            <div className="inline-flex items-center gap-2 rounded-full border border-blue-500/20 bg-blue-500/10 px-4 py-2 text-sm text-blue-400">
              <Send className="h-4 w-4" />
              {t('submit_event_badge')}
            </div>

            <h1 className="mt-6 text-4xl font-bold tracking-tight text-white sm:text-5xl">
              {t('submit_event_title')}
            </h1>

            <p className="mt-4 max-w-2xl text-base leading-7 text-white/55 sm:text-lg">
              {t('submit_event_description')}
            </p>
          </div>

          <div className="mt-10 rounded-[32px] border border-white/10 bg-white/[0.03] p-5 shadow-[0_20px_60px_rgba(0,0,0,0.35)] backdrop-blur-xl sm:p-6">
            {isSubmitted ? (
              <div className="py-10 text-center">
                <h2 className="mt-6 text-2xl font-bold text-white">
                  {t('event_submitted_title')}
                </h2>

                <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-white/60">
                  {t('event_submitted_message')}
                </p>

                <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
                  <button
                    type="button"
                    onClick={() => {
                      setIsSubmitted(false)
                      setSubmitError(null)
                    }}
                    className="rounded-full border border-white/10 bg-white/[0.04] px-5 py-3 text-sm font-semibold text-white/80 transition hover:bg-white/[0.08]"
                  >
                    {t('submit_another')}
                  </button>

                  <Link
                    href="/map"
                    className="rounded-full bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-500"
                  >
                    {t('open_map')}
                  </Link>
                </div>
              </div>
            ) : (
              <form className="space-y-5" onSubmit={handleSubmit}>
                <div>
                  <label className="text-sm font-medium text-white/75">
                    Location
                  </label>

                  <select
                    required
                    name="locationSlug"
                    defaultValue="tirana"
                    className="mt-2 h-12 w-full rounded-2xl border border-white/10 bg-[#0b1020] px-4 text-sm text-white outline-none focus:border-white/20"
                  >
                    {locations.map((location) => (
                      <option key={location.slug} value={location.slug}>
                        {location.label} · {location.country}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-sm font-medium text-white/75">
                    {t('event_title_label')}
                  </label>
                  <input
                    required
                    name="title"
                    type="text"
                    placeholder={t('event_title_placeholder')}
                    className="mt-2 h-12 w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 text-sm text-white outline-none placeholder:text-white/35 focus:border-white/20 focus:bg-white/[0.06]"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-white/75">
                    {t('venue_label')}
                  </label>
                  <div className="relative mt-2">
                    <MapPin className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
                    <input
                      required
                      name="venueName"
                      type="text"
                      placeholder={t('venue_placeholder')}
                      className="h-12 w-full rounded-2xl border border-white/10 bg-white/[0.04] pl-11 pr-4 text-sm text-white outline-none placeholder:text-white/35 focus:border-white/20 focus:bg-white/[0.06]"
                    />
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="text-sm font-medium text-white/75">
                      {t('date_label')}
                    </label>
                    <div className="relative mt-2">
                      <Calendar className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
                      <input
                        required
                        name="date"
                        type="date"
                        className="h-12 w-full rounded-2xl border border-white/10 bg-white/[0.04] pl-11 pr-4 text-sm text-white outline-none focus:border-white/20 focus:bg-white/[0.06]"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-white/75">
                      {t('time_label')}
                    </label>
                    <div className="relative mt-2">
                      <Clock3 className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
                      <input
                        required
                        name="time"
                        type="time"
                        className="h-12 w-full rounded-2xl border border-white/10 bg-white/[0.04] pl-11 pr-4 text-sm text-white outline-none focus:border-white/20 focus:bg-white/[0.06]"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium text-white/75">
                    {t('category_label')}
                  </label>
                  <select
                    required
                    name="category"
                    className="mt-2 h-12 w-full rounded-2xl border border-white/10 bg-[#0b1020] px-4 text-sm text-white outline-none focus:border-white/20"
                  >
                    <option value="">{t('choose_category')}</option>
                    {categories.map((category) => (
                      <option key={category} value={category}>
                        {t(`category_${category}`)}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-sm font-medium text-white/75">
                    {t('contact_email_label')}
                  </label>
                  <input
                    required
                    name="contactEmail"
                    type="email"
                    placeholder="you@example.com"
                    className="mt-2 h-12 w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 text-sm text-white outline-none placeholder:text-white/35 focus:border-white/20 focus:bg-white/[0.06]"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-white/75">
                    {t('description_label')}
                  </label>
                  <textarea
                    required
                    name="description"
                    rows={5}
                    placeholder={t('description_placeholder')}
                    className="mt-2 w-full resize-none rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm leading-6 text-white outline-none placeholder:text-white/35 focus:border-white/20 focus:bg-white/[0.06]"
                  />
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-sm leading-6 text-white/55">
                  {t('submit_note')}
                </div>

                {submitError && (
                  <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm leading-6 text-red-200">
                    {submitError}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 px-5 py-4 text-sm font-semibold text-white shadow-[0_12px_40px_rgba(37,99,235,0.35)] transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSubmitting ? 'Submitting...' : t('submit_event')}
                  <Send className="h-4 w-4" />
                </button>
              </form>
            )}
          </div>
        </div>
      </section>
    </main>
  )
}