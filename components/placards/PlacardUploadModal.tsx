'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Camera, CheckCircle2, ImagePlus, Loader2, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/browser'
import { useImageUpload } from '@/hooks/useImageUpload'
import {
  CAPTION_MAX_LENGTH,
  PLACARD_LANGUAGE_LABELS,
  PLACARD_PHOTO_BUCKET,
} from '@/lib/placards'
import type { PlacardLanguage } from '@/lib/placards'

type Props = {
  open: boolean
  onClose: () => void
  onSubmitted?: () => void
}

type FormStep = 'editing' | 'submitting' | 'success'

export default function PlacardUploadModal({ open, onClose, onSubmitted }: Props) {
  const [step, setStep] = useState<FormStep>('editing')
  const [file, setFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [caption, setCaption] = useState('')
  const [language, setLanguage] = useState<PlacardLanguage>('sq')
  const [city, setCity] = useState('')
  const [submitterName, setSubmitterName] = useState('')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [authChecked, setAuthChecked] = useState(false)
  const [isAuthed, setIsAuthed] = useState(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const { upload, uploading } = useImageUpload(PLACARD_PHOTO_BUCKET)

  useEffect(() => {
    if (!open) return
    setStep('editing')
    setFile(null)
    setPreviewUrl(null)
    setCaption('')
    setLanguage('sq')
    setCity('')
    setErrorMessage(null)
  }, [open])

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
        const display =
          (meta.display_name as string | undefined) ?? (meta.full_name as string | undefined)
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
    if (!file) {
      setPreviewUrl(null)
      return
    }
    const url = URL.createObjectURL(file)
    setPreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  if (!open) return null

  function resetAndClose() {
    setStep('editing')
    setFile(null)
    setCaption('')
    setLanguage('sq')
    setCity('')
    setErrorMessage(null)
    onClose()
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const next = e.target.files?.[0] ?? null
    setFile(next)
    setErrorMessage(null)
  }

  async function handleSubmit() {
    setErrorMessage(null)
    if (!file) {
      setErrorMessage('Zgjidh një foto të pankartës tënde.')
      return
    }
    const trimmedCaption = caption.trim()
    if (trimmedCaption.length > CAPTION_MAX_LENGTH) {
      setErrorMessage(`Përshkrimi mund të jetë deri në ${CAPTION_MAX_LENGTH} karaktere.`)
      return
    }

    setStep('submitting')
    const { url, error: uploadError } = await upload(file)
    if (!url) {
      setErrorMessage(uploadError ?? 'Ngarkimi i fotos dështoi.')
      setStep('editing')
      return
    }

    const supabase = createClient()
    const { data: userData } = await supabase.auth.getUser()
    const user = userData?.user
    if (!user) {
      setErrorMessage('Duhet të kyçesh për të ngarkuar.')
      setStep('editing')
      return
    }

    const { error: insertError } = await supabase.from('placards').insert({
      image_url: url,
      caption: trimmedCaption || null,
      slogan: trimmedCaption || null,
      language,
      categories: [],
      city: city.trim() || null,
      status: 'pending',
      submitted_by: user.id,
      submitter_name: submitterName.trim() || null,
    })

    if (insertError) {
      setErrorMessage('Dërgimi dështoi. Provo përsëri.')
      setStep('editing')
      return
    }

    setStep('success')
    onSubmitted?.()
  }

  const captionLength = caption.trim().length
  const captionOver = captionLength > CAPTION_MAX_LENGTH
  const busy = step === 'submitting' || uploading

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
              Hyr për të ngarkuar pankartën tënde
            </h2>
            <p className="mt-3 text-sm text-white/65">
              Fotot kalojnë nëpërmjet një moderimi të shkurtër para se të shfaqen në
              galeri. Kjo na ndihmon të mbajmë hapësirën të sigurt.
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
              Fotoja u dërgua për shqyrtim. Pasi të miratohet nga moderatori, do të
              shfaqet në galeri.
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
              Ngarko pankartën tënde
            </h2>
            <p className="mt-2 text-sm text-white/60">
              Bëj një foto të pankartës që ke ngritur në protestë, ose zgjidh një nga
              galeria. Të gjitha fotot kalojnë nëpërmjet moderimit.
            </p>

            <div className="mt-6 flex flex-col gap-5">
              <div>
                <span className="block text-xs font-semibold uppercase tracking-[0.22em] text-white/55">
                  Foto e pankartës
                </span>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/avif"
                  capture="environment"
                  className="sr-only"
                  onChange={handleFileChange}
                />
                {previewUrl ? (
                  <div className="mt-2 overflow-hidden rounded-2xl border border-white/10 bg-black/40">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={previewUrl}
                      alt="Pamje paraprake e pankartës"
                      className="max-h-[360px] w-full object-contain"
                    />
                    <div className="flex items-center justify-between gap-3 border-t border-white/10 bg-white/[0.02] px-4 py-2">
                      <span className="truncate text-xs text-white/55">
                        {file?.name}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setFile(null)
                          if (fileInputRef.current) fileInputRef.current.value = ''
                        }}
                        className="rounded-full border border-white/10 px-3 py-1 text-xs font-semibold text-white/70 hover:text-white"
                      >
                        Hiq
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="flex items-center justify-center gap-2 rounded-2xl border border-dashed border-white/15 bg-white/[0.02] px-4 py-6 text-sm font-semibold text-white/75 transition hover:border-flame-500/40 hover:bg-flame-500/[0.06] hover:text-flame-100"
                    >
                      <Camera className="h-4 w-4" />
                      Bëj një foto
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (fileInputRef.current) {
                          fileInputRef.current.removeAttribute('capture')
                          fileInputRef.current.click()
                          fileInputRef.current.setAttribute('capture', 'environment')
                        }
                      }}
                      className="flex items-center justify-center gap-2 rounded-2xl border border-dashed border-white/15 bg-white/[0.02] px-4 py-6 text-sm font-semibold text-white/75 transition hover:border-flame-500/40 hover:bg-flame-500/[0.06] hover:text-flame-100"
                    >
                      <ImagePlus className="h-4 w-4" />
                      Zgjidh nga galeria
                    </button>
                  </div>
                )}
                <p className="mt-2 text-[11px] text-white/45">
                  JPG, PNG, WebP ose AVIF. Max 8 MB.
                </p>
              </div>

              <div>
                <label
                  htmlFor="placard-caption"
                  className="block text-xs font-semibold uppercase tracking-[0.22em] text-white/55"
                >
                  Përshkrim <span className="text-white/35">(opsionale)</span>
                </label>
                <textarea
                  id="placard-caption"
                  value={caption}
                  onChange={(e) => setCaption(e.target.value.slice(0, CAPTION_MAX_LENGTH + 20))}
                  rows={2}
                  placeholder="Çfarë shkruan pankarta, ose mendimet e tua"
                  className="mt-2 w-full resize-none rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-base text-white placeholder:text-white/30 focus:border-flame-500/60 focus:outline-none"
                />
                <div className="mt-1.5 flex items-center justify-end text-[11px] text-white/50">
                  <span className={captionOver ? 'text-flame-300' : 'text-white/50'}>
                    {captionLength}/{CAPTION_MAX_LENGTH}
                  </span>
                </div>
              </div>

              <div>
                <span className="block text-xs font-semibold uppercase tracking-[0.22em] text-white/55">
                  Gjuha e mesazhit
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
                  disabled={busy || !file || captionOver}
                  className="inline-flex items-center gap-2 rounded-full bg-flame-500 px-5 py-2 text-sm font-semibold text-white shadow-[0_0_24px_-4px_rgba(238,28,37,0.55)] transition hover:bg-flame-500/90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {busy && <Loader2 className="h-4 w-4 animate-spin" />}
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
