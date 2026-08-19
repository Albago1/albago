'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowRight,
  CornerDownLeft,
  ImagePlus,
  Loader2,
  RotateCcw,
  Sparkles,
  Wand2,
  X,
} from 'lucide-react'
import Image from 'next/image'
import { seedWizardDraft } from '@/lib/eventDraftFromReading'
import { useImageUpload } from '@/hooks/useImageUpload'
import type { EventDraft } from '@/types/eventDraftBase'

/**
 * Phase 37 Stage B — the ingestion agent's workbench.
 *
 * Conversation on the left, the draft filling in on the right. The draft panel
 * is deliberately READ-ONLY: editing is the wizard's job, and having two
 * editable surfaces for one draft is how they drift apart. The only way out of
 * here is "Open in wizard", which is also the only way to publish.
 *
 * Not streaming, deliberately. `useChat` would need `@ai-sdk/react` (not a
 * dependency) and a UI-message-stream route, and a turn's latency is dominated
 * by the tool calls — a nested extraction call plus Supabase round trips — not
 * by token generation. So the turn is one JSON request, and instead of faking
 * progress the UI reports afterwards what the agent actually did, from the
 * tool names the route returns. Revisit if turns start feeling slow.
 */

type ChatMessage = {
  role: 'user' | 'assistant'
  content: string
  /** Tools the agent used producing this reply — real work, shown as chips. */
  tools?: string[]
  /** Images sent with this message, shown as thumbnails in the transcript. */
  images?: string[]
}

type TurnResponse = {
  ok: boolean
  text?: string
  draft?: EventDraft
  toolsCalled?: string[]
  usage?: { totalTokens: number }
  error?: string
}

const TOOL_LABELS: Record<string, string> = {
  read_text: 'read the text',
  read_image: 'read the poster',
  set_fields: 'filled fields',
  resolve_location: 'matched location',
  translate: 'translated',
  summarize_draft: 'checked the draft',
}

const PLACEHOLDER =
  'Paste anything — a WhatsApp forward, a Facebook post, an email, a list of events…'

