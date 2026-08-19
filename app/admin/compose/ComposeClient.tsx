'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowRight,
  CornerDownLeft,
  Loader2,
  RotateCcw,
  Sparkles,
  Wand2,
} from 'lucide-react'
import { seedWizardDraft } from '@/lib/eventDraftFromReading'
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

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages, busy])

  const send = async () => {
    const text = input.trim()
    if (!text || busy) return

    const next: ChatMessage[] = [...messages, { role: 'user', content: text }]
    setMessages(next)
    setInput('')
    setBusy(true)
    setError(null)

    try {
      const res = await fetch('/api/admin/agent', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          messages: next.map(({ role, content }) => ({ role, content })),
          draft,
        }),
      })
      const json = (await res.json().catch(() => null)) as TurnResponse | null

      if (!res.ok || !json?.ok) {
        setError(
          json?.error === 'forbidden'
            ? 'Your admin session expired — reload the page.'
            : 'The agent could not finish that turn. Try again, or rephrase.',
        )
        // Drop the unanswered user turn so a retry doesn't double it up.
        setMessages(messages)
        setInput(text)
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
                <li>· A whole list of events pasted from anywhere</li>
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

        <div className="border-t border-white/[0.08] p-4">
          <textarea
            rows={3}
            value={input}
            onChange={(e) => setInput(e.target.value)}
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
          <div className="mt-2 flex items-center justify-between gap-3">
            <span className="inline-flex items-center gap-1.5 text-[11px] text-white/35">
              <CornerDownLeft className="h-3 w-3" />
              Enter to send · Shift+Enter for a new line
              {tokens > 0 && <span className="ml-2">· {tokens.toLocaleString()} tokens</span>}
            </span>
            <button
              type="button"
              onClick={() => void send()}
              disabled={busy || !input.trim()}
              className="inline-flex items-center gap-1.5 rounded-full bg-flame-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-flame-400 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
              Send
            </button>
          </div>
        </div>
      </div>

      {/* ---- Live draft ---- */}
      <aside className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 lg:sticky lg:top-6 lg:self-start">
        <h2 className="text-sm font-semibold text-white">Draft</h2>
        <p className="mt-1 text-[12px] text-white/45">
          Read-only here. Edit and publish in the wizard.
        </p>

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
