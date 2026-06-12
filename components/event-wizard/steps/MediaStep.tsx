'use client'

import { useEffect, useRef, useState } from 'react'
import {
  ImageIcon,
  Star,
  Trash2,
  UploadCloud,
  ArrowLeft as ArrowLeftIcon,
  ArrowRight as ArrowRightIcon,
} from 'lucide-react'
import type { EventDraft } from '@/types/eventDraft'
import { MAX_EVENT_PHOTOS } from '@/types/eventDraft'
import { useImageUpload } from '@/hooks/useImageUpload'

type Props = {
  draft: EventDraft
  patch: (patch: Partial<EventDraft>) => void
}

export default function MediaStep({ draft, patch }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const { upload, uploading, error: uploadError } = useImageUpload('event-covers')
  const [localPreviews, setLocalPreviews] = useState<string[]>([])
  const [stepError, setStepError] = useState<string | null>(null)

  useEffect(() => {
    return () => {
      localPreviews.forEach((url) => URL.revokeObjectURL(url))
    }
  }, [localPreviews])

  const remainingSlots = MAX_EVENT_PHOTOS - draft.gallery_urls.length

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return
    setStepError(null)

    const asArray = Array.from(files).slice(0, remainingSlots)
    if (asArray.length === 0) {
      setStepError(`You can attach at most ${MAX_EVENT_PHOTOS} photos.`)
      return
    }

    const previewUrls = asArray.map((f) => URL.createObjectURL(f))
    setLocalPreviews((prev) => [...prev, ...previewUrls])

    const newUrls: string[] = []
    for (const file of asArray) {
      const result = await upload(file)
      if (result.url) newUrls.push(result.url)
    }

    setLocalPreviews((prev) => {
      const stillUsed = prev.slice(0, prev.length - previewUrls.length)
      previewUrls.forEach((u) => URL.revokeObjectURL(u))
      return stillUsed
    })

    if (newUrls.length > 0) {
      patch({ gallery_urls: [...draft.gallery_urls, ...newUrls] })
    }
    if (inputRef.current) inputRef.current.value = ''
  }

  function removeAt(index: number) {
    const next = [...draft.gallery_urls]
    next.splice(index, 1)
    patch({ gallery_urls: next })
  }

  function moveTo(index: number, target: 'left' | 'right' | 'cover') {
    const next = [...draft.gallery_urls]
    if (target === 'cover') {
      const [moved] = next.splice(index, 1)
      next.unshift(moved)
    } else if (target === 'left' && index > 0) {
      ;[next[index - 1], next[index]] = [next[index], next[index - 1]]
    } else if (target === 'right' && index < next.length - 1) {
      ;[next[index + 1], next[index]] = [next[index], next[index + 1]]
    }
    patch({ gallery_urls: next })
  }

  const allPreviews = [...draft.gallery_urls, ...localPreviews]
  const canAddMore = remainingSlots > 0

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold text-white">Photos</h2>
        <p className="mt-1 text-sm text-white/55">
          Add up to {MAX_EVENT_PHOTOS}. The first one becomes the cover — JPG,
          PNG, WebP, or AVIF, up to 8&nbsp;MB each.
        </p>
      </div>

      {allPreviews.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {allPreviews.map((url, i) => {
            const isUploaded = i < draft.gallery_urls.length
            const isCover = isUploaded && i === 0
            return (
              <div
                key={`${url}-${i}`}
                className={`group relative overflow-hidden rounded-2xl border ${
                  isCover ? 'border-flame-500/40' : 'border-white/10'
                } bg-white/[0.04]`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={url}
                  alt={isCover ? 'Cover preview' : `Photo ${i + 1}`}
                  className="aspect-square w-full object-cover"
                />
                {!isUploaded && (
                  <div className="absolute inset-0 flex items-center justify-center bg-ink-950/60 text-xs font-semibold text-white">
                    <UploadCloud className="mr-1.5 h-3.5 w-3.5 animate-pulse text-flame-300" />
                    Uploading…
                  </div>
                )}
                {isCover && (
                  <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-flame-500/90 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white">
                    <Star className="h-2.5 w-2.5 fill-current" />
                    Cover
                  </span>
                )}
                {isUploaded && (
                  <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-1 bg-gradient-to-t from-black/80 to-transparent p-2 opacity-0 transition group-hover:opacity-100">
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={() => moveTo(i, 'left')}
                        disabled={i === 0}
                        aria-label="Move left"
                        className="flex h-7 w-7 items-center justify-center rounded-full border border-white/15 bg-black/40 text-white transition hover:bg-black/60 disabled:opacity-30"
                      >
                        <ArrowLeftIcon className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => moveTo(i, 'right')}
                        disabled={i === draft.gallery_urls.length - 1}
                        aria-label="Move right"
                        className="flex h-7 w-7 items-center justify-center rounded-full border border-white/15 bg-black/40 text-white transition hover:bg-black/60 disabled:opacity-30"
                      >
                        <ArrowRightIcon className="h-3.5 w-3.5" />
                      </button>
                      {!isCover && (
                        <button
                          type="button"
                          onClick={() => moveTo(i, 'cover')}
                          aria-label="Make cover"
                          title="Make cover"
                          className="flex h-7 w-7 items-center justify-center rounded-full border border-white/15 bg-black/40 text-white transition hover:bg-flame-500/60"
                        >
                          <Star className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => removeAt(i)}
                      aria-label="Remove photo"
                      className="flex h-7 w-7 items-center justify-center rounded-full border border-red-500/30 bg-red-500/15 text-red-200 transition hover:bg-red-500/30"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {canAddMore ? (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="flex w-full flex-col items-center justify-center gap-2 rounded-3xl border border-dashed border-white/15 bg-white/[0.02] p-10 text-center transition hover:border-flame-500/40 hover:bg-flame-500/[0.04] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {uploading ? (
            <>
              <UploadCloud className="h-10 w-10 animate-pulse text-flame-300" />
              <span className="text-sm font-semibold text-white">Uploading…</span>
              <span className="text-xs text-white/45">
                Don&apos;t close this tab
              </span>
            </>
          ) : (
            <>
              <ImageIcon className="h-10 w-10 text-white/45" />
              <span className="text-sm font-semibold text-white">
                {allPreviews.length === 0
                  ? 'Click to upload photos'
                  : `Add more (${remainingSlots} left)`}
              </span>
              <span className="text-xs text-white/45">
                Recommended 1600 × 900 px for the cover. Up to 8&nbsp;MB each.
              </span>
            </>
          )}
        </button>
      ) : (
        <p className="rounded-2xl border border-white/10 bg-white/[0.03] p-3 text-center text-xs text-white/55">
          You&apos;ve hit the {MAX_EVENT_PHOTOS}-photo limit. Remove one to add a
          different shot.
        </p>
      )}

      <input
        ref={inputRef}
        type="file"
        multiple
        accept="image/jpeg,image/png,image/webp,image/avif"
        className="hidden"
        onChange={(e) => void handleFiles(e.target.files)}
      />

      {(uploadError || stepError) && (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-100">
          {uploadError || stepError}
        </div>
      )}

      <p className="text-xs text-white/45">
        Optional — events without photos use a flame gradient fallback on the
        public site.
      </p>
    </div>
  )
}