export default function ComposeClient() {
  const router = useRouter()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [draft, setDraft] = useState<EventDraft | null>(null)
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [tokens, setTokens] = useState(0)
  const endRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  // Images staged for the next message, and every image sent so far. The
  // agent's read_image only accepts URLs in `attachments`, so this list is
  // also the security boundary — it must be the full conversation history,
  // not just this turn, or re-reading an earlier poster would be refused.
  const [pending, setPending] = useState<string[]>([])
  const [attachments, setAttachments] = useState<string[]>([])
  const [dragging, setDragging] = useState(false)
  const { upload, uploading, error: uploadError } = useImageUpload('event-covers')

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages, busy])

  const addFiles = async (files: File[]) => {
    const images = files.filter((f) => f.type.startsWith('image/'))
    if (images.length === 0) return
    setError(null)
    for (const file of images) {
      const { url, error: err } = await upload(file)
      if (url) setPending((p) => [...p, url])
      else if (err) setError(err)
    }
  }

  const send = async () => {
    const text = input.trim()
    const images = pending
    // An image on its own is a complete message — a poster often says it all.
    if ((!text && images.length === 0) || busy || uploading) return

    const content =
      text || (images.length === 1 ? 'Read this poster.' : 'Read these posters.')
    const next: ChatMessage[] = [
      ...messages,
      { role: 'user', content, images: images.length > 0 ? images : undefined },
    ]
    const allAttachments = [...attachments, ...images]

    setMessages(next)
    setAttachments(allAttachments)
    setPending([])
    setInput('')
    setBusy(true)
    setError(null)

    try {
      const res = await fetch('/api/admin/agent', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          messages: next.map(({ role, content: c }) => ({ role, content: c })),
          draft,
          attachments: allAttachments,
        }),
      })
      const json = (await res.json().catch(() => null)) as TurnResponse | null

      if (!res.ok || !json?.ok) {
        setError(
          json?.error === 'forbidden'
            ? 'Your admin session expired — reload the page.'
            : 'The agent could not finish that turn. Try again, or rephrase.',
        )
        // Drop the unanswered user turn so a retry doesn't double it up, and
        // re-stage the images — they're already uploaded, just not delivered.
        setMessages(messages)
        setInput(text)
        setPending(images)
        setAttachments(attachments)
        return
      }

      setMessages([
        ...next,
        { role: 'assistant', content: json.text ?? '', tools: json.toolsCalled ?? [] },
      ])
      if (json.draft) setDraft(json.draft)
      if (json.usage) setTokens((t) => t + json.usage!.totalTokens)
    } catch {
      setError('Could not reach the server.')
      setMessages(messages)
      setInput(text)
      setPending(images)
      setAttachments(attachments)
    } finally {
      setBusy(false)
    }
  }

  const reset = () => {
    if (messages.length > 0 && !window.confirm('Start over? This clears the conversation and the draft.')) {
      return
    }
    setMessages([])
    setDraft(null)
    setInput('')
    setError(null)
    setTokens(0)
    setPending([])
    setAttachments([])
  }

  const openInWizard = () => {
    if (!draft) return
    seedWizardDraft(draft)
    router.push('/admin/events/new')
  }

  // The wizard validates properly, step by step. This is only the gate for
  // "is there enough here to be worth opening" — title and date are what the
  // first step needs.
  const canOpen = Boolean(draft?.title.trim() && draft?.date.trim())

  return (
    <div className="mx-auto grid max-w-6xl gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
      {/* ---- Conversation ---- */}
      <div className="flex min-h-[70vh] flex-col rounded-3xl border border-white/10 bg-white/[0.03]">
        <div className="flex items-center justify-between gap-3 border-b border-white/[0.08] px-5 py-4">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-flame-500/15 text-flame-300">
              <Sparkles className="h-4 w-4" />
            </span>
            <div>
              <h2 className="text-sm font-semibold text-white">Compose</h2>
              <p className="text-[12px] text-white/45">
                Paste source material — the agent drafts, you publish in the wizard.
              </p>
            </div>
          </div>
          {messages.length > 0 && (
            <button
              type="button"
              onClick={reset}
              className="inline-flex flex-shrink-0 items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-semibold text-white/70 transition hover:bg-white/[0.08] hover:text-white"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Start over
            </button>
          )}
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
          {messages.length === 0 && !busy && (
            <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5">
              <p className="text-sm text-white/70">
                Drop in whatever you have. Missing details aren&apos;t a problem — the
                agent asks instead of guessing.
              </p>
              <ul className="mt-3 space-y-1.5 text-[13px] text-white/45">
                <li>· A forwarded message with a date and a venue</li>
                <li>· A copied Facebook or Instagram post</li>
                <li>· A photo of a street poster — drag it in, or paste it</li>
                <li>· Both together: the poster plus what you know</li>
              </ul>
            </div>
          )}

          {messages.map((message, index) => (
            <div
              key={index}
              className={message.role === 'user' ? 'flex justify-end' : 'flex justify-start'}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm ${
                  message.role === 'user'
                    ? 'bg-flame-500/15 text-white'
                    : 'border border-white/[0.08] bg-white/[0.03] text-white/85'
                }`}
              >
                {message.images && message.images.length > 0 && (
                  <div className="mb-2.5 flex flex-wrap gap-2">
                    {message.images.map((url) => (
                      <span
                        key={url}
                        className="relative block h-24 w-20 overflow-hidden rounded-lg border border-white/10 bg-black/30"
                      >
                        <Image
                          src={url}
                          alt="Attached poster"
                          fill
                          sizes="80px"
                          className="object-cover"
                          unoptimized
                        />
                      </span>
                    ))}
                  </div>
                )}
                <p className="whitespace-pre-wrap leading-relaxed">{message.content}</p>
                {message.tools && message.tools.length > 0 && (
                  <div className="mt-2.5 flex flex-wrap gap-1.5 border-t border-white/[0.06] pt-2.5">
                    {[...new Set(message.tools)].map((toolName) => (
                      <span
                        key={toolName}
                        className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[11px] text-white/50"
                      >
                        {TOOL_LABELS[toolName] ?? toolName}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}

          {busy && (
            <div className="flex items-center gap-2 text-sm text-white/45">
              <Loader2 className="h-4 w-4 animate-spin" />
              Working — reading, matching, checking for duplicates…
            </div>
          )}

          {error && (
            <div className="rounded-xl border border-flame-500/30 bg-flame-500/10 px-4 py-3 text-sm text-flame-200">
              {error}
            </div>
          )}

          <div ref={endRef} />
        </div>

        <div
          className={`border-t p-4 transition ${
            dragging ? 'border-flame-500/40 bg-flame-500/[0.06]' : 'border-white/[0.08]'
          }`}
          onDragOver={(e) => {
            e.preventDefault()
            setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault()
            setDragging(false)
            void addFiles([...e.dataTransfer.files])
          }}
        >
          {(pending.length > 0 || uploading) && (
            <div className="mb-3 flex flex-wrap items-center gap-2">
              {pending.map((url) => (
                <span
                  key={url}
                  className="group relative block h-20 w-16 overflow-hidden rounded-lg border border-white/10 bg-black/30"
                >
                  <Image src={url} alt="Staged poster" fill sizes="64px" className="object-cover" unoptimized />
                  <button
                    type="button"
                    onClick={() => setPending((p) => p.filter((u) => u !== url))}
                    aria-label="Remove image"
                    className="absolute right-0.5 top-0.5 rounded-full bg-black/70 p-1 text-white/80 opacity-0 transition group-hover:opacity-100 focus:opacity-100"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
              {uploading && (
                <span className="inline-flex h-20 w-16 items-center justify-center rounded-lg border border-dashed border-white/15">
                  <Loader2 className="h-4 w-4 animate-spin text-white/40" />
                </span>
              )}
            </div>
          )}

          <textarea
            rows={3}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onPaste={(e) => {
              const files = [...e.clipboardData.files]
              if (files.some((f) => f.type.startsWith('image/'))) {
                e.preventDefault()
                void addFiles(files)
              }
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                void send()
              }
            }}
            disabled={busy}
            placeholder={PLACEHOLDER}
            className="w-full resize-none rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-3 text-sm text-white placeholder:text-white/25 focus:border-flame-500/40 focus:outline-none disabled:opacity-50"
          />

          {uploadError && (
            <p className="mt-1.5 text-[12px] text-flame-300">{uploadError}</p>
          )}

          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/avif"
            multiple
            hidden
            onChange={(e) => {
              void addFiles([...(e.target.files ?? [])])
              e.target.value = ''
            }}
          />
          <div className="mt-2 flex items-center justify-between gap-3">
            <span className="inline-flex items-center gap-1.5 text-[11px] text-white/35">
              <CornerDownLeft className="h-3 w-3" />
              Enter to send · drag, paste or attach a poster
              {tokens > 0 && <span className="ml-2">· {tokens.toLocaleString()} tokens</span>}
            </span>
            <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={busy || uploading}
              title="Attach a poster"
              className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.04] px-3 py-2 text-sm font-semibold text-white/75 transition hover:bg-white/[0.08] hover:text-white disabled:opacity-40"
            >
              <ImagePlus className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => void send()}
              disabled={busy || uploading || (!input.trim() && pending.length === 0)}
              className="inline-flex items-center gap-1.5 rounded-full bg-flame-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-flame-400 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
              Send
            </button>
            </div>
          </div>
        </div>
      </div>

      {/* ---- Live draft ---- */}
      <aside className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 lg:sticky lg:top-6 lg:self-start">
        <h2 className="text-sm font-semibold text-white">Draft</h2>
        <p className="mt-1 text-[12px] text-white/45">
          Read-only here. Edit and publish in the wizard.
        </p>

        {draft?.gallery_urls && draft.gallery_urls.length > 0 && (
          <div className="mt-4">
            <div className="relative aspect-[4/3] w-full overflow-hidden rounded-xl border border-white/10 bg-black/30">
              <Image
                src={draft.gallery_urls[0]}
                alt="Event cover"
                fill
                sizes="360px"
                className="object-cover"
                unoptimized
              />
            </div>
            <p className="mt-1.5 text-[11px] text-white/35">
              Cover{draft.gallery_urls.length > 1 ? ` · +${draft.gallery_urls.length - 1} more` : ''}
            </p>
          </div>
        )}

        <dl className="mt-4 space-y-0.5">
          <Field label="Title" value={draft?.title} />
          <Field label="Date" value={draft?.date} />
          <Field label="Time" value={draft?.time} />
          <Field label="Venue" value={draft?.venue_name} />
          <Field label="City" value={draft?.city} />
          <Field label="Address" value={draft?.address} />
          <Field label="Category" value={draft?.category} />
          <Field label="Price" value={draft?.price} />
          <Field
            label="Tickets"
            value={
              draft?.ticket_mode === 'external'
                ? (draft.ticket_url || 'link missing')
                : draft?.ticket_mode === 'albago'
                  ? 'on AlbaGo'
                  : ''
            }
          />
          <Field label="Organizer" value={draft?.organizer_name} />
          <Field
            label="Coordinates"
            value={draft?.lat != null && draft?.lng != null ? 'found' : ''}
          />
          <Field label="Translations" value={draft?.title_i18n ? '4 languages' : ''} />
        </dl>

        <button
          type="button"
          onClick={openInWizard}
          disabled={!canOpen}
          title={canOpen ? 'Continue in the event wizard' : 'Needs at least a title and a date'}
          className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full bg-flame-500 px-4 py-2.5 text-sm font-semibold text-white shadow-[0_8px_24px_rgba(238,28,37,0.35)] transition hover:bg-flame-400 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Wand2 className="h-4 w-4" />
          Open in wizard
        </button>
        <p className="mt-2 text-center text-[11px] text-white/35">
          Nothing is published from this screen.
        </p>
      </aside>
    </div>
  )
}

function Field({ label, value }: { label: string; value?: string | null }) {
  const filled = Boolean(value && value.trim())
  return (
    <div className="flex items-baseline gap-3 border-b border-white/[0.05] py-1.5 last:border-0">
      <dt className="w-24 flex-shrink-0 text-[12px] text-white/40">{label}</dt>
      <dd className={`min-w-0 flex-1 break-words text-[13px] ${filled ? 'text-white/90' : 'text-white/25'}`}>
        {filled ? value : '—'}
      </dd>
    </div>
  )
}
