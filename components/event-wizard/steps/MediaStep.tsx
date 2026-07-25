'use client'

import { useEffect, useRef, useState } from 'react'
import { ImageIcon, Star, Trash2, UploadCloud, GripVertical } from 'lucide-react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import { restrictToParentElement } from '@dnd-kit/modifiers'
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { EventDraft } from '@/types/eventDraft'
import { MAX_EVENT_PHOTOS } from '@/types/eventDraft'
import { useImageUpload } from '@/hooks/useImageUpload'

type Props = {
  draft: EventDraft
  patch: (patch: Partial<EventDraft>) => void
}

/**
 * One draggable photo. The whole tile is the drag surface (long-press on
 * touch, click-drag on desktop, arrow keys when focused). Action buttons stop
 * pointer propagation so tapping them never starts a drag.
 */
function PhotoTile({
  url,
  index,
  isCover,
  onRemove,
  onMakeCover,
}: {
  url: string
  index: number
  isCover: boolean
  onRemove: () => void
  onMakeCover: () => void
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: url })

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  // Buttons live inside the drag surface; swallow the pointerdown so the
  // sortable sensor never treats a tap as the start of a drag.
  const stop = (e: React.PointerEvent) => e.stopPropagation()

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      aria-label={
        isCover
          ? `Cover photo. Press space to pick up, arrow keys to reorder.`
          : `Photo ${index + 1}. Press space to pick up, arrow keys to reorder.`
      }
      className={[
        'group relative cursor-grab overflow-hidden rounded-2xl border bg-white/[0.04] outline-none active:cursor-grabbing',
        isCover ? 'border-flame-500/50 ring-1 ring-flame-500/30' : 'border-white/10',
        'focus-visible:ring-2 focus-visible:ring-flame-400',
        isDragging ? 'z-20 scale-[1.03] opacity-90 shadow-2xl shadow-black/60' : '',
      ].join(' ')}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt={isCover ? 'Cover photo' : `Photo ${index + 1}`}
        draggable={false}
        className="pointer-events-none aspect-square w-full select-none object-cover"
      />

      {/* Cover badge (top-left) */}
      {isCover && (
        <span className="pointer-events-none absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-flame-500 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white shadow-lg shadow-flame-500/30">
          <Star className="h-2.5 w-2.5 fill-current" />
          Cover
        </span>
      )}

      {/* Drag affordance (top-right) */}
      <span className="pointer-events-none absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/45 text-white/80 backdrop-blur-sm">
        <GripVertical className="h-4 w-4" />
      </span>

      {/* Action bar — always visible so it works on touch */}
      <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-gradient-to-t from-black/85 via-black/45 to-transparent p-2">
        {!isCover ? (
          <button
            type="button"
            onPointerDown={stop}
            onClick={onMakeCover}
            className="inline-flex h-11 items-center gap-1.5 rounded-full border border-white/20 bg-black/50 px-3 text-xs font-semibold text-white backdrop-blur-sm transition active:scale-95 hover:border-flame-400/60 hover:bg-flame-500/25"
          >
            <Star className="h-3.5 w-3.5" />
            Cover
          </button>
        ) : (
          <span aria-hidden className="h-11 w-0" />
        )}
        <button
          type="button"
          onPointerDown={stop}
          onClick={onRemove}
          aria-label="Remove photo"
          className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-red-500/40 bg-red-500/20 text-red-100 backdrop-blur-sm transition active:scale-95 hover:bg-red-500/40"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}

export default function MediaStep({ draft, patch }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const { upload, uploading, error: uploadError } = useImageUpload('event-covers')
  const [localPreviews, setLocalPreviews] = useState<string[]>([])
  const [stepError, setStepError] = useState<string | null>(null)

  const sensors = useSensors(
    // Desktop: start dragging after a small deliberate move.
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    // Touch: long-press to pick up, so vertical scrolling still works.
    useSensor(TouchSensor, {
      activationConstraint: { delay: 200, tolerance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  )

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

  function removeUrl(url: string) {
    patch({ gallery_urls: draft.gallery_urls.filter((u) => u !== url) })
  }

  function makeCover(url: string) {
    const from = draft.gallery_urls.indexOf(url)
    if (from <= 0) return
    patch({ gallery_urls: arrayMove(draft.gallery_urls, from, 0) })
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = draft.gallery_urls.indexOf(String(active.id))
    const newIndex = draft.gallery_urls.indexOf(String(over.id))
    if (oldIndex < 0 || newIndex < 0) return
    patch({ gallery_urls: arrayMove(draft.gallery_urls, oldIndex, newIndex) })
  }

  const hasPhotos = draft.gallery_urls.length > 0
  const canAddMore = remainingSlots > 0

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold text-white">Photos</h2>
        <p className="mt-1 text-sm text-white/55">
          Add up to {MAX_EVENT_PHOTOS}. Drag to reorder — the first photo is your
          cover. JPG, PNG, WebP, or AVIF, up to 8&nbsp;MB each.
        </p>
      </div>

      {(hasPhotos || localPreviews.length > 0) && (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          modifiers={[restrictToParentElement]}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={draft.gallery_urls} strategy={rectSortingStrategy}>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {draft.gallery_urls.map((url, i) => (
                <PhotoTile
                  key={url}
                  url={url}
                  index={i}
                  isCover={i === 0}
                  onRemove={() => removeUrl(url)}
                  onMakeCover={() => makeCover(url)}
                />
              ))}

              {/* Uploading previews — not sortable until they land */}
              {localPreviews.map((url, i) => (
                <div
                  key={`preview-${url}-${i}`}
                  className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04]"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={url}
                    alt="Uploading"
                    className="aspect-square w-full object-cover opacity-60"
                  />
                  <div className="absolute inset-0 flex items-center justify-center bg-ink-950/50 text-xs font-semibold text-white">
                    <UploadCloud className="mr-1.5 h-3.5 w-3.5 animate-pulse text-flame-300" />
                    Uploading…
                  </div>
                </div>
              ))}
            </div>
          </SortableContext>
        </DndContext>
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
                {hasPhotos
                  ? `Add more (${remainingSlots} left)`
                  : 'Click to upload photos'}
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
