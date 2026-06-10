'use client'

import { useEffect, useRef, useState } from 'react'
import { ImageIcon, Trash2, UploadCloud } from 'lucide-react'
import type { EventDraft } from '@/types/eventDraft'
import { useImageUpload } from '@/hooks/useImageUpload'

type Props = {
  draft: EventDraft
  patch: (patch: Partial<EventDraft>) => void
}

export default function MediaStep({ draft, patch }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const { upload, uploading, error: uploadError } = useImageUpload('event-covers')
  const [localPreview, setLocalPreview] = useState<string | null>(null)

  // Clean up the objectURL when the component unmounts mid-upload.
  useEffect(() => {
    return () => {
      if (localPreview) URL.revokeObjectURL(localPreview)
    }
  }, [localPreview])

  async function handleFile(file: File) {
    const objectUrl = URL.createObjectURL(file)
    setLocalPreview(objectUrl)
    const result = await upload(file)
    if (result.url) {
      patch({ banner_url: result.url })
    }
    URL.revokeObjectURL(objectUrl)
    setLocalPreview(null)
    if (inputRef.current) inputRef.current.value = ''
  }

  function handleClear() {
    patch({ banner_url: '' })
    if (inputRef.current) inputRef.current.value = ''
  }

  const previewUrl = localPreview || draft.banner_url

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold text-white">Cover image</h2>
        <p className="mt-1 text-sm text-white/55">
          A strong cover doubles your turnout. Use a 16:9 image — JPG, PNG, WebP,
          or AVIF, up to 8&nbsp;MB.
        </p>
      </div>

      {previewUrl ? (
        <div className="space-y-3">
          <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewUrl}
              alt="Cover preview"
              className="aspect-[16/9] w-full object-cover"
            />
            {uploading && (
              <div className="absolute inset-0 flex items-center justify-center bg-ink-950/60 text-sm font-semibold text-white">
                <UploadCloud className="mr-2 h-4 w-4 animate-pulse text-flame-300" />
                Uploading…
              </div>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
              className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.06] px-4 py-2 text-sm font-semibold text-white/85 transition hover:bg-white/[0.10] hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              <UploadCloud className="h-3.5 w-3.5" />
              Replace
            </button>
            <button
              type="button"
              onClick={handleClear}
              disabled={uploading}
              className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-semibold text-white/65 transition hover:bg-red-500/10 hover:text-red-200 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Remove
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="flex w-full flex-col items-center justify-center gap-2 rounded-3xl border border-dashed border-white/15 bg-white/[0.02] p-12 text-center transition hover:border-flame-500/40 hover:bg-flame-500/[0.04] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {uploading ? (
            <>
              <UploadCloud className="h-10 w-10 animate-pulse text-flame-300" />
              <span className="text-sm font-semibold text-white">Uploading…</span>
              <span className="text-xs text-white/45">Don&apos;t close this tab</span>
            </>
          ) : (
            <>
              <ImageIcon className="h-10 w-10 text-white/45" />
              <span className="text-sm font-semibold text-white">
                Click to upload a cover
              </span>
              <span className="text-xs text-white/45">
                Recommended 1600 × 900 px. Up to 8&nbsp;MB.
              </span>
            </>
          )}
        </button>
      )}

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

      {uploadError && (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-100">
          {uploadError}
        </div>
      )}

      <p className="text-xs text-white/45">
        Optional — events without a cover will use a flame gradient fallback on
        the public site.
      </p>
    </div>
  )
}
