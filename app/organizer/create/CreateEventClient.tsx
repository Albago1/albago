'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, CheckCircle2 } from 'lucide-react'
import LandingNavbar from '@/components/layout/LandingNavbar'
import { createClient } from '@/lib/supabase/browser'
import { createOrganizerEvent } from '@/lib/events-organizer'
import { locations, getLocationBySlug } from '@/lib/locations'

const CATEGORIES = [
  { value: 'nightlife', label: 'Nightlife' },
  { value: 'music', label: 'Music' },
  { value: 'sports', label: 'Sports' },
  { value: 'culture', label: 'Culture' },
  { value: 'food', label: 'Food & Drink' },
]

type FormState = {
  title: string
  category: string
  description: string
  date: string
  time: string
  location_slug: string
  price: string
}

const EMPTY: FormState = {
  title: '',
  category: '',
  description: '',
  date: '',
  time: '',
  location_slug: 'tirana',
  price: '',
}

const inputClass =
  'w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white placeholder-white/25 outline-none transition focus:border-white/25 focus:bg-white/[0.06]'

const labelClass = 'block text-xs font-semibold uppercase tracking-[0.14em] text-white/40'

export default function CreateEventClient() {
  const [form, setForm] = useState<FormState>(EMPTY)
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [createdId, setCreatedId] = useState<string | null>(null)

  function set(field: keyof FormState, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!form.title.trim()) return setError('Title is required.')
    if (!form.category) return setError('Category is required.')
    if (!form.description.trim()) return setError('Description is required.')
    if (!form.date) return setError('Date is required.')
    if (!form.location_slug) return setError('Location is required.')

    setIsSubmitting(true)

    const loc = getLocationBySlug(form.location_slug)
    const supabase = createClient()

    const { id, error: createError } = await createOrganizerEvent(supabase, {
      title: form.title.trim(),
      category: form.category,
      description: form.description.trim(),
      date: form.date,
      time: form.time.trim() || null,
      price: form.price.trim() || null,
      location_slug: form.location_slug,
      country: loc.country,
      region: loc.region ?? null,
      place_id: null,
    })

    setIsSubmitting(false)

    if (createError) {
      setError(createError)
      return
    }

    setCreatedId(id)
  }

  if (createdId) {
    return (
      <>
        <LandingNavbar />
        <main className="min-h-screen bg-[#070b14] px-6 pb-12 pt-24 text-white">
          <div className="mx-auto max-w-xl text-center">
            <div className="flex justify-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-3xl border border-blue-500/20 bg-blue-500/10">
                <CheckCircle2 className="h-8 w-8 text-blue-400" />
              </div>
            </div>
            <h1 className="mt-6 text-2xl font-bold">Draft saved</h1>
            <p className="mt-3 text-sm text-white/50">
              Your event has been saved as a draft. When you&apos;re ready,
              submit it for review from your organizer dashboard.
            </p>
            <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
              <Link
                href="/organizer"
                className="inline-flex items-center gap-2 rounded-full bg-blue-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-blue-500"
              >
                Go to my events
              </Link>
              <button
                onClick={() => { setCreatedId(null); setForm(EMPTY) }}
                className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-6 py-3 text-sm font-semibold text-white/70 transition hover:border-white/20 hover:text-white"
              >
                Create another
              </button>
            </div>
          </div>
        </main>
      </>
    )
  }

  return (
    <>
      <LandingNavbar />
      <main className="min-h-screen bg-[#070b14] px-6 pb-12 pt-24 text-white">
        <div className="mx-auto max-w-xl">

          {/* Back link */}
          <Link
            href="/organizer"
            className="inline-flex items-center gap-1.5 text-sm text-white/40 transition hover:text-white/70"
          >
            <ArrowLeft className="h-4 w-4" />
            My events
          </Link>

          <h1 className="mt-6 text-2xl font-bold">Create event</h1>
          <p className="mt-1 text-sm text-white/45">
            Fill in the details. Your event will be saved as a draft.
          </p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-5">

            {/* Title */}
            <div>
              <label className={labelClass}>Title *</label>
              <input
                type="text"
                value={form.title}
                onChange={(e) => set('title', e.target.value)}
                placeholder="e.g. Summer Beach Party"
                className={`mt-2 ${inputClass}`}
              />
            </div>

            {/* Category */}
            <div>
              <label className={labelClass}>Category *</label>
              <select
                value={form.category}
                onChange={(e) => set('category', e.target.value)}
                className={`mt-2 ${inputClass} cursor-pointer`}
              >
                <option value="" disabled>Choose a category</option>
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>

            {/* Description */}
            <div>
              <label className={labelClass}>Description *</label>
              <textarea
                value={form.description}
                onChange={(e) => set('description', e.target.value)}
                placeholder="Describe your event…"
                rows={4}
                className={`mt-2 resize-none ${inputClass}`}
              />
            </div>

            {/* Date + Time */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className={labelClass}>Date *</label>
                <input
                  type="date"
                  value={form.date}
                  onChange={(e) => set('date', e.target.value)}
                  className={`mt-2 ${inputClass}`}
                />
              </div>
              <div>
                <label className={labelClass}>Time</label>
                <input
                  type="text"
                  value={form.time}
                  onChange={(e) => set('time', e.target.value)}
                  placeholder="22:00"
                  className={`mt-2 ${inputClass}`}
                />
              </div>
            </div>

            {/* Location */}
            <div>
              <label className={labelClass}>Location *</label>
              <select
                value={form.location_slug}
                onChange={(e) => set('location_slug', e.target.value)}
                className={`mt-2 ${inputClass} cursor-pointer`}
              >
                {locations.map((loc) => (
                  <option key={loc.slug} value={loc.slug}>{loc.label}</option>
                ))}
              </select>
            </div>

            {/* Price */}
            <div>
              <label className={labelClass}>Price</label>
              <input
                type="text"
                value={form.price}
                onChange={(e) => set('price', e.target.value)}
                placeholder="Free  ·  €10  ·  500 ALL"
                className={`mt-2 ${inputClass}`}
              />
            </div>

            {/* Error */}
            {error && (
              <p className="rounded-2xl border border-red-500/15 bg-red-500/[0.07] px-4 py-3 text-sm text-red-300">
                {error}
              </p>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-full bg-blue-600 py-3 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSubmitting ? 'Saving…' : 'Save as draft'}
            </button>

          </form>
        </div>
      </main>
    </>
  )
}
