'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft,
  Banknote,
  Calendar,
  Check,
  Clock3,
  Flame,
  MapPin,
  MessageCircle,
  Send,
  Shield,
  Users,
  X,
} from 'lucide-react'
import LandingNavbar from '@/components/layout/LandingNavbar'
import { useLanguage } from '@/lib/i18n/LanguageProvider'
import { createClient } from '@/lib/supabase/browser'
import { getLocationBySlug } from '@/lib/locations'
import { useLocations } from '@/lib/useLocations'
import type { User } from '@supabase/supabase-js'

const categories = ['nightlife', 'music', 'sports', 'culture', 'food', 'civic']

type VenueOption = {
  id: string
  name: string
  category: string
}

type CivicResolved = {
  lat: number
  lng: number
  city: string
  country: string
  displayName: string
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '')
}

export default function SubmitEventPage() {
  const { t } = useLanguage()
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const locationOptions = useLocations()

  const [user, setUser] = useState<User | null>(null)
  const [isAuthLoading, setIsAuthLoading] = useState(true)
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const [locationSlug, setLocationSlug] = useState('tirana')
  const [venues, setVenues] = useState<VenueOption[]>([])
  const [venueQuery, setVenueQuery] = useState('')
  const [selectedVenue, setSelectedVenue] = useState<VenueOption | null>(null)
  const [isVenueOpen, setIsVenueOpen] = useState(false)

  const [category, setCategory] = useState('')
  const isCivic = category === 'civic'

  const [civicAddress, setCivicAddress] = useState('')
  const [civicResolved, setCivicResolved] = useState<CivicResolved | null>(null)
  const [civicGeocoding, setCivicGeocoding] = useState(false)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        router.replace('/sign-in?next=/submit-event')
        return
      }
      setUser(user)
      setIsAuthLoading(false)
    })
  }, [supabase, router])

  useEffect(() => {
    setSelectedVenue(null)
    setVenueQuery('')
    supabase
      .from('places')
      .select('id, name, category')
      .eq('location_slug', locationSlug)
      .order('name', { ascending: true })
      .then(({ data }) => setVenues(data ?? []))
  }, [locationSlug, supabase])

  // Civic mode: debounced Nominatim geocoding for the "Where will it happen?"
  // address field. Resolves to lat/lng + city + country so the submission can
  // carry coordinates straight into the events row on approval.
  useEffect(() => {
    if (!isCivic) {
      setCivicResolved(null)
      setCivicGeocoding(false)
      return
    }
    const q = civicAddress.trim()
    if (q.length < 3) {
      setCivicResolved(null)
      setCivicGeocoding(false)
      return
    }
    setCivicGeocoding(true)
    const ctrl = new AbortController()
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1&addressdetails=1`,
          { signal: ctrl.signal, headers: { Accept: 'application/json' } },
        )
        if (!res.ok) {
          setCivicResolved(null)
          return
        }
        const data = (await res.json()) as Array<{
          lat: string
          lon: string
          display_name: string
          address?: {
            city?: string
            town?: string
            village?: string
            municipality?: string
            country?: string
          }
        }>
        if (Array.isArray(data) && data[0]) {
          const a = data[0].address ?? {}
          const city = a.city || a.town || a.village || a.municipality || ''
          const country = a.country || ''
          setCivicResolved({
            lat: parseFloat(data[0].lat),
            lng: parseFloat(data[0].lon),
            city,
            country,
            displayName: data[0].display_name,
          })
        } else {
          setCivicResolved(null)
        }
      } catch {
        // aborted or network error — silent
      } finally {
        setCivicGeocoding(false)
      }
    }, 600)
    return () => {
      clearTimeout(timer)
      ctrl.abort()
    }
  }, [civicAddress, isCivic])

  const matchingVenues = useMemo(() => {
    const q = venueQuery.trim().toLowerCase()
    if (!q) return venues.slice(0, 6)
    return venues.filter((v) => v.name.toLowerCase().includes(q)).slice(0, 6)
  }, [venues, venueQuery])

  const handleVenueSelect = (venue: VenueOption) => {
    setSelectedVenue(venue)
    setVenueQuery(venue.name)
    setIsVenueOpen(false)
  }

  const handleVenueClear = () => {
    setSelectedVenue(null)
    setVenueQuery('')
    setIsVenueOpen(false)
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!user) return

    const formData = new FormData(e.currentTarget)
    const categoryValue = String(formData.get('category') || '')

    let submission: Record<string, unknown>

    if (categoryValue === 'civic') {
      const addr = civicAddress.trim()
      if (!addr) {
        setSubmitError('Please describe where the gathering will happen.')
        return
      }
      if (!civicResolved) {
        setSubmitError(
          'We could not find that location on the map. Try a more specific address (e.g. "Trafalgar Square, London").',
        )
        return
      }
      const expectedAttendeesRaw = String(formData.get('expectedAttendees') || '').trim()
      const expectedAttendees = expectedAttendeesRaw
        ? Math.max(0, Math.min(5_000_000, parseInt(expectedAttendeesRaw, 10) || 0))
        : null
      const movementSlug = String(formData.get('movementSlug') || '').trim() || null
      const telegramLink = String(formData.get('telegramLink') || '').trim() || null
      const whatsappLink = String(formData.get('whatsappLink') || '').trim() || null
      const safetyNotes = String(formData.get('safetyNotes') || '').trim() || null

      const venueName =
        civicResolved.displayName.split(',')[0]?.trim() || addr.split(',')[0]?.trim() || addr
      const citySlug = slugify(civicResolved.city || venueName) || 'unknown'

      setIsSubmitting(true)
      setSubmitError(null)
      submission = {
        title: String(formData.get('title')),
        venue_name: venueName,
        place_id: null,
        date: String(formData.get('date')),
        time: String(formData.get('time')),
        category: 'civic',
        price: String(formData.get('price') || 'Free') || null,
        contact_email: String(formData.get('contactEmail')),
        description: String(formData.get('description')),
        country: civicResolved.country || 'Unknown',
        region: null,
        location_slug: citySlug,
        status: 'pending',
        submitted_by_user_id: user.id,
        // Civic columns (Phase 8.3)
        event_type: 'protest',
        is_civic: true,
        featured_movement_slug: movementSlug,
        organizer_contact: String(formData.get('contactEmail')) || null,
        telegram_link: telegramLink,
        whatsapp_link: whatsappLink,
        safety_notes: safetyNotes,
        expected_attendees: expectedAttendees,
        lat: civicResolved.lat,
        lng: civicResolved.lng,
      }
    } else {
      const venueName = selectedVenue ? selectedVenue.name : venueQuery.trim()
      if (!venueName) {
        setSubmitError('Please enter or select a venue name.')
        return
      }
      setIsSubmitting(true)
      setSubmitError(null)
      const selectedLocation = getLocationBySlug(locationSlug)
      submission = {
        title: String(formData.get('title')),
        venue_name: venueName,
        place_id: selectedVenue?.id ?? null,
        date: String(formData.get('date')),
        time: String(formData.get('time')),
        category: categoryValue,
        price: String(formData.get('price')) || null,
        contact_email: String(formData.get('contactEmail')),
        description: String(formData.get('description')),
        country: selectedLocation.country,
        region: selectedLocation.region ?? null,
        location_slug: selectedLocation.slug,
        status: 'pending',
        submitted_by_user_id: user.id,
      }
    }

    const { error } = await supabase.from('event_submissions').insert(submission)

    setIsSubmitting(false)

    if (error) {
      // If Phase 8.3 migration isn't applied, civic columns will be rejected.
      const isCivicColumnError =
        categoryValue === 'civic' &&
        /column .* does not exist/i.test(error.message)
      if (isCivicColumnError) {
        setSubmitError(
          'Civic submissions need the Phase 8.3 migration (docs/seeds/phase-8.3-civic-submissions.sql). Apply it in Supabase and try again.',
        )
      } else {
        setSubmitError(error.message)
      }
      return
    }

    setIsSubmitted(true)
  }

  if (isAuthLoading) {
    return (
      <main className="min-h-screen bg-ink-950 text-white">
        <LandingNavbar />
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-ink-950 text-white">
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
            <div className="inline-flex items-center gap-2 rounded-full border border-flame-500/30 bg-flame-500/10 px-4 py-2 text-sm text-flame-400">
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
                      setVenueQuery('')
                      setSelectedVenue(null)
                    }}
                    className="rounded-full border border-white/10 bg-white/[0.04] px-5 py-3 text-sm font-semibold text-white/80 transition hover:bg-white/[0.08]"
                  >
                    {t('submit_another')}
                  </button>

                  <Link
                    href="/dashboard"
                    className="rounded-full bg-flame-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-flame-400"
                  >
                    View my submissions
                  </Link>
                </div>
              </div>
            ) : (
              <form className="space-y-5" onSubmit={handleSubmit}>
                {!isCivic && (
                  <div>
                    <label className="text-sm font-medium text-white/75">
                      Location
                    </label>

                    <select
                      required={!isCivic}
                      value={locationSlug}
                      onChange={(e) => setLocationSlug(e.target.value)}
                      className="mt-2 h-12 w-full rounded-2xl border border-white/10 bg-ink-900 px-4 text-sm text-white outline-none focus:border-white/20"
                    >
                      {locationOptions.map((location) => (
                        <option key={location.slug} value={location.slug}>
                          {location.label} Â· {location.country}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

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

                {isCivic && (
                  <div>
                    <label className="text-sm font-medium text-white/75">
                      {t('submit_civic_address_label')}
                    </label>
                    <div className="relative mt-2">
                      <MapPin className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
                      <input
                        type="text"
                        value={civicAddress}
                        onChange={(e) => setCivicAddress(e.target.value)}
                        placeholder={t('submit_civic_address_placeholder')}
                        className="h-12 w-full rounded-2xl border border-white/10 bg-white/[0.04] pl-11 pr-10 text-sm text-white outline-none placeholder:text-white/35 focus:border-white/20 focus:bg-white/[0.06]"
                      />
                      {civicGeocoding && (
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 animate-spin rounded-full border-2 border-flame-500/30 border-t-flame-500" />
                      )}
                    </div>
                    {civicResolved ? (
                      <div className="mt-2 flex items-start gap-2 rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.06] px-3 py-2 text-xs text-emerald-200">
                        <Check className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                        <div>
                          <p className="font-medium text-white">
                            {civicResolved.city || civicResolved.displayName.split(',')[0]?.trim()}
                            {civicResolved.country && `, ${civicResolved.country}`}
                          </p>
                          <p className="font-mono text-[10px] text-white/55">
                            {civicResolved.lat.toFixed(4)}, {civicResolved.lng.toFixed(4)}
                          </p>
                        </div>
                      </div>
                    ) : civicAddress.trim().length >= 3 && !civicGeocoding ? (
                      <p className="mt-2 text-xs text-flame-300">
                        {t('submit_civic_no_match')}
                      </p>
                    ) : (
                      <p className="mt-2 text-xs text-white/45">
                        {t('submit_civic_address_placeholder')}
                      </p>
                    )}
                  </div>
                )}

                {!isCivic && (
                <div>
                  <label className="text-sm font-medium text-white/75">
                    {t('venue_label')}
                  </label>

                  <div className="relative mt-2">
                    <MapPin className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />

                    <input
                      type="text"
                      value={venueQuery}
                      onChange={(e) => {
                        setVenueQuery(e.target.value)
                        setSelectedVenue(null)
                        setIsVenueOpen(true)
                      }}
                      onFocus={() => setIsVenueOpen(true)}
                      onBlur={() => setTimeout(() => setIsVenueOpen(false), 150)}
                      placeholder={t('venue_placeholder')}
                      className="h-12 w-full rounded-2xl border border-white/10 bg-white/[0.04] pl-11 pr-10 text-sm text-white outline-none placeholder:text-white/35 focus:border-white/20 focus:bg-white/[0.06]"
                    />

                    {venueQuery && (
                      <button
                        type="button"
                        onClick={handleVenueClear}
                        className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-white/40 transition hover:text-white/70"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}

                    {isVenueOpen && matchingVenues.length > 0 && (
                      <div className="absolute left-0 right-0 top-[calc(100%+0.4rem)] z-20 overflow-hidden rounded-2xl border border-white/10 bg-ink-900 shadow-2xl">
                        {matchingVenues.map((venue) => (
                          <button
                            key={venue.id}
                            type="button"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => handleVenueSelect(venue)}
                            className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm transition hover:bg-white/[0.06]"
                          >
                            <MapPin className="h-4 w-4 shrink-0 text-white/35" />
                            <span>
                              <span className="block font-medium text-white">
                                {venue.name}
                              </span>
                              <span className="block text-xs capitalize text-white/45">
                                {venue.category}
                              </span>
                            </span>
                          </button>
                        ))}

                        {venueQuery.trim() && matchingVenues.every(
                          (v) => v.name.toLowerCase() !== venueQuery.trim().toLowerCase()
                        ) && (
                          <div className="border-t border-white/10 px-4 py-3 text-xs text-white/40">
                            No exact match â€” this will be submitted as a new venue
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {selectedVenue && (
                    <div className="mt-2 inline-flex items-center gap-2 rounded-full border border-green-500/20 bg-green-500/10 px-3 py-1 text-xs font-medium text-green-400">
                      <Check className="h-3.5 w-3.5" />
                      Linked to existing venue
                    </div>
                  )}
                </div>
                )}

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
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="mt-2 h-12 w-full rounded-2xl border border-white/10 bg-ink-900 px-4 text-sm text-white outline-none focus:border-white/20"
                  >
                    <option value="">{t('choose_category')}</option>
                    {categories.map((cat) => (
                      <option key={cat} value={cat}>
                        {t(`category_${cat}`)}
                      </option>
                    ))}
                  </select>
                  {isCivic && (
                    <p className="mt-2 inline-flex items-center gap-1.5 text-xs text-flame-300">
                      <Flame className="h-3.5 w-3.5" />
                      Civic gathering — peaceful and lawful only. Goes to /protests after admin review.
                    </p>
                  )}
                </div>

                <div>
                  <label className="text-sm font-medium text-white/75">
                    Price <span className="text-white/35">(optional)</span>
                  </label>
                  <div className="relative mt-2">
                    <Banknote className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
                    <input
                      name="price"
                      type="text"
                      placeholder='e.g. Free Â· 500 ALL Â· â‚¬10'
                      className="h-12 w-full rounded-2xl border border-white/10 bg-white/[0.04] pl-11 pr-4 text-sm text-white outline-none placeholder:text-white/35 focus:border-white/20 focus:bg-white/[0.06]"
                    />
                  </div>
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

                {isCivic && (
                  <div className="rounded-2xl border border-flame-500/30 bg-flame-500/[0.04] p-5 space-y-4">
                    <div className="flex items-center gap-2">
                      <Flame className="h-4 w-4 text-flame-400" />
                      <h3 className="text-sm font-semibold text-white">
                        Civic gathering details
                      </h3>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <label className="text-sm font-medium text-white/75">
                          {t('submit_civic_telegram_label')}
                        </label>
                        <div className="relative mt-2">
                          <Send className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
                          <input
                            name="telegramLink"
                            type="url"
                            placeholder="https://t.me/+..."
                            className="h-12 w-full rounded-2xl border border-white/10 bg-white/[0.04] pl-11 pr-4 text-sm text-white outline-none placeholder:text-white/35 focus:border-white/20 focus:bg-white/[0.06]"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-white/75">
                          {t('submit_civic_whatsapp_label')}
                        </label>
                        <div className="relative mt-2">
                          <MessageCircle className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
                          <input
                            name="whatsappLink"
                            type="url"
                            placeholder="https://chat.whatsapp.com/..."
                            className="h-12 w-full rounded-2xl border border-white/10 bg-white/[0.04] pl-11 pr-4 text-sm text-white outline-none placeholder:text-white/35 focus:border-white/20 focus:bg-white/[0.06]"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <label className="text-sm font-medium text-white/75">
                          {t('submit_civic_expected_label')}
                        </label>
                        <div className="relative mt-2">
                          <Users className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
                          <input
                            name="expectedAttendees"
                            type="number"
                            min={0}
                            max={5_000_000}
                            placeholder="500"
                            className="h-12 w-full rounded-2xl border border-white/10 bg-white/[0.04] pl-11 pr-4 text-sm text-white outline-none placeholder:text-white/35 focus:border-white/20 focus:bg-white/[0.06]"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-white/75">
                          {t('submit_civic_movement_label')}
                        </label>
                        <input
                          name="movementSlug"
                          type="text"
                          placeholder={t('submit_civic_movement_hint')}
                          className="mt-2 h-12 w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 text-sm text-white outline-none placeholder:text-white/35 focus:border-white/20 focus:bg-white/[0.06]"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-sm font-medium text-white/75">
                        {t('submit_civic_safety_label')}
                      </label>
                      <div className="relative mt-2">
                        <Shield className="pointer-events-none absolute left-4 top-3 h-4 w-4 text-white/35" />
                        <textarea
                          name="safetyNotes"
                          rows={3}
                          placeholder={t('submit_civic_safety_placeholder')}
                          className="w-full resize-none rounded-2xl border border-white/10 bg-white/[0.04] pl-11 pr-4 py-3 text-sm leading-6 text-white outline-none placeholder:text-white/35 focus:border-white/20 focus:bg-white/[0.06]"
                        />
                      </div>
                    </div>

                    <p className="text-xs leading-5 text-white/55">
                      By submitting a civic gathering you confirm it is peaceful, lawful, and
                      family-friendly. AlbaGo will reject any submission promoting violence,
                      harassment, or illegal conduct.
                    </p>
                  </div>
                )}

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
                  className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-flame-500 px-5 py-4 text-sm font-semibold text-white shadow-[0_12px_40px_rgba(37,99,235,0.35)] transition hover:bg-flame-400 disabled:cursor-not-allowed disabled:opacity-60"
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
