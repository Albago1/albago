'use client'

import { useEffect, useRef, useState } from 'react'
import { Camera, Check, Trash2, UploadCloud } from 'lucide-react'
import { createClient } from '@/lib/supabase/browser'
import { useImageUpload } from '@/hooks/useImageUpload'
import { useLanguage } from '@/lib/i18n/LanguageProvider'

type Props = {
  initialAvatarUrl: string | null
  /** Used for the letter fallback when there's no photo. */
  fallbackSeed: string
}

export default function AvatarForm({ initialAvatarUrl, fallbackSeed }: Props) {
  const { t } = useLanguage()
  const supabase = createClient()
  const inputRef = useRef<HTMLInputElement>(null)
  const { upload, uploading, error: uploadError } = useImageUpload('avatars')

  const [avatarUrl, setAvatarUrl] = useState<string | null>(initialAvatarUrl)
  const [localPreview, setLocalPreview] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    return () => {
      if (localPreview) URL.revokeObjectURL(localPreview)
    }
  }, [localPreview])

  const initial = (fallbackSeed.trim()[0] || '?').toUpperCase()
  const shown = localPreview || avatarUrl

  const persist = async (nextUrl: string | null) => {
    setBusy(true)
    setMessage(null)
    setErrorMessage(null)

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      setBusy(false)
      setErrorMessage(t('settings_err_session'))
      return false
    }

    const { error } = await supabase
      .from('profiles')
      .update({ avatar_url: nextUrl })
      .eq('id', user.id)

    setBusy(false)
    if (error) {
      console.error('[avatar_url]', error.message)
      setErrorMessage("Couldn't save your photo — please try again.")
      return false
    }
    setMessage(t('settings_saved'))
    setTimeout(() => setMessage(null), 1500)
    return true
  }

  async function handleFile(file: File) {
    setErrorMessage(null)
    const objectUrl = URL.createObjectURL(file)
    setLocalPreview(objectUrl)

    const result = await upload(file)
    if (result.url) {
      const ok = await persist(result.url)
      if (ok) setAvatarUrl(result.url)
    }

    URL.revokeObjectURL(objectUrl)
    setLocalPreview(null)
    if (inputRef.current) inputRef.current.value = ''
  }

  async function handleRemove() {
    const ok = await persist(null)
    if (ok) setAvatarUrl(null)
  }

  const isBusy = uploading || busy

  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
      <h3 className="text-sm font-semibold text-white">
        {t('settings_avatar_title')}
      </h3>
      <p className="mt-1 text-sm text-white/55">{t('settings_avatar_sub')}</p>

      <div className="mt-4 flex items-center gap-5">
        {/* Preview */}
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={isBusy}
          aria-label={t('settings_avatar_upload')}
          className="group relative h-20 w-20 flex-shrink-0 overflow-hidden rounded-full ring-2 ring-white/10 transition hover:ring-flame-400/50 disabled:opacity-60"
        >
          {shown ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={shown}
              alt="Your avatar"
              className="h-full w-full object-cover"
            />
          ) : (
            <span className="flex h-full w-full items-center justify-center bg-flame-500 text-2xl font-bold text-white">
              {initial}
            </span>
          )}
          <span className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition group-hover:opacity-100">
            {isBusy ? (
              <UploadCloud className="h-5 w-5 animate-pulse text-white" />
            ) : (
              <Camera className="h-5 w-5 text-white" />
            )}
          </span>
        </button>

        {/* Actions */}
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={isBusy}
            className="inline-flex h-11 items-center gap-2 rounded-full border border-white/15 bg-white/[0.06] px-4 text-sm font-semibold text-white/85 transition active:scale-95 hover:bg-white/[0.10] hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Camera className="h-4 w-4" />
            {shown ? t('settings_avatar_replace') : t('settings_avatar_upload')}
          </button>
          {avatarUrl && (
            <button
              type="button"
              onClick={() => void handleRemove()}
              disabled={isBusy}
              className="inline-flex h-11 items-center gap-2 rounded-full border border-red-500/30 bg-red-500/10 px-4 text-sm font-semibold text-red-200 transition active:scale-95 hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Trash2 className="h-4 w-4" />
              {t('settings_avatar_remove')}
            </button>
          )}
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/avif"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) void handleFile(file)
        }}
      />

      {message && (
        <p className="mt-3 inline-flex items-center gap-1.5 text-sm text-emerald-300">
          <Check className="h-4 w-4" />
          {message}
        </p>
      )}
      {(uploadError || errorMessage) && (
        <p className="mt-3 text-sm text-red-300">{uploadError || errorMessage}</p>
      )}
    </div>
  )
}
