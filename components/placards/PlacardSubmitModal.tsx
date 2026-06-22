'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { CheckCircle2, Loader2, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/browser'
import {
  PLACARD_CATEGORY_LABELS,
  PLACARD_LANGUAGE_LABELS,
  PLACARD_SUBMIT_CATEGORY_KEYS,
  SLOGAN_MAX_LENGTH,
  SLOGAN_MIN_LENGTH,
} from '@/lib/placards'
import type { PlacardCategory, PlacardLanguage } from '@/lib/placards'

type Props = { open: boolean; onClose: () => void }

type FormStep = 'editing' | 'submitting' | 'success'

export default function PlacardSubmitModal({ open, onClose }: Props) {
  const [step, setStep] = useState<FormStep>('editing')
  const [slogan, setSlogan] = useState('')
  const [language, setLanguage] = useState<PlacardLanguage>('sq')
  const [categories, setCategories] = useState<PlacardCategory[]>([])
  const [city, setCity] = useState('')
  const [submitterName, setSubmitterName] = useState('')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [authChecked, setAuthChecked] = useState(false)
  const [isAuthed, setIsAuthed] = useState(false)
  const sloganRef = useRef<HTMLTextAreaElement | null>(null)

  useEffect(() => {
    if (!open) return
    let cancelled = false
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => {
      if (cancelled) return
      const user = data?.user ?? null
      setIsAuthed(!!user)
      setAuthChecked(true)
      if (user) {
        const meta = (user.user_metadata ?? {}) as Record<string, unknown>
        const display = (meta.display_name as string | undefined) ?? (meta.full_name as string | undefined)
        if (display) setSubmitterName(display)
      }
    })
    return () => {
      cancelled = true
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = ''
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  useEffect(() => {
    if (open && authChecked && isAuthed && step === 'editing') {
      sloganRef.current?.focus()
    }
  }, [open, authChecked, isAuthed, step])

  if (!open) return null

  function resetAndClose() {
    setStep('editing')
    setSlogan('')
    setLanguage('sq')
    setCategories([])
    setCity('')
    setSubmitterName('')
    setErrorMessage(null)
    onClose()
  }

  function toggleCategory(c: PlacardCategory) {
    setCategories((prev) => {
      if (prev.includes(c)) return prev.filter((x) => x !== c)
      if (prev.length >= 2) return prev
      return [...prev, c]
    })
  }

  async function handleSubmit() {
    setErrorMessage(null)
    const cleaned = slogan.trim()
    if (cleaned.length < SLOGAN_MIN_LENGTH || cleaned.length > SLOGAN_MAX_LENGTH) {
      setErrorMessage(`Mesazhi duhet të jetë mes ${SLOGAN_MIN_LENGTH} dhe ${SLOGAN_MAX_LENGTH} karaktereve.`)
      return
    }
    setStep('submitting')
    const supabase = createClient()
    const { data: userData } = await supabase.auth.getUser()
    const user = userData?.user
    if (!user) {
      setErrorMessage('Duhet të kyçesh për të dërguar.')
      setStep('editing')
      return
    }

    const { error } = await supabase.from('placards').insert({
      slogan: cleaned,
      language,
      categories,
      city: city.trim() || null,
      status: 'pending',
      submitted_by: user.id,
      submitter_name: submitterName.trim() || null,
    })

    if (error) {
      const msg = (error.message || '').toLowerCase()
      if (msg.includes('duplicate') || msg.includes('placards_slogan_unique')) {
        setErrorMessage('Kjo pankartë ekziston tashmë.')
      } else if (msg.includes('check') || msg.includes('char_length')) {
        setErrorMessage(`Mesazhi duhet të jetë mes ${SLOGAN_MIN_LENGTH} dhe ${SLOGAN_MAX_LENGTH} karaktereve.`)
      } else {
        setErrorMessage('Diçka shkoi keq. Provo përsëri.')
      }
      setStep('editing')
      return
    }

    setStep('success')
  }

  const trimmed = slogan.trim()
  const isLengthValid =
    trimmed.length >= SLOGAN_MIN_LENGTH && trimmed.length <= SLOGAN_MAX_LENGTH

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 px-4 py-10"
      onClick={resetAndClose}
    >
      <div
        className="relative max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-3xl border border-white/10 bg-ink-950 p-6 sm:p-8"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={resetAndClose}
          className="absolute right-4 top-4 inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/[0.05] text-white/70 transition hover:bg-white/10 hover:text-white"
          aria-label="Mbyll"
        >
          <X className="h-4 w-4" />
        </button>

        {!authChecked ? (
          <div className="flex items-center justify-center py-16 text-white/60">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : !isAuthed ? (
          <div className="py-6">
            <h2 className="text-2xl font-semibold tracking-tight text-white">
              Hyr për të dërguar pankartën tënde
            </h2>
            <p className="mt-3 text-sm text-white/65">
              Të gjitha mesazhet kalojnë nëpërmjet një moderimi të shkurtër para se të
              shfaqen në bibliotekë. Kjo na ndihmon të mbajmë cilësinë dhe sigurinë.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href="/sign-in?next=/pankartat"
                className="inline-flex items-center gap-2 rounded-full bg-flame-500 px-5 py-2.5 text-sm font-semibold text-white shadow-[0_0_24px_-4px_rgba(238,28,37,0.55)] transition hover:bg-flame-500/90"
              >
                Hyr
              </Link>
              <Link
                href="/sign-up?next=/pankartat"
                className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.04] px-5 py-2.5 text-sm font-semibold text-white/85 transition hover:border-white/25"
              >
                Krijo llogari
              </Link>
            </div>
          </div>
        ) : step === 'success' ? (
          <div className="py-6 text-center">
            <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-400" />
            <h2 className="mt-4 text-2xl font-semibold tracking-tight text-white">
              Faleminderit!
            </h2>
            <p className="mt-3 text-sm text-white/65">
              Mesazhi u dërgua për shqyrtim. Pasi të miratohet nga moderatori,
              do të shfaqet në bibliotekë.
            </p>
            <button
              type="button"
              onClick={resetAndClose}
              className="mt-6 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.04] px-5 py-2 text-sm font-semibold text-white/85 transition hover:border-white/25"
            >
              Mbyll
            </button>
          </div>
        ) : (
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-white">
              Dërgo një pankartë
            </h2>
            <p className="mt-2 text-sm text-white/60">
              Të gjitha mesazhet kalojnë nëpërmjet një moderimi të shkurtër.
            </p>

            <div className="mt-6 flex flex-col gap-5">
              <div>
                <label
                  htmlFor="placard-slogan"
                  className="block text-xs font-semibold uppercase tracking-[0.22em] text-white/55"
                >
                  Mesazhi
                </label>
                <textarea
                  id="placard-slogan"
                  ref={sloganRef}
                  value={slogan}
                  onChange={(e) => setSlogan(e.target.value.slice(0, SLOGAN_MAX_LENGTH + 20))}
                  rows={3}
                  placeholder="P.sh. Shqipëria nuk shitet"
                  className="mt-2 w-full resize-none rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-base text-white placeholder:text-white/30 focus:border-flame-500/60 focus:outline-none"
                />
                <div className="mt-1.5 flex items-center justify-between text-[11px] text-white/50">
                  <span>
                    Mes {SLOGAN_MIN_LENGTH} dhe {SLOGAN_MAX_LENGTH} karaktere.
                  </span>
                  <span
                    className={
                      trimmed.length > SLOGAN_MAX_LENGTH
                        ? 'text-flame-300'
                        : 'text-white/50'
                    }
                  >
                    {trimmed.length}/{SLOGAN_MAX_LENGTH}
                  </span>
                </div>
              </div>

              <div>
                <span className="block text-xs font-semibold uppercase tracking-[0.22em] text-white/55">
                  Gjuha
                </span>
                <div className="mt-2 flex flex-wrap gap-2">
                  {(Object.entries(PLACARD_LANGUAGE_LABELS) as Array<[
                    PlacardLanguage,
                    { label: string; flag: string },
                  ]>).map(([key, info]) => {
                    const active = language === key
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setLanguage(key)}
                        className={[
                          'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition',
                          active
                            ? 'border-flame-500/55 bg-flame-500/15 text-flame-100'
                            : 'border-white/10 bg-white/[0.04] text-white/70 hover:text-white',
                        ].join(' ')}
                      >
                        <span>{info.flag}</span>
                        <span>{info.label}</span>
                      </button>
                    )
                  })}
                </div>
              </div>

              <div>
                <span className="block text-xs font-semibold uppercase tracking-[0.22em] text-white/55">
                  Kategoritë <span className="text-white/35">(max 2)</span>
                </span>
                <div className="mt-2 flex flex-wrap gap-2">
                  {PLACARD_SUBMIT_CATEGORY_KEYS.map((key) => {
                    const active = categories.includes(key)
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => toggleCategory(key)}
                        className={[
                          'rounded-full border px-3 py-1.5 text-xs font-semibold transition',
                          active
                            ? 'border-flame-500/55 bg-flame-500/15 text-flame-100'
                            : 'border-white/10 bg-white/[0.04] text-white/70 hover:text-white',
                        ].join(' ')}
                      >
                        {PLACARD_CATEGORY_LABELS[key]}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="placard-city"
                    className="block text-xs font-semibold uppercase tracking-[0.22em] text-white/55"
                  >
                    Qyteti <span className="text-white/35">(opsionale)</span>
                  </label>
                  <input
                    id="placard-city"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="P.sh. Tiranë"
                    className="mt-2 w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm text-white placeholder:text-white/30 focus:border-flame-500/60 focus:outline-none"
                  />
                </div>
                <div>
                  <label
                    htmlFor="placard-name"
                    className="block text-xs font-semibold uppercase tracking-[0.22em] text-white/55"
                  >
                    Emri <span className="text-white/35">(opsionale)</span>
                  </label>
                  <input
                    id="placard-name"
                    value={submitterName}
                    onChange={(e) => setSubmitterName(e.target.value)}
                    placeholder="Si dëshiron të identifikohesh"
                    className="mt-2 w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm text-white placeholder:text-white/30 focus:border-flame-500/60 focus:outline-none"
                  />
                </div>
              </div>

              {errorMessage && (
                <div className="rounded-2xl border border-flame-500/30 bg-flame-500/10 px-4 py-3 text-sm text-flame-100">
                  {errorMessage}
                </div>
              )}

              <div className="flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={resetAndClose}
                  className="rounded-full border border-white/10 bg-transparent px-4 py-2 text-sm font-semibold text-white/65 transition hover:text-white"
                >
                  Anulo
                </button>
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={step === 'submitting' || !isLengthValid}
                  className="inline-flex items-center gap-2 rounded-full bg-flame-500 px-5 py-2 text-sm font-semibold text-white shadow-[0_0_24px_-4px_rgba(238,28,37,0.55)] transition hover:bg-flame-500/90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {step === 'submitting' && <Loader2 className="h-4 w-4 animate-spin" />}
                  Dërgo për shqyrtim
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
