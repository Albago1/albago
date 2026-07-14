'use client'

import { useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AnimatePresence, motion } from 'framer-motion'
import {
  ArrowRight,
  Calendar,
  CalendarCheck,
  Camera,
  Check,
  Clock,
  ImagePlus,
  Info,
  Languages,
  Link as LinkIcon,
  MapPin,
  Music,
  RefreshCw,
  ScanLine,
  Sparkles,
  Ticket,
  Users,
} from 'lucide-react'
import { useLanguage } from '@/lib/i18n/LanguageProvider'
import { languageLocales } from '@/lib/i18n/config'
import { trackInteraction } from '@/lib/track'
import { defaultEventDraft, type EventDraft } from '@/types/eventDraft'
import type { PosterReading } from '@/lib/ai/posterReader'
import type { LensResolution, LensResolvedPlace } from '@/lib/lens/resolve'
import type { EventTranslation, LangKey } from '@/lib/ai/translateEvent'

const PREVIEW_LANGS: { key: LangKey; label: string }[] = [
  { key: 'sq', label: 'Shqip' },
  { key: 'en', label: 'English' },
  { key: 'de', label: 'Deutsch' },
  { key: 'es', label: 'Español' },
]

const DRAFT_STORAGE_KEY = 'albago:event-draft:v1'
const MAX_DIMENSION = 1600

type Phase =
  | { name: 'idle' }
  | { name: 'scanning'; previewUrl: string | null }
  | {
      name: 'result'
      previewUrl: string | null
      reading: PosterReading
      resolution: LensResolution | null
      translation: EventTranslation | null
    }
  | {
      name: 'error'
      kind:
        | 'not_a_poster'
        | 'rate_limited'
        | 'generic'
        | 'url_unreadable'
        | 'prompt_unreadable'
    }

/** Downscale to ≤1600px JPEG so uploads stay small and the free-tier vision
 *  call cheap; poster text is still crisply readable at that size. */
async function toUploadBlob(file: File): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file)
    const scale = Math.min(
      1,
      MAX_DIMENSION / Math.max(bitmap.width, bitmap.height),
    )
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(bitmap.width * scale))
    canvas.height = Math.max(1, Math.round(bitmap.height * scale))
    const ctx = canvas.getContext('2d')
    if (!ctx) return file
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    bitmap.close()
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', 0.85),
    )
    return blob ?? file
  } catch {
    // Decode failure (exotic format) — send the original; the route
    // whitelists types and rejects what it can't take.
    return file
  }
}

function readingToDraftPatch(reading: PosterReading): Partial<EventDraft> {
  const isCivic = reading.is_civic || reading.category === 'civic'
  const description =
    reading.artists.length > 1
      ? `${reading.description}\n\nLineup: ${reading.artists.join(', ')}`
      : reading.description
  return {
    event_type: isCivic ? 'protest' : 'event',
    is_civic: isCivic,
    category: isCivic ? 'civic' : reading.category,
    title: reading.title,
    description: description.trim(),
    tags: reading.tags,
    language: reading.language,
    date: reading.date,
    time: reading.time,
    end_time: reading.end_time,
    city: reading.city,
    country: reading.country,
    address: reading.address,
    venue_name: reading.venue_name,
    price: reading.price,
    organizer_name: reading.organizer_name,
    organizer_website: reading.organizer_website,
  }
}

/**
 * Overlay the LENS-2 resolution onto the raw reading patch: a resolved city
 * fills location_slug + canonical label, an auto-matched (or user-accepted)
 * venue fills the venue's canonical name + coordinates, and a geocoded
 * address supplies coordinates when no venue was linked. Place linking
 * itself stays an approval-time act — the draft carries no place_id.
 */
function resolvedDraftPatch(
  reading: PosterReading,
  resolution: LensResolution | null,
  acceptedPlace: LensResolvedPlace | null,
  translation: EventTranslation | null,
): Partial<EventDraft> {
  const patch = readingToDraftPatch(reading)

  // LENS-3: carry the 4-language packs into the draft so they persist through
  // submission. The wizard's base title/description stay the source of truth
  // and the fallback; these only enrich.
  if (translation) {
    patch.title_i18n = translation.title
    patch.description_i18n = translation.description
  }

  if (!resolution) return patch

  if (resolution.city.status !== 'none') {
    patch.location_slug = resolution.city.slug
    patch.city = resolution.city.label
    if (resolution.city.country) patch.country = resolution.city.country
    if (resolution.city.region) patch.region = resolution.city.region
  }

  const place =
    resolution.venue.status === 'matched'
      ? resolution.venue.place
      : (acceptedPlace ?? undefined)

  if (place) {
    patch.venue_name = place.name
    patch.location_slug = place.location_slug
    if (place.address) patch.address = place.address
    if (place.city) patch.city = place.city
    if (place.lat != null) patch.lat = place.lat
    if (place.lng != null) patch.lng = place.lng
  } else if (resolution.geocode.status === 'address') {
    if (resolution.geocode.lat != null) patch.lat = resolution.geocode.lat
    if (resolution.geocode.lng != null) patch.lng = resolution.geocode.lng
    if (resolution.geocode.formatted) patch.address = resolution.geocode.formatted
  }

  return patch
}

