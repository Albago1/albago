'use client'

import { useRef, useState } from 'react'
import {
  ArrowDown,
  ArrowUp,
  ImagePlus,
  Plus,
  Trash2,
  UploadCloud,
  X,
} from 'lucide-react'
import type { MediaSection } from '@/types/eventDraft'
import { MAX_SECTION_BODY, MAX_SECTION_TITLE } from '@/types/eventDraft'
import { useImageUpload } from '@/hooks/useImageUpload'

type Props = {
  sections: MediaSection[]
  onChange: (next: MediaSection[]) => void
}

/**
 * Named photo sections editor. Each section is a heading + blurb + its own set
 * of photos, rendered on the public page as a band below the main gallery.
 * Deliberately simpler than the main gallery's drag-sort — add/remove/reorder
 * by buttons keeps it robust across an arbitrary number of sections.
 */
export default function MediaSectionsEditor({ sections, onChange }: Props) {
  const { upload, error: uploadError } = useImageUpload('event-covers')
  // Which section is mid-upload, so only that card shows the spinner.
  const [uploadingIndex, setUploadingIndex] = useState<number | null>(null)
  const inputRefs = useRef<Array<HTMLInputElement | null>>([])

  function patchSection(index: number, patch: Partial<MediaSection>) {
    onChange(sections.map((s, i) => (i === index ? { ...s, ...patch } : s)))
  }

  function addSection() {
    onChange([...sections, { title: '', body: '', urls: [] }])
  }

  function removeSection(index: number) {
    onChange(sections.filter((_, i) => i !== index))
  }

  function moveSection(index: number, dir: -1 | 1) {
    const target = index + dir
    if (target < 0 || target >= sections.length) return
    const next = [...sections]
    ;[next[index], next[target]] = [next[target], next[index]]
    onChange(next)
  }

  function removePhoto(sectionIndex: number, url: string) {
    patchSection(sectionIndex, {
      urls: sections[sectionIndex].urls.filter((u) => u !== url),
    })
  }

  async function handleFiles(sectionIndex: number, files: FileList | null) {
    if (!files || files.length === 0) return
    setUploadingIndex(sectionIndex)
    const newUrls: string[] = []
    for (const file of Array.from(files)) {
      const result = await upload(file)
      if (result.url) newUrls.push(result.url)
    }
    setUploadingIndex(null)
    if (newUrls.length > 0) {
      // Re-read from the latest closure via functional-style map on current
      // props: append to whatever this section holds now.
      onChange(
        sections.map((s, i) =>
          i === sectionIndex ? { ...s, urls: [...s.urls, ...newUrls] } : s,
        ),
      )
    }
    const input = inputRefs.current[sectionIndex]
    if (input) input.value = ''
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-white">Photo sections</h3>
        <p className="mt-1 text-xs text-white/50">
          Optional. Group extra photos under their own headings — like
          &ldquo;The Venue&rdquo; or &ldquo;Lineup&rdquo; — each with a short
          note. They appear below the main gallery on your event page.
        </p>
      </div>

      {sections.map((section, index) => {
        const isUploading = uploadingIndex === index
        return (
          <div
            key={index}
            className="space-y-3 rounded-3xl border border-white/10 bg-white/[0.02] p-4"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/40">
                Section {index + 1}
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => moveSection(index, -1)}
                  disabled={index === 0}
                  aria-label="Move section up"
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-white/70 transition hover:bg-white/[0.1] disabled:opacity-30"
                >
                  <ArrowUp className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => moveSection(index, 1)}
                  disabled={index === sections.length - 1}
                  aria-label="Move section down"
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-white/70 transition hover:bg-white/[0.1] disabled:opacity-30"
                >
                  <ArrowDown className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => removeSection(index)}
                  aria-label="Remove section"
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-red-500/30 bg-red-500/15 text-red-100 transition hover:bg-red-500/30"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>

            <input
              type="text"
              value={section.title}
              maxLength={MAX_SECTION_TITLE}
              onChange={(e) => patchSection(index, { title: e.target.value })}
              placeholder="Section name — e.g. The Venue"
              className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm text-white placeholder:text-white/35 focus:border-flame-400/60 focus:outline-none"
            />

            <textarea
              value={section.body}
              maxLength={MAX_SECTION_BODY}
              onChange={(e) => patchSection(index, { body: e.target.value })}
              placeholder="A short note about these photos (optional)"
              rows={2}
              className="w-full resize-y rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm text-white placeholder:text-white/35 focus:border-flame-400/60 focus:outline-none"
            />

            {section.urls.length > 0 && (
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {section.urls.map((url) => (
                  <div
                    key={url}
                    className="group relative aspect-square overflow-hidden rounded-xl border border-white/10 bg-white/[0.04]"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={url}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => removePhoto(index, url)}
                      aria-label="Remove photo"
                      className="absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-full border border-white/20 bg-black/55 text-white backdrop-blur-sm transition hover:bg-red-500/60"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <button
              type="button"
              onClick={() => inputRefs.current[index]?.click()}
              disabled={isUploading}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-white/15 bg-white/[0.02] px-3 py-3 text-xs font-semibold text-white/70 transition hover:border-flame-500/40 hover:bg-flame-500/[0.04] disabled:opacity-50"
            >
              {isUploading ? (
                <>
                  <UploadCloud className="h-4 w-4 animate-pulse text-flame-300" />
                  Uploading…
                </>
              ) : (
                <>
                  <ImagePlus className="h-4 w-4" />
                  Add photos to this section
                </>
              )}
            </button>

            <input
              ref={(el) => {
                inputRefs.current[index] = el
              }}
              type="file"
              multiple
              accept="image/jpeg,image/png,image/webp,image/avif"
              className="hidden"
              onChange={(e) => void handleFiles(index, e.target.files)}
            />
          </div>
        )
      })}

      <button
        type="button"
        onClick={addSection}
        className="flex w-full items-center justify-center gap-2 rounded-2xl border border-white/12 bg-white/[0.03] px-4 py-3 text-sm font-semibold text-white/80 transition hover:border-flame-500/40 hover:bg-flame-500/[0.05]"
      >
        <Plus className="h-4 w-4" />
        {sections.length === 0 ? 'Add a photo section' : 'Add another section'}
      </button>

      {uploadError && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-100">
          {uploadError}
        </div>
      )}
    </div>
  )
}
