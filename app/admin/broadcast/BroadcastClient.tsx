'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertTriangle,
  Check,
  ExternalLink,
  Loader2,
  Radio,
  RefreshCw,
  Search,
  Send,
} from 'lucide-react'

function InstagramGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 1.366.062 2.633.336 3.608 1.311.975.975 1.249 2.242 1.311 3.608.058 1.266.07 1.646.07 4.85s-.012 3.584-.07 4.85c-.062 1.366-.336 2.633-1.311 3.608-.975.975-2.242 1.249-3.608 1.311-1.266.058-1.646.07-4.85.07s-3.584-.012-4.85-.07c-1.366-.062-2.633-.336-3.608-1.311-.975-.975-1.249-2.242-1.311-3.608C2.175 15.584 2.163 15.204 2.163 12s.012-3.584.07-4.85c.062-1.366.336-2.633 1.311-3.608.975-.975 2.242-1.249 3.608-1.311 1.266-.058 1.646-.07 4.85-.07Zm0 3.905a5.13 5.13 0 1 1 0 10.26 5.13 5.13 0 0 1 0-10.26Zm0 1.802a3.328 3.328 0 1 0 0 6.656 3.328 3.328 0 0 0 0-6.656Zm5.338-3.205a1.2 1.2 0 1 1 0 2.399 1.2 1.2 0 0 1 0-2.4Z" />
    </svg>
  )
}
import { createClient } from '@/lib/supabase/browser'
import { getLocationBySlug } from '@/lib/locations'
import { buildCaption } from '@/lib/share/captions'
import { generateQrDataUrl } from '@/lib/share/qr'
import { captureNodePng } from '@/lib/share/captureNode'
import type { ShareEventData } from '@/lib/share/types'
import SquareShareTemplate from '@/components/share/templates/SquareShareTemplate'
import StoryShareTemplate from '@/components/share/templates/StoryShareTemplate'

type BroadcastAccount = {
  id: string
  platform: string
  label: string
  handle: string | null
  status: string
  created_at: string
}

type BroadcastPost = {
  id: string
  kind: string
  caption: string
  status: string
  external_url: string | null
  error: string | null
  created_at: string
  published_at: string | null
  event_title: string | null
  account_label: string | null
}

type PickerEvent = {
  id: string
  title: string
  slug: string
  category: string
  date: string
  time: string | null
  end_time: string | null
  address: string | null
  country: string
  location_slug: string
  is_civic: boolean | null
  organizer_name: string | null
}

type PostKind = 'image' | 'story'

function eventToShareData(event: PickerEvent): ShareEventData {
  const location = getLocationBySlug(event.location_slug)
  return {
    title: event.title,
    slug: event.slug,
    category: event.category,
    city: location?.label ?? event.location_slug,
    country: event.country || null,
    address: event.address,
    date: event.date,
    time: event.time,
    endTime: event.end_time,
    organizerName: event.organizer_name,
    isCivic: !!event.is_civic,
    eventUrl: `https://albago.org/events/${event.slug}?utm_source=instagram&utm_medium=broadcast`,
  }
}

async function pngToJpegBlob(pngDataUrl: string, width: number, height: number): Promise<Blob> {
  const img = new Image()
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve()
    img.onerror = () => reject(new Error('capture decode failed'))
    img.src = pngDataUrl
  })
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('canvas unavailable')
  ctx.fillStyle = '#050505'
  ctx.fillRect(0, 0, width, height)
  ctx.drawImage(img, 0, 0, width, height)
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/jpeg', 0.92),
  )
  if (!blob) throw new Error('jpeg encode failed')
  return blob
}

function statusPill(status: string) {
  if (status === 'published') return 'border-emerald-500/25 bg-emerald-500/10 text-emerald-300'
  if (status === 'failed') return 'border-red-500/25 bg-red-500/10 text-red-300'
  if (status === 'publishing') return 'border-amber-500/25 bg-amber-500/10 text-amber-300'
  return 'border-white/15 bg-white/[0.05] text-white/70'
}