/** True when resolution produced at least one usable hit worth tracking. */
function resolutionHasHit(resolution: LensResolution | null): boolean {
  if (!resolution) return false
  return (
    resolution.city.status !== 'none' ||
    resolution.venue.status !== 'none' ||
    resolution.geocode.status === 'address'
  )
}

export default function ScanClient() {
  const { t, language } = useLanguage()
  const router = useRouter()
  const [phase, setPhase] = useState<Phase>({ name: 'idle' })
  const [replacesDraft, setReplacesDraft] = useState(false)
  const [acceptedPlace, setAcceptedPlace] = useState<LensResolvedPlace | null>(null)
  // Which translated language the result card is previewing. null = show the
  // original extracted text.
  const [previewLang, setPreviewLang] = useState<LangKey | null>(null)
  const [urlInput, setUrlInput] = useState('')
  const [promptInput, setPromptInput] = useState('')
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const galleryInputRef = useRef<HTMLInputElement>(null)

  // Shared success handling for both the photo scanner and the URL reader.
  const enterResult = (
    reading: PosterReading,
    resolution: LensResolution | null,
    translation: EventTranslation | null,
    previewUrl: string | null,
  ) => {
    // Warn when applying will overwrite a draft the user already started.
    try {
      const existing = window.localStorage.getItem(DRAFT_STORAGE_KEY)
      const parsed = existing
        ? (JSON.parse(existing) as Partial<EventDraft>)
        : null
      setReplacesDraft(Boolean(parsed?.title))
    } catch {
      setReplacesDraft(false)
    }
    if (resolutionHasHit(resolution) && resolution) {
      trackInteraction('lens_resolved', {
        meta: {
          city: resolution.city.status,
          venue: resolution.venue.status,
          geocode: resolution.geocode.status,
        },
      })
    }
    if (resolution?.duplicate && resolution.duplicate.status !== 'none') {
      trackInteraction('lens_dup_shown', {
        meta: { status: resolution.duplicate.status },
      })
    }
    setPhase({ name: 'result', previewUrl, reading, resolution, translation })
  }

  const handleUrl = async () => {
    const url = urlInput.trim()
    if (!url || phase.name === 'scanning') return
    setPhase({ name: 'scanning', previewUrl: null })
    setAcceptedPlace(null)
    setPreviewLang(null)
    trackInteraction('lens_scan', { meta: { source: 'url' } })

    try {
      const response = await fetch('/api/lens/url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      })
      const payload = (await response.json()) as {
        ok: boolean
        reading?: PosterReading
        resolution?: LensResolution | null
        translation?: EventTranslation | null
        imageUrl?: string | null
        error?: string
      }

      if (payload.ok && payload.reading) {
        enterResult(
          payload.reading,
          payload.resolution ?? null,
          payload.translation ?? null,
          payload.imageUrl ?? null,
        )
        return
      }
      if (payload.error === 'rate_limited') {
        setPhase({ name: 'error', kind: 'rate_limited' })
      } else {
        setPhase({ name: 'error', kind: 'url_unreadable' })
      }
    } catch {
      setPhase({ name: 'error', kind: 'url_unreadable' })
    }
  }

  const handlePrompt = async () => {
    const text = promptInput.trim()
    if (text.length < 12 || phase.name === 'scanning') return
    setPhase({ name: 'scanning', previewUrl: null })
    setAcceptedPlace(null)
    setPreviewLang(null)
    trackInteraction('lens_scan', { meta: { source: 'prompt' } })

    try {
      const response = await fetch('/api/lens/prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      })
      const payload = (await response.json()) as {
        ok: boolean
        reading?: PosterReading
        resolution?: LensResolution | null
        translation?: EventTranslation | null
        error?: string
      }

      if (payload.ok && payload.reading) {
        enterResult(
          payload.reading,
          payload.resolution ?? null,
          payload.translation ?? null,
          null,
        )
        return
      }
      if (payload.error === 'rate_limited') {
        setPhase({ name: 'error', kind: 'rate_limited' })
      } else {
        setPhase({ name: 'error', kind: 'prompt_unreadable' })
      }
    } catch {
      setPhase({ name: 'error', kind: 'prompt_unreadable' })
    }
  }

  const handleFile = async (file: File | null) => {
    if (!file) return
    const previewUrl = URL.createObjectURL(file)
    setPhase({ name: 'scanning', previewUrl })
    setAcceptedPlace(null)
    setPreviewLang(null)
    trackInteraction('lens_scan')

    try {
      const blob = await toUploadBlob(file)
      const form = new FormData()
      form.append(
        'image',
        blob,
        blob.type === 'image/jpeg' ? 'poster.jpg' : file.name,
      )
      const response = await fetch('/api/lens', { method: 'POST', body: form })
      const payload = (await response.json()) as {
        ok: boolean
        reading?: PosterReading
        resolution?: LensResolution | null
        translation?: EventTranslation | null
        error?: string
      }

      if (payload.ok && payload.reading) {
        enterResult(
          payload.reading,
          payload.resolution ?? null,
          payload.translation ?? null,
          previewUrl,
        )
        return
      }
      URL.revokeObjectURL(previewUrl)
      if (payload.error === 'not_a_poster') {
        setPhase({ name: 'error', kind: 'not_a_poster' })
      } else if (payload.error === 'rate_limited') {
        setPhase({ name: 'error', kind: 'rate_limited' })
      } else {
        setPhase({ name: 'error', kind: 'generic' })
      }
    } catch {
      URL.revokeObjectURL(previewUrl)
      setPhase({ name: 'error', kind: 'generic' })
    }
  }

  const handleApply = () => {
    if (phase.name !== 'result') return
    const draft: EventDraft = {
      ...defaultEventDraft,
      ...resolvedDraftPatch(
        phase.reading,
        phase.resolution,
        acceptedPlace,
        phase.translation,
      ),
    }
    try {
      window.localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft))
    } catch {
      // Storage unavailable — the wizard simply starts empty.
    }
    trackInteraction('lens_apply')
    router.push('/submit-event')
  }

  const reset = () => {
    if (
      (phase.name === 'scanning' || phase.name === 'result') &&
      phase.previewUrl?.startsWith('blob:')
    ) {
      URL.revokeObjectURL(phase.previewUrl)
    }
    setAcceptedPlace(null)
    setPreviewLang(null)
    setPhase({ name: 'idle' })
  }

  const formatDate = (iso: string) => {
    try {
      return new Date(`${iso}T00:00:00`).toLocaleDateString(
        languageLocales[language],
        { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' },
      )
    } catch {
      return iso
    }
  }

  const errorText = (
    kind:
      | 'not_a_poster'
      | 'rate_limited'
      | 'generic'
      | 'url_unreadable'
      | 'prompt_unreadable',
  ) => {
    if (kind === 'not_a_poster') return t('lens_error_not_poster')
    if (kind === 'rate_limited') return t('lens_error_rate')
    if (kind === 'url_unreadable') return t('lens_error_url')
    if (kind === 'prompt_unreadable') return t('lens_error_prompt')
    return t('lens_error_generic')
  }

  return (
    <div className="mx-auto max-w-2xl">
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          handleFile(e.target.files?.[0] ?? null)
          e.target.value = ''
        }}
      />
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          handleFile(e.target.files?.[0] ?? null)
          e.target.value = ''
        }}
      />

      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04]">
          <ScanLine className="h-5 w-5 text-flame-400" />
        </div>
        <h1 className="font-display text-4xl">{t('lens_title')}</h1>
      </div>
      <p className="mt-3 max-w-lg text-sm leading-relaxed text-white/55">
        {t('lens_sub')}
      </p>

      <AnimatePresence mode="wait">
        {phase.name === 'idle' && (
          <motion.div
            key="idle"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mt-10 space-y-3"
          >
            <button
              type="button"
              onClick={() => cameraInputRef.current?.click()}
              className="flex w-full items-center justify-center gap-3 rounded-3xl bg-flame-500 px-6 py-5 text-base font-semibold text-[#fff] shadow-[0_12px_36px_rgba(238,28,37,0.35)] transition hover:bg-flame-400"
            >
              <Camera className="h-5 w-5" />
              {t('lens_take')}
            </button>
            <button
              type="button"
              onClick={() => galleryInputRef.current?.click()}
              className="flex w-full items-center justify-center gap-3 rounded-3xl border border-white/12 bg-white/[0.04] px-6 py-4 text-sm font-semibold text-white/85 transition hover:bg-white/[0.08] hover:text-white"
            >
              <ImagePlus className="h-4.5 w-4.5" />
              {t('lens_upload')}
            </button>

            <div className="flex items-center gap-3 pt-2">
              <span className="h-px flex-1 bg-white/10" />
              <span className="text-xs uppercase tracking-wide text-white/35">
                {t('lens_or')}
              </span>
              <span className="h-px flex-1 bg-white/10" />
            </div>

            <div>
              <label className="mb-2 flex items-center gap-2 text-sm font-medium text-white/70">
                <LinkIcon className="h-4 w-4 text-flame-400" />
                {t('lens_paste_label')}
              </label>
              <div className="flex gap-2">
                <input
                  type="url"
                  inputMode="url"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleUrl()
                  }}
                  placeholder={t('lens_paste_placeholder')}
                  className="min-w-0 flex-1 rounded-2xl border border-white/12 bg-ink-900 px-4 py-3 text-sm text-white placeholder:text-white/30 focus:border-flame-500/50 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleUrl}
                  disabled={!urlInput.trim()}
                  className="shrink-0 rounded-2xl bg-flame-500 px-5 py-3 text-sm font-semibold text-[#fff] transition hover:bg-flame-400 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {t('lens_paste_button')}
                </button>
              </div>
            </div>

            <div>
              <label className="mb-2 flex items-center gap-2 text-sm font-medium text-white/70">
                <Sparkles className="h-4 w-4 text-flame-400" />
                {t('lens_prompt_label')}
              </label>
              <textarea
                value={promptInput}
                onChange={(e) => setPromptInput(e.target.value)}
                rows={3}
                placeholder={t('lens_prompt_placeholder')}
                className="w-full resize-none rounded-2xl border border-white/12 bg-ink-900 px-4 py-3 text-sm leading-6 text-white placeholder:text-white/30 focus:border-flame-500/50 focus:outline-none"
              />
              <button
                type="button"
                onClick={handlePrompt}
                disabled={promptInput.trim().length < 12}
                className="mt-2 w-full rounded-2xl border border-flame-500/40 bg-flame-500/10 px-5 py-3 text-sm font-semibold text-flame-200 transition hover:bg-flame-500/20 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
              >
                {t('lens_prompt_button')}
              </button>
            </div>

            <p className="pt-2 text-center text-xs text-white/35">
              {t('lens_disclaimer')}
            </p>
          </motion.div>
        )}

        {phase.name === 'scanning' && (
          <motion.div
            key="scanning"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="relative mt-10 overflow-hidden rounded-3xl border border-white/10"
          >
            {phase.previewUrl ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={phase.previewUrl}
                alt=""
                className="max-h-[26rem] w-full object-cover opacity-60"
              />
            ) : (
              <div className="h-64 w-full bg-ink-900" />
            )}
            <motion.div
              initial={{ top: '0%' }}
              animate={{ top: '100%' }}
              transition={{
                duration: 1.6,
                repeat: Infinity,
                repeatType: 'reverse',
                ease: 'easeInOut',
              }}
              className="absolute inset-x-0 h-px bg-flame-500 shadow-[0_0_24px_4px_rgba(238,28,37,0.65)]"
            />
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-ink-950/40 px-6 text-center">
              <Sparkles className="h-6 w-6 animate-pulse text-flame-400" />
              <p className="mt-3 text-sm font-semibold text-white">
                {t('lens_scanning')}
              </p>
              <p className="mt-1 text-xs text-white/60">
                {t('lens_scanning_sub')}
              </p>
            </div>
          </motion.div>
        )}

        {phase.name === 'result' &&
          (() => {
            const { reading, resolution, previewUrl, translation } = phase
            const matchedPlace =
              resolution?.venue.status === 'matched'
                ? resolution.venue.place
                : acceptedPlace
            const suggestedPlace =
              resolution?.venue.status === 'suggested' && !acceptedPlace
                ? resolution.venue.place
                : null
            const venueMatched = Boolean(matchedPlace)
            const dup = resolution?.duplicate
            // LENS-3 preview: when a language pill is active, show that
            // translation; otherwise the original extracted text. A missing
            // per-language string falls back to the original.
            const displayTitle =
              (previewLang && translation?.title[previewLang]) || reading.title
            const displayDescription =
              (previewLang && translation?.description[previewLang]) ||
              reading.description
            const displayVenue = matchedPlace?.name || reading.venue_name
            const displayCity =
              matchedPlace?.city ||
              (resolution && resolution.city.status !== 'none'
                ? resolution.city.label
                : reading.city)

            return (
              <motion.div
                key="result"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="mt-10"
              >
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-flame-400">
                  <Sparkles className="h-3.5 w-3.5" />
                  {t('lens_result_title')}
                </div>

                <div className="mt-3 overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03]">
                  <div className="flex gap-4 p-5">
                    {previewUrl ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={previewUrl}
                        alt=""
                        className="h-28 w-20 shrink-0 rounded-xl border border-white/10 object-cover"
                      />
                    ) : (
                      <div className="flex h-28 w-20 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-ink-900">
                        <LinkIcon className="h-6 w-6 text-white/40" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <h2 className="text-xl font-bold leading-tight text-white">
                        {displayTitle}
                      </h2>
                      {(reading.date || reading.time) && (
                        <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm font-bold text-flame-400">
                          {reading.date && (
                            <span className="inline-flex items-center gap-1.5">
                              <Calendar className="h-4 w-4" />
                              {formatDate(reading.date)}
                            </span>
                          )}
                          {reading.time && (
                            <span className="inline-flex items-center gap-1.5">
                              <Clock className="h-4 w-4" />
                              {reading.time}
                              {reading.end_time ? `–${reading.end_time}` : ''}
                            </span>
                          )}
                        </p>
                      )}
                      {(displayVenue || displayCity) && (
                        <p className="mt-1.5 flex items-center gap-1.5 text-sm text-white/70">
                          {venueMatched ? (
                            <Check className="h-4 w-4 shrink-0 text-flame-400" />
                          ) : (
                            <MapPin className="h-4 w-4 shrink-0 text-white/40" />
                          )}
                          <span className="truncate">
                            {[displayVenue, displayCity]
                              .filter(Boolean)
                              .join(' · ')}
                          </span>
                        </p>
                      )}
                      {venueMatched && (
                        <p className="mt-1 text-xs text-flame-300/80">
                          {t('lens_venue_matched')}
                        </p>
                      )}
                      {suggestedPlace && (
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <span className="text-xs text-white/50">
                            {t('lens_venue_suggest')}
                          </span>
                          <button
                            type="button"
                            onClick={() => setAcceptedPlace(suggestedPlace)}
                            className="inline-flex items-center gap-1.5 rounded-full border border-flame-500/30 bg-flame-500/[0.08] px-3 py-1 text-xs font-medium text-flame-300 transition hover:bg-flame-500/15"
                          >
                            <Check className="h-3 w-3" />
                            {suggestedPlace.name}
                          </button>
                        </div>
                      )}
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        {reading.category && (
                          <span className="rounded-full border border-white/12 bg-white/[0.05] px-2.5 py-0.5 text-xs capitalize text-white/70">
                            {reading.category}
                          </span>
                        )}
                        {reading.price && (
                          <span className="inline-flex items-center gap-1 rounded-full border border-white/12 bg-white/[0.05] px-2.5 py-0.5 text-xs text-white/70">
                            <Ticket className="h-3 w-3" />
                            {reading.price}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {reading.artists.length > 0 && (
                    <p className="flex items-start gap-2 border-t border-white/[0.06] px-5 py-3 text-sm text-white/70">
                      <Music className="mt-0.5 h-4 w-4 shrink-0 text-white/40" />
                      <span>{reading.artists.join(' · ')}</span>
                    </p>
                  )}
                  {displayDescription && (
                    <p className="whitespace-pre-line border-t border-white/[0.06] px-5 py-3 text-sm leading-relaxed text-white/60">
                      {displayDescription}
                    </p>
                  )}
                  {reading.organizer_name && (
                    <p className="flex items-center gap-2 border-t border-white/[0.06] px-5 py-3 text-xs text-white/50">
                      <Users className="h-3.5 w-3.5" />
                      {reading.organizer_name}
                    </p>
                  )}
                </div>

                {translation && (
                  <div className="mt-3 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
                    <div className="flex items-center gap-2 text-xs text-white/55">
                      <Languages className="h-3.5 w-3.5 text-flame-400" />
                      {t('lens_translated')}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <button
                        type="button"
                        onClick={() => setPreviewLang(null)}
                        className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                          previewLang === null
                            ? 'bg-flame-500 text-[#fff]'
                            : 'border border-white/12 bg-white/[0.05] text-white/70 hover:bg-white/[0.1]'
                        }`}
                      >
                        {t('lens_translate_original')}
                      </button>
                      {PREVIEW_LANGS.map(({ key, label }) => (
                        <button
                          key={key}
                          type="button"
                          onClick={() => setPreviewLang(key)}
                          className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                            previewLang === key
                              ? 'bg-flame-500 text-[#fff]'
                              : 'border border-white/12 bg-white/[0.05] text-white/70 hover:bg-white/[0.1]'
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {reading.confidence < 0.6 && (
                  <p className="mt-3 rounded-2xl border border-amber-500/20 bg-amber-500/[0.07] px-4 py-3 text-sm text-amber-200">
                    {t('lens_low_confidence')}
                  </p>
                )}
                {replacesDraft && (
                  <p className="mt-3 text-center text-xs text-white/45">
                    {t('lens_replace_warning')}
                  </p>
                )}

                {/* Stage D — duplicate warning. Never blocks: it sits above
                    Continue, which keeps working (the match could be wrong or
                    a genuinely different edition). */}
                {dup?.status === 'live' && dup.event && (
                  <div className="mt-4 rounded-2xl border border-flame-500/25 bg-flame-500/[0.06] p-4">
                    <div className="flex items-center gap-2 text-sm font-semibold text-flame-300">
                      <CalendarCheck className="h-4 w-4 shrink-0" />
                      {t('lens_dup_live_title')}
                    </div>
                    <p className="mt-1 text-xs text-white/60">
                      {t('lens_dup_live_sub')}
                    </p>
                    <Link
                      href={`/events/${dup.event.slug}`}
                      className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-flame-500/30 bg-flame-500/10 px-3.5 py-1.5 text-xs font-medium text-flame-200 transition hover:bg-flame-500/20"
                    >
                      <span className="max-w-[16rem] truncate">
                        {t('lens_dup_view')} · {dup.event.title}
                      </span>
                      <ArrowRight className="h-3.5 w-3.5 shrink-0" />
                    </Link>
                    <p className="mt-3 text-xs text-white/40">
                      {t('lens_dup_continue_hint')}
                    </p>
                  </div>
                )}
                {dup?.status === 'in_review' && (
                  <div className="mt-4 rounded-2xl border border-white/12 bg-white/[0.04] p-4">
                    <div className="flex items-center gap-2 text-sm font-semibold text-white/85">
                      <Info className="h-4 w-4 shrink-0 text-white/50" />
                      {t('lens_dup_review_title')}
                    </div>
                    <p className="mt-1 text-xs text-white/55">
                      {t('lens_dup_review_sub')}
                    </p>
                    <p className="mt-3 text-xs text-white/40">
                      {t('lens_dup_continue_hint')}
                    </p>
                  </div>
                )}

                <div className="mt-4 space-y-3">
                  <button
                    type="button"
                    onClick={handleApply}
                    className="flex w-full items-center justify-center gap-2 rounded-3xl bg-flame-500 px-6 py-4 text-base font-semibold text-[#fff] shadow-[0_12px_36px_rgba(238,28,37,0.35)] transition hover:bg-flame-400"
                  >
                    {t('lens_use')}
                  </button>
                  <button
                    type="button"
                    onClick={reset}
                    className="flex w-full items-center justify-center gap-2 rounded-3xl border border-white/12 bg-white/[0.04] px-6 py-3.5 text-sm font-semibold text-white/80 transition hover:bg-white/[0.08] hover:text-white"
                  >
                    <RefreshCw className="h-4 w-4" />
                    {t('lens_retake')}
                  </button>
                  <p className="text-center text-xs text-white/35">
                    {t('lens_disclaimer')}
                  </p>
                </div>
              </motion.div>
            )
          })()}

        {phase.name === 'error' && (
          <motion.div
            key="error"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mt-10"
          >
            <p className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              {errorText(phase.kind)}
            </p>
            <button
              type="button"
              onClick={reset}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-3xl border border-white/12 bg-white/[0.04] px-6 py-3.5 text-sm font-semibold text-white/80 transition hover:bg-white/[0.08] hover:text-white"
            >
              <RefreshCw className="h-4 w-4" />
              {t('lens_retake')}
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
