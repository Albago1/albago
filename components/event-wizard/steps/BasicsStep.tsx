'use client'

import { useState } from 'react'
import { X } from 'lucide-react'
import type { EventDraft } from '@/types/eventDraft'

type Props = {
  draft: EventDraft
  patch: (patch: Partial<EventDraft>) => void
  addTag: (tag: string) => void
  removeTag: (tag: string) => void
}

const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'sq', label: 'Shqip' },
  { code: 'de', label: 'Deutsch' },
  { code: 'es', label: 'Español' },
  { code: 'it', label: 'Italiano' },
  { code: 'fr', label: 'Français' },
]

const SUGGESTED_TAGS = [
  'free',
  'family-friendly',
  '18+',
  'outdoors',
  'indoors',
  'live-music',
  'dj',
  'workshop',
  'march',
  'rally',
]

export default function BasicsStep({ draft, patch, addTag, removeTag }: Props) {
  const [tagInput, setTagInput] = useState('')

  const commitTag = () => {
    const raw = tagInput.trim()
    if (!raw) return
    // Allow comma-separated entry.
    raw.split(',').forEach((piece) => addTag(piece))
    setTagInput('')
  }

  const onTagKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      commitTag()
    } else if (e.key === 'Backspace' && tagInput === '' && draft.tags.length > 0) {
      removeTag(draft.tags[draft.tags.length - 1])
    }
  }

  return (
    <div className="space-y-5">
      <h2 className="text-xl font-semibold text-white">Tell us about it</h2>

      <Field label="Title" htmlFor="basics-title" required>
        <input
          id="basics-title"
          type="text"
          required
          value={draft.title}
          onChange={(e) => patch({ title: e.target.value })}
          placeholder="Something specific and clear"
          className="input"
        />
        <p className="mt-1 text-xs text-white/40">
          {draft.title.length} / 80 characters
        </p>
      </Field>

      <Field label="Description" htmlFor="basics-description" required>
        <textarea
          id="basics-description"
          required
          value={draft.description}
          onChange={(e) => patch({ description: e.target.value })}
          rows={6}
          placeholder="What's happening, who's hosting, what should people expect..."
          className="input resize-y"
        />
        <p className="mt-1 text-xs text-white/40">
          Minimum 20 characters. Markdown isn't supported yet.
        </p>
      </Field>

      <Field label="Tags" htmlFor="basics-tags">
        <div className="flex flex-wrap items-center gap-1.5 rounded-2xl border border-white/10 bg-white/[0.04] p-2">
          {draft.tags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 rounded-full border border-flame-500/30 bg-flame-500/[0.08] px-2.5 py-1 text-xs text-flame-100"
            >
              {tag}
              <button
                type="button"
                onClick={() => removeTag(tag)}
                aria-label={`Remove ${tag}`}
                className="rounded-full p-0.5 text-flame-200/70 transition hover:bg-flame-500/15 hover:text-flame-100"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
          <input
            id="basics-tags"
            type="text"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={onTagKeyDown}
            onBlur={commitTag}
            placeholder={draft.tags.length === 0 ? 'Add tag, then Enter' : ''}
            className="min-w-[120px] flex-1 bg-transparent px-2 py-1 text-sm text-white outline-none placeholder:text-white/35"
          />
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {SUGGESTED_TAGS.filter((t) => !draft.tags.includes(t)).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => addTag(t)}
              className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[11px] text-white/55 transition hover:bg-white/[0.08] hover:text-white"
            >
              + {t}
            </button>
          ))}
        </div>
      </Field>

      <Field label="Language of the event" htmlFor="basics-language">
        <select
          id="basics-language"
          value={draft.language}
          onChange={(e) => patch({ language: e.target.value })}
          className="input"
        >
          {LANGUAGES.map((lang) => (
            <option key={lang.code} value={lang.code} className="bg-ink-900">
              {lang.label}
            </option>
          ))}
        </select>
      </Field>

      <style jsx>{`
        :global(.input) {
          width: 100%;
          border-radius: 1rem;
          border: 1px solid rgba(255, 255, 255, 0.1);
          background: rgba(255, 255, 255, 0.04);
          color: white;
          padding: 0.7rem 0.9rem;
          font-size: 0.875rem;
          outline: none;
          transition: border-color 0.15s, background 0.15s;
        }
        :global(.input::placeholder) {
          color: rgba(255, 255, 255, 0.35);
        }
        :global(.input:focus) {
          border-color: rgba(255, 255, 255, 0.25);
          background: rgba(255, 255, 255, 0.06);
        }
      `}</style>
    </div>
  )
}

function Field({
  label,
  htmlFor,
  required,
  children,
}: {
  label: string
  htmlFor: string
  required?: boolean
  children: React.ReactNode
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.16em] text-white/55">
        {label}
        {required && <span className="ml-1 text-flame-400">*</span>}
      </label>
      {children}
    </div>
  )
}