export default function BroadcastClient({
  connected,
  connectError,
}: {
  connected: string | null
  connectError: string | null
}) {
  const supabase = useMemo(() => createClient(), [])

  const [accounts, setAccounts] = useState<BroadcastAccount[]>([])
  const [accountsLoaded, setAccountsLoaded] = useState(false)
  const [posts, setPosts] = useState<BroadcastPost[]>([])
  const [events, setEvents] = useState<PickerEvent[]>([])
  const [search, setSearch] = useState('')

  const [selectedEvent, setSelectedEvent] = useState<PickerEvent | null>(null)
  const [kind, setKind] = useState<PostKind>('image')
  const [caption, setCaption] = useState('')
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)
  const [publishState, setPublishState] = useState<
    | { name: 'idle' }
    | { name: 'working'; step: string }
    | { name: 'done'; url: string | null }
    | { name: 'error'; message: string }
  >({ name: 'idle' })

  const squareRef = useRef<HTMLDivElement | null>(null)
  const storyRef = useRef<HTMLDivElement | null>(null)

  const shareData = useMemo(
    () => (selectedEvent ? eventToShareData(selectedEvent) : null),
    [selectedEvent],
  )

  const loadAccounts = useCallback(async () => {
    const { data, error } = await supabase.rpc('broadcast_list_accounts')
    if (!error) setAccounts((data as BroadcastAccount[]) ?? [])
    setAccountsLoaded(true)
  }, [supabase])

  const loadPosts = useCallback(async () => {
    const { data, error } = await supabase.rpc('broadcast_list_posts', {
      p_limit: 25,
    })
    if (!error) setPosts((data as BroadcastPost[]) ?? [])
  }, [supabase])

  useEffect(() => {
    void loadAccounts()
    void loadPosts()
  }, [loadAccounts, loadPosts])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const today = new Date()
      today.setDate(today.getDate() - 1)
      const { data } = await supabase
        .from('events')
        .select(
          'id,title,slug,category,date,time,end_time,address,country,location_slug,is_civic,organizer_name',
        )
        .eq('status', 'published')
        .gte('date', today.toISOString().slice(0, 10))
        .order('date', { ascending: true })
        .limit(60)
      if (!cancelled) setEvents((data as PickerEvent[]) ?? [])
    })()
    return () => {
      cancelled = true
    }
  }, [supabase])

  // Caption + QR refresh when the selected event changes.
  useEffect(() => {
    if (!shareData) return
    setCaption(buildCaption(shareData))
    setQrDataUrl(null)
    let cancelled = false
    generateQrDataUrl(shareData.eventUrl)
      .then((url) => {
        if (!cancelled) setQrDataUrl(url)
      })
      .catch(() => {
        if (!cancelled) setQrDataUrl(null)
      })
    return () => {
      cancelled = true
    }
  }, [shareData])

  const igAccount = accounts.find(
    (a) => a.platform === 'instagram' && a.status !== 'disabled',
  )

  const filteredEvents = search.trim()
    ? events.filter((e) =>
        e.title.toLowerCase().includes(search.trim().toLowerCase()),
      )
    : events

  const handlePublish = async () => {
    if (!selectedEvent || !shareData || !igAccount) return
    if (publishState.name === 'working') return

    try {
      setPublishState({ name: 'working', step: 'Rendering artwork…' })
      const node = kind === 'story' ? storyRef.current : squareRef.current
      if (!node) throw new Error('template not mounted')
      const width = 1080
      const height = kind === 'story' ? 1920 : 1080
      const png = await captureNodePng(node, { width, height })
      const jpeg = await pngToJpegBlob(png, width, height)

      setPublishState({ name: 'working', step: 'Uploading asset…' })
      const path = `instagram/${selectedEvent.slug}-${kind}-${Date.now()}.jpg`
      const { error: uploadError } = await supabase.storage
        .from('social-assets')
        .upload(path, jpeg, { contentType: 'image/jpeg' })
      if (uploadError) throw new Error(`upload failed: ${uploadError.message}`)
      const {
        data: { publicUrl },
      } = supabase.storage.from('social-assets').getPublicUrl(path)

      setPublishState({ name: 'working', step: 'Queueing post…' })
      const { data: postId, error: createError } = await supabase.rpc(
        'broadcast_create_post',
        {
          p_event_id: selectedEvent.id,
          p_account_id: igAccount.id,
          p_kind: kind,
          p_caption: kind === 'story' ? '' : caption,
          p_asset_urls: [publicUrl],
        },
      )
      if (createError || !postId) {
        throw new Error(createError?.message ?? 'could not queue the post')
      }

      setPublishState({ name: 'working', step: 'Publishing to Instagram…' })
      const res = await fetch('/api/broadcast/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postId }),
      })
      const payload = (await res.json()) as {
        ok: boolean
        externalUrl?: string | null
        error?: string
      }
      if (!payload.ok) throw new Error(payload.error ?? 'publish failed')

      setPublishState({ name: 'done', url: payload.externalUrl ?? null })
      void loadPosts()
    } catch (err) {
      setPublishState({
        name: 'error',
        message: err instanceof Error ? err.message : 'publish failed',
      })
      void loadPosts()
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04]">
          <Radio className="h-5 w-5 text-flame-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">Broadcast</h1>
          <p className="text-sm text-white/50">
            Publish events straight to AlbaGo&apos;s social channels. Admin-only.
          </p>
        </div>
      </div>

      {connected && (
        <p className="rounded-2xl border border-emerald-500/25 bg-emerald-500/[0.07] px-4 py-3 text-sm text-emerald-200">
          <Check className="mr-1.5 inline h-4 w-4" />
          {connected === 'instagram' ? 'Instagram connected.' : 'Account connected.'}
        </p>
      )}
      {connectError && (
        <p className="rounded-2xl border border-red-500/25 bg-red-500/[0.07] px-4 py-3 text-sm text-red-200">
          <AlertTriangle className="mr-1.5 inline h-4 w-4" />
          {connectError === 'no_ig_account'
            ? 'No Instagram professional account found on your Facebook Pages. Link the IG account to a Page, then reconnect.'
            : connectError === 'meta_env_missing'
              ? 'META_APP_ID / META_APP_SECRET are not configured on the server.'
              : `Connection failed (${connectError}). Try again.`}
        </p>
      )}

      {/* Accounts */}
      <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-white/60">
            Accounts
          </h2>
          <a
            href="/api/broadcast/meta/start"
            className="inline-flex items-center gap-2 rounded-full bg-flame-500 px-4 py-2 text-xs font-semibold text-white transition hover:bg-flame-400"
          >
            <InstagramGlyph className="h-3.5 w-3.5" />
            {igAccount ? 'Reconnect Instagram' : 'Connect Instagram'}
          </a>
        </div>
        <div className="mt-4 space-y-2">
          {!accountsLoaded ? (
            <p className="text-sm text-white/40">Loading…</p>
          ) : accounts.length === 0 ? (
            <p className="text-sm text-white/40">
              No accounts connected yet. Connect Instagram to start posting.
            </p>
          ) : (
            accounts.map((a) => (
              <div
                key={a.id}
                className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  <InstagramGlyph className="h-4 w-4 text-pink-400" />
                  <div>
                    <p className="text-sm font-semibold text-white">{a.label}</p>
                    <p className="text-xs text-white/45 capitalize">{a.platform}</p>
                  </div>
                </div>
                <span
                  className={`rounded-full border px-3 py-1 text-xs font-semibold ${statusPill(
                    a.status === 'connected' ? 'published' : 'failed',
                  )}`}
                >
                  {a.status}
                </span>
              </div>
            ))
          )}
        </div>
      </section>

      {/* Composer */}
      <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-white/60">
          Compose
        </h2>

        <div className="mt-4 grid gap-5 lg:grid-cols-2">
          <div>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search upcoming published events…"
                className="w-full rounded-2xl border border-white/10 bg-ink-900 py-2.5 pl-10 pr-4 text-sm text-white placeholder:text-white/30 focus:border-flame-500/50 focus:outline-none"
              />
            </div>
            <div className="mt-3 max-h-72 space-y-1.5 overflow-y-auto pr-1">
              {filteredEvents.length === 0 ? (
                <p className="py-6 text-center text-sm text-white/35">
                  No upcoming published events found.
                </p>
              ) : (
                filteredEvents.map((event) => (
                  <button
                    key={event.id}
                    type="button"
                    onClick={() => {
                      setSelectedEvent(event)
                      setPublishState({ name: 'idle' })
                    }}
                    className={`w-full rounded-2xl border px-4 py-2.5 text-left transition ${
                      selectedEvent?.id === event.id
                        ? 'border-flame-500/50 bg-flame-500/[0.08]'
                        : 'border-white/10 bg-white/[0.02] hover:bg-white/[0.05]'
                    }`}
                  >
                    <p className="truncate text-sm font-semibold text-white">
                      {event.title}
                    </p>
                    <p className="mt-0.5 text-xs font-bold text-flame-400">
                      {event.date}
                      {event.time ? ` · ${event.time}` : ''}
                      <span className="ml-2 font-normal capitalize text-white/45">
                        {event.category}
                      </span>
                    </p>
                  </button>
                ))
              )}
            </div>
          </div>

          <div>
            {!selectedEvent ? (
              <p className="rounded-2xl border border-dashed border-white/15 px-5 py-10 text-center text-sm text-white/40">
                Pick an event to compose its Instagram post.
              </p>
            ) : (
              <div className="space-y-4">
                <div className="flex gap-2">
                  {(
                    [
                      { value: 'image', label: 'Feed post · 1:1' },
                      { value: 'story', label: 'Story · 9:16' },
                    ] as const
                  ).map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setKind(opt.value)}
                      className={`rounded-full px-4 py-2 text-xs font-semibold transition ${
                        kind === opt.value
                          ? 'bg-flame-500 text-white'
                          : 'border border-white/12 bg-white/[0.04] text-white/70 hover:bg-white/[0.08]'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>

                {kind === 'image' && (
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-white/50">
                      Caption
                    </label>
                    <textarea
                      value={caption}
                      onChange={(e) => setCaption(e.target.value)}
                      rows={7}
                      className="w-full resize-y rounded-2xl border border-white/10 bg-ink-900 px-4 py-3 text-sm leading-6 text-white focus:border-flame-500/50 focus:outline-none"
                      spellCheck={false}
                    />
                  </div>
                )}
                {kind === 'story' && (
                  <p className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-xs text-white/55">
                    Stories carry no caption — the artwork includes the event
                    details and a QR code back to AlbaGo.
                  </p>
                )}

                {!igAccount ? (
                  <p className="rounded-2xl border border-amber-500/25 bg-amber-500/[0.07] px-4 py-3 text-sm text-amber-200">
                    Connect Instagram above before publishing.
                  </p>
                ) : (
                  <button
                    type="button"
                    onClick={handlePublish}
                    disabled={publishState.name === 'working' || !qrDataUrl}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-flame-500 px-6 py-3.5 text-sm font-bold text-white transition hover:bg-flame-400 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {publishState.name === 'working' ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        {publishState.step}
                      </>
                    ) : (
                      <>
                        <Send className="h-4 w-4" />
                        Publish to Instagram now
                      </>
                    )}
                  </button>
                )}

                {publishState.name === 'done' && (
                  <p className="rounded-2xl border border-emerald-500/25 bg-emerald-500/[0.07] px-4 py-3 text-sm text-emerald-200">
                    <Check className="mr-1.5 inline h-4 w-4" />
                    Published.
                    {publishState.url && (
                      <a
                        href={publishState.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ml-2 inline-flex items-center gap-1 font-semibold underline"
                      >
                        View on Instagram
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </p>
                )}
                {publishState.name === 'error' && (
                  <p className="rounded-2xl border border-red-500/25 bg-red-500/[0.07] px-4 py-3 text-sm text-red-200">
                    <AlertTriangle className="mr-1.5 inline h-4 w-4" />
                    {publishState.message}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Recent posts */}
      <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-white/60">
            Recent posts
          </h2>
          <button
            type="button"
            onClick={() => void loadPosts()}
            className="inline-flex items-center gap-1.5 rounded-full border border-white/12 bg-white/[0.04] px-3.5 py-1.5 text-xs font-semibold text-white/70 transition hover:bg-white/[0.08]"
          >
            <RefreshCw className="h-3 w-3" />
            Refresh
          </button>
        </div>
        <div className="mt-4 space-y-2">
          {posts.length === 0 ? (
            <p className="text-sm text-white/40">Nothing published yet.</p>
          ) : (
            posts.map((post) => (
              <div
                key={post.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-white">
                    {post.event_title ?? 'Untitled event'}
                    <span className="ml-2 text-xs font-normal capitalize text-white/45">
                      {post.kind} · {post.account_label ?? 'account'}
                    </span>
                  </p>
                  {post.error && (
                    <p className="mt-0.5 truncate text-xs text-red-300">{post.error}</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`rounded-full border px-3 py-1 text-xs font-semibold ${statusPill(post.status)}`}
                  >
                    {post.status}
                  </span>
                  {post.external_url && (
                    <a
                      href={post.external_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 rounded-full border border-white/12 bg-white/[0.04] px-3 py-1 text-xs font-semibold text-white/75 transition hover:bg-white/[0.08]"
                    >
                      View
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      {/* Off-screen render targets for capture. */}
      {shareData && (
        <div
          aria-hidden
          style={{
            position: 'fixed',
            top: 0,
            left: -100000,
            width: 1080,
            pointerEvents: 'none',
          }}
        >
          <SquareShareTemplate data={shareData} qrDataUrl={qrDataUrl} innerRef={squareRef} />
          <StoryShareTemplate
            data={shareData}
            qrDataUrl={qrDataUrl}
            innerRef={storyRef}
            backdropUrl={null}
          />
        </div>
      )}
    </div>
  )
}
