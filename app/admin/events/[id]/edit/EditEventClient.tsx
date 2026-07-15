'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  ChevronDown,
  Flame,
  Globe2,
  ImageIcon,
  Link as LinkIcon,
  MapPin,
  Save,
  Trash2,
  UploadCloud,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/browser'
import LocationAutocomplete, {
  type ResolvedAddress,
} from '@/components/location/LocationAutocomplete'
import { useImageUpload } from '@/hooks/useImageUpload'

type OrganizerSocials = {
  instagram?: string
  facebook?: string
  tiktok?: string
  twitter?: string
}

export type EditableEvent = {
  id: string
  slug: string
  title: string
  description: string
  category: string
  date: string
  time: string | null
  end_time: string | null
  timezone: string | null
  price: string | null
  highlight: boolean | null
  status: string
  location_slug: string
  country: string
  region: string | null
  lat: number | null
  lng: number | null
  address: string | null
  is_online: boolean | null
  online_url: string | null
  tags: string[] | null
  language: string | null
  banner_url: string | null
  admin_note: string | null
  event_type: string | null
  is_civic: boolean | null
  featured_movement_slug: string | null
  organizer_contact: string | null
  organizer_name: string | null
  organizer_phone: string | null
  organizer_website: string | null
  organizer_socials: OrganizerSocials | null
  telegram_link: string | null
  whatsapp_link: string | null
  safety_notes: string | null
  expected_attendees: number | null
  recurrence: string | null
  recurrence_until: string | null
  recurrence_days_of_week: number[] | null
  recurrence_exceptions: string[] | null
  origin: string | null
  organizer_id: string | null
  created_at: string
  updated_at: string | null
}

type FormState = {
  title: string
  description: string
  category: string
  date: string
  time: string
  end_time: string
  timezone: string
  price: string
  highlight: boolean
  status: string
  location_slug: string
  country: string
  region: string
  lat: string
  lng: string
  address: string
  is_online: boolean
  online_url: string
  tagsRaw: string
  language: string
  banner_url: string
  admin_note: string
  event_type: string
  is_civic: boolean
  featured_movement_slug: string
  organizer_contact: string
  organizer_name: string
  organizer_phone: string
  organizer_website: string
  social_instagram: string
  social_facebook: string
  social_tiktok: string
  social_twitter: string
  telegram_link: string
  whatsapp_link: string
  safety_notes: string
  expected_attendees: string
  recurrence: 'none' | 'daily' | 'weekly'
  recurrence_until: string
  recurrence_dow: number[]
}

const STATUS_OPTIONS = [
  { value: 'published', label: 'Published' },
  { value: 'draft', label: 'Draft' },
  { value: 'pending_review', label: 'Pending review' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'cancelled', label: 'Archived' },
  { value: 'completed', label: 'Completed' },
]

const CATEGORY_OPTIONS = ['nightlife', 'music', 'sports', 'culture', 'food', 'civic']

const LANGUAGE_OPTIONS = [
  { code: 'en', label: 'English' },
  { code: 'sq', label: 'Shqip' },
  { code: 'de', label: 'Deutsch' },
  { code: 'es', label: 'Español' },
  { code: 'it', label: 'Italiano' },
  { code: 'fr', label: 'Français' },
]

function tagsToInput(tags: string[] | null): string {
  if (!tags || tags.length === 0) return ''
  return tags.join(', ')
}

function parseTagsInput(raw: string): string[] {
  return raw
    .split(',')
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean)
}

function tagsEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false
  return true
}

function toFormState(initial: EditableEvent): FormState {
  const socials = initial.organizer_socials ?? {}
  return {
    title: initial.title,
    description: initial.description,
    category: initial.category,
    date: initial.date,
    time: initial.time ?? '',
    end_time: initial.end_time ?? '',
    timezone: initial.timezone ?? 'Europe/Tirane',
    price: initial.price ?? '',
    highlight: !!initial.highlight,
    status: initial.status,
    location_slug: initial.location_slug,
    country: initial.country,
    region: initial.region ?? '',
    lat: initial.lat != null ? String(initial.lat) : '',
    lng: initial.lng != null ? String(initial.lng) : '',
    address: initial.address ?? '',
    is_online: !!initial.is_online,
    online_url: initial.online_url ?? '',
    tagsRaw: tagsToInput(initial.tags),
    language: initial.language ?? 'en',
    banner_url: initial.banner_url ?? '',
    admin_note: initial.admin_note ?? '',
    event_type: initial.event_type ?? '',
    is_civic: !!initial.is_civic,
    featured_movement_slug: initial.featured_movement_slug ?? '',
    organizer_contact: initial.organizer_contact ?? '',
    organizer_name: initial.organizer_name ?? '',
    organizer_phone: initial.organizer_phone ?? '',
    organizer_website: initial.organizer_website ?? '',
    social_instagram: socials.instagram ?? '',
    social_facebook: socials.facebook ?? '',
    social_tiktok: socials.tiktok ?? '',
    social_twitter: socials.twitter ?? '',
    telegram_link: initial.telegram_link ?? '',
    whatsapp_link: initial.whatsapp_link ?? '',
    safety_notes: initial.safety_notes ?? '',
    expected_attendees:
      initial.expected_attendees != null ? String(initial.expected_attendees) : '',
    recurrence:
      (initial.recurrence === 'daily' || initial.recurrence === 'weekly'
        ? initial.recurrence
        : 'none') as FormState['recurrence'],
    recurrence_until: initial.recurrence_until ?? '',
    recurrence_dow: Array.isArray(initial.recurrence_days_of_week)
      ? [...initial.recurrence_days_of_week].sort((a, b) => a - b)
      : [],
  }
}

function diffPatch(initial: EditableEvent, current: FormState): Record<string, unknown> {
  const patch: Record<string, unknown> = {}

  const text = (k: keyof FormState, originalRaw: string | null) => {
    const next = current[k] as string
    const original = (originalRaw ?? '').toString()
    if (next === original) return
    if (next === '' && originalRaw == null) return
    patch[k] = next === '' ? null : next
  }

  const bool = (k: keyof FormState, originalRaw: boolean | null) => {
    const next = current[k] as boolean
    const original = !!originalRaw
    if (next !== original) patch[k] = next
  }

  const num = (k: keyof FormState, originalRaw: number | null, kind: 'int' | 'float') => {
    const raw = (current[k] as string).trim()
    if (raw === '') {
      if (originalRaw != null) patch[k] = null
      return
    }
    const parsed = kind === 'int' ? parseInt(raw, 10) : parseFloat(raw)
    if (Number.isNaN(parsed)) return
    if (parsed !== originalRaw) patch[k] = parsed
  }

  text('title', initial.title)
  text('description', initial.description)
  // A manual edit invalidates the LENS-3 translation packs — display prefers
  // them over the base text, so a stale pack keeps showing the old wording.
  if ('title' in patch) patch.title_i18n = null
  if ('description' in patch) patch.description_i18n = null
  text('category', initial.category)
  text('date', initial.date)
  text('time', initial.time)
  text('end_time', initial.end_time)
  text('timezone', initial.timezone)
  text('price', initial.price)
  text('status', initial.status)
  text('location_slug', initial.location_slug)
  text('country', initial.country)
  text('region', initial.region)
  text('address', initial.address)
  text('online_url', initial.online_url)
  text('language', initial.language)
  text('banner_url', initial.banner_url)
  text('admin_note', initial.admin_note)
  text('event_type', initial.event_type)
  text('featured_movement_slug', initial.featured_movement_slug)
  text('organizer_contact', initial.organizer_contact)
  text('organizer_name', initial.organizer_name)
  text('organizer_phone', initial.organizer_phone)
  text('organizer_website', initial.organizer_website)
  text('telegram_link', initial.telegram_link)
  text('whatsapp_link', initial.whatsapp_link)
  text('safety_notes', initial.safety_notes)

  bool('highlight', initial.highlight)
  bool('is_civic', initial.is_civic)
  bool('is_online', initial.is_online)

  num('lat', initial.lat, 'float')
  num('lng', initial.lng, 'float')
  num('expected_attendees', initial.expected_attendees, 'int')

  // tags — text[] in DB, comma-separated in form. Sent as JSON array.
  {
    const nextTags = parseTagsInput(current.tagsRaw)
    const originalTags = initial.tags ?? []
    if (!tagsEqual(nextTags, originalTags)) {
      patch.tags = nextTags
    }
  }

  // Recurrence — three fields. We don't currently expose exceptions in the
  // edit UI; that ships in a follow-up.
  {
    const initialRec =
      initial.recurrence === 'daily' || initial.recurrence === 'weekly'
        ? initial.recurrence
        : 'none'
    if (current.recurrence !== initialRec) {
      patch.recurrence = current.recurrence
    }
    const nextUntil = current.recurrence_until.trim()
    const origUntil = initial.recurrence_until ?? ''
    if (nextUntil !== origUntil) {
      patch.recurrence_until = nextUntil === '' ? null : nextUntil
    }
    const nextDow = [...current.recurrence_dow].sort((a, b) => a - b)
    const origDow = (initial.recurrence_days_of_week ?? [])
      .slice()
      .sort((a, b) => a - b)
    const dowChanged =
      nextDow.length !== origDow.length ||
      nextDow.some((v, i) => v !== origDow[i])
    if (dowChanged) {
      patch.recurrence_days_of_week = nextDow
    }
  }

  // organizer_socials — jsonb in DB. Build from 4 social inputs.
  {
    const nextSocials: Record<string, string> = {}
    if (current.social_instagram.trim()) nextSocials.instagram = current.social_instagram.trim()
    if (current.social_facebook.trim()) nextSocials.facebook = current.social_facebook.trim()
    if (current.social_tiktok.trim()) nextSocials.tiktok = current.social_tiktok.trim()
    if (current.social_twitter.trim()) nextSocials.twitter = current.social_twitter.trim()
    const originalSocials = (initial.organizer_socials ?? {}) as Record<string, string>
    const allKeys = new Set([...Object.keys(nextSocials), ...Object.keys(originalSocials)])
    let changed = false
    for (const k of allKeys) {
      if ((nextSocials[k] ?? '') !== (originalSocials[k] ?? '')) {
        changed = true
        break
      }
    }
    if (changed) {
      patch.organizer_socials = Object.keys(nextSocials).length ? nextSocials : null
    }
  }

  return patch
}

export default function EditEventClient({ initial }: { initial: EditableEvent }) {
  const supabase = useMemo(() => createClient(), [])
  const router = useRouter()

  const [form, setForm] = useState<FormState>(() => toFormState(initial))
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
    setMessage(null)

    const patch = diffPatch(initial, form)
    if (Object.keys(patch).length === 0) {
      setMessage('No changes to save.')
      return
    }

    setSaving(true)
    const { error: rpcError } = await supabase.rpc('admin_update_event', {
      event_id: initial.id,
      patch,
    })
    setSaving(false)

    if (rpcError) {
      console.error('admin_update_event error:', rpcError)
      if (rpcError.code === '42501') {
        setError(
          'Update not allowed. Has the Phase 11 RPC been applied? See docs/seeds/phase-11-admin-event-update.sql.',
        )
        return
      }
      setError(rpcError.message)
      return
    }

    setMessage('Saved.')
    router.refresh()
  }

  const deleteEvent = async () => {
    if (
      !window.confirm(
        `Permanently delete "${initial.title}"? This cannot be undone.`,
      )
    ) {
      return
    }
    setError(null)
    setMessage(null)
    setSaving(true)
    const { error: deleteError } = await supabase
      .from('events')
      .delete()
      .eq('id', initial.id)
    setSaving(false)
    if (deleteError) {
      console.error('events delete error:', deleteError)
      if (deleteError.code === '42501') {
        setError('Delete not allowed. Check the events_admin_write RLS policy.')
        return
      }
      setError(`Delete failed: ${deleteError.message}`)
      return
    }
    router.push('/admin/events')
  }

  const quickStatus = async (status: string, label: string) => {
    setError(null)
    setMessage(null)
    setSaving(true)
    const { error: rpcError } = await supabase.rpc('admin_update_event', {
      event_id: initial.id,
      patch: { status },
    })
    setSaving(false)
    if (rpcError) {
      console.error('admin_update_event error:', rpcError)
      setError(`${label} failed: ${rpcError.message}`)
      return
    }
    setForm((prev) => ({ ...prev, status }))
    setMessage(`${label} succeeded.`)
    router.refresh()
  }

  return (
    <div className="mx-auto max-w-3xl">
      <Link
        href="/admin/events"
        className="mb-3 inline-flex items-center gap-2 text-sm text-white/55 transition hover:text-white"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to events
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Edit event</h1>
          <p className="mt-1 text-sm text-white/55">
            Public slug: <span className="font-mono text-white/70">{initial.slug}</span>
          </p>
          <p className="mt-0.5 text-xs text-white/40">
            origin: {initial.origin ?? '—'} · organizer:{' '}
            {initial.organizer_id ? 'yes' : 'no'} · created {new Date(initial.created_at).toLocaleString()}
          </p>
        </div>

        <Link
          href={`/events/${initial.slug}`}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-semibold text-white/85 transition hover:bg-white/[0.08] hover:text-white"
        >
          Preview
        </Link>
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        {form.status !== 'published' && (
          <button
            type="button"
            disabled={saving}
            onClick={() => quickStatus('published', 'Publish')}
            className="rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-40"
          >
            Publish
          </button>
        )}
        {form.status === 'published' && (
          <button
            type="button"
            disabled={saving}
            onClick={() => quickStatus('draft', 'Unpublish')}
            className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-semibold text-white/80 transition hover:bg-white/[0.08] disabled:opacity-40"
          >
            Unpublish
          </button>
        )}
        {form.status !== 'cancelled' && (
          <button
            type="button"
            disabled={saving}
            onClick={() => quickStatus('cancelled', 'Archive')}
            className="rounded-full border border-red-500/30 bg-red-500/[0.08] px-4 py-2 text-sm font-semibold text-red-200 transition hover:bg-red-500/15 disabled:opacity-40"
          >
            Archive
          </button>
        )}
        {form.status === 'cancelled' && (
          <button
            type="button"
            disabled={saving}
            onClick={() => quickStatus('draft', 'Restore')}
            className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-semibold text-white/80 transition hover:bg-white/[0.08] disabled:opacity-40"
          >
            Restore to draft
          </button>
        )}

        <button
          type="button"
          disabled={saving}
          onClick={deleteEvent}
          className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm font-semibold text-red-100 transition hover:bg-red-500/20 disabled:opacity-40"
          title="Permanently delete this event"
        >
          <Trash2 className="h-3.5 w-3.5" />
          Delete
        </button>
      </div>

      {message && (
        <div className="mt-5 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-100">
          {message}
        </div>
      )}
      {error && (
        <div className="mt-5 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-100">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="mt-6 space-y-5">
        <Section title="Basics">
          <Field label="Title" htmlFor="f-title">
            <input
              id="f-title"
              type="text"
              value={form.title}
              onChange={(e) => setField('title', e.target.value)}
              required
              className="input"
            />
          </Field>

          <Field label="Description" htmlFor="f-description">
            <textarea
              id="f-description"
              value={form.description}
              onChange={(e) => setField('description', e.target.value)}
              rows={5}
              required
              className="input resize-y"
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-4">
            <Field label="Date" htmlFor="f-date">
              <input
                id="f-date"
                type="date"
                value={form.date}
                onChange={(e) => setField('date', e.target.value)}
                required
                className="input"
              />
            </Field>
            <Field label="Start time" htmlFor="f-time">
              <input
                id="f-time"
                type="text"
                value={form.time}
                onChange={(e) => setField('time', e.target.value)}
                placeholder="22:00"
                className="input"
              />
            </Field>
            <Field label="End time" htmlFor="f-end-time">
              <input
                id="f-end-time"
                type="text"
                value={form.end_time}
                onChange={(e) => setField('end_time', e.target.value)}
                placeholder="02:00"
                className="input"
              />
            </Field>
            <Field label="Price" htmlFor="f-price">
              <input
                id="f-price"
                type="text"
                value={form.price}
                onChange={(e) => setField('price', e.target.value)}
                placeholder="Free / 500 ALL / €10"
                className="input"
              />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Timezone (IANA)" htmlFor="f-tz">
              <input
                id="f-tz"
                type="text"
                value={form.timezone}
                onChange={(e) => setField('timezone', e.target.value)}
                placeholder="Europe/Tirane"
                className="input font-mono"
              />
            </Field>
            <Field label="Language" htmlFor="f-lang">
              <select
                id="f-lang"
                value={form.language}
                onChange={(e) => setField('language', e.target.value)}
                className="input"
              >
                {LANGUAGE_OPTIONS.map((l) => (
                  <option key={l.code} value={l.code} className="bg-ink-900">
                    {l.label}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <RecurrenceEditor form={form} setField={setField} />

          <Field label="Tags (comma-separated)" htmlFor="f-tags">
            <input
              id="f-tags"
              type="text"
              value={form.tagsRaw}
              onChange={(e) => setField('tagsRaw', e.target.value)}
              placeholder="free, family-friendly, outdoors"
              className="input"
            />
            <p className="mt-1 text-xs text-white/40">
              Lowercased automatically. GIN-indexed for filtering on /events.
            </p>
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Category" htmlFor="f-category">
              <select
                id="f-category"
                value={form.category}
                onChange={(e) => setField('category', e.target.value)}
                className="input"
              >
                {CATEGORY_OPTIONS.map((c) => (
                  <option key={c} value={c} className="bg-ink-900">
                    {c}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Status" htmlFor="f-status">
              <select
                id="f-status"
                value={form.status}
                onChange={(e) => setField('status', e.target.value)}
                className="input"
              >
                {STATUS_OPTIONS.map((s) => (
                  <option key={s.value} value={s.value} className="bg-ink-900">
                    {s.label}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <label className="flex items-center gap-3 text-sm text-white/80">
            <input
              type="checkbox"
              checked={form.highlight}
              onChange={(e) => setField('highlight', e.target.checked)}
              className="h-4 w-4 rounded border-white/15 bg-white/[0.04]"
            />
            Highlight on homepage
          </label>
        </Section>

        <Section title="Location">
          <LocationEditor form={form} setField={setField} />
        </Section>

        <Section title="Media & moderation">
          <BannerEditor
            bannerUrl={form.banner_url}
            onChange={(url) => setField('banner_url', url)}
          />
          <Field
            label="Admin note (visible to owning organizer)"
            htmlFor="f-note"
          >
            <textarea
              id="f-note"
              value={form.admin_note}
              onChange={(e) => setField('admin_note', e.target.value)}
              rows={2}
              className="input resize-y"
            />
          </Field>
        </Section>

        <Section title="Organizer">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Organizer name" htmlFor="f-org-name">
              <input
                id="f-org-name"
                type="text"
                value={form.organizer_name}
                onChange={(e) => setField('organizer_name', e.target.value)}
                className="input"
              />
            </Field>
            <Field label="Organizer phone" htmlFor="f-org-phone">
              <input
                id="f-org-phone"
                type="tel"
                value={form.organizer_phone}
                onChange={(e) => setField('organizer_phone', e.target.value)}
                className="input"
              />
            </Field>
          </div>
          <Field label="Organizer website" htmlFor="f-org-web">
            <input
              id="f-org-web"
              type="url"
              value={form.organizer_website}
              onChange={(e) => setField('organizer_website', e.target.value)}
              placeholder="https://..."
              className="input"
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Instagram" htmlFor="f-soc-ig">
              <input
                id="f-soc-ig"
                type="text"
                value={form.social_instagram}
                onChange={(e) => setField('social_instagram', e.target.value)}
                placeholder="@yourhandle"
                className="input"
              />
            </Field>
            <Field label="Facebook" htmlFor="f-soc-fb">
              <input
                id="f-soc-fb"
                type="text"
                value={form.social_facebook}
                onChange={(e) => setField('social_facebook', e.target.value)}
                placeholder="facebook.com/your.page"
                className="input"
              />
            </Field>
            <Field label="TikTok" htmlFor="f-soc-tt">
              <input
                id="f-soc-tt"
                type="text"
                value={form.social_tiktok}
                onChange={(e) => setField('social_tiktok', e.target.value)}
                placeholder="@yourhandle"
                className="input"
              />
            </Field>
            <Field label="X / Twitter" htmlFor="f-soc-tw">
              <input
                id="f-soc-tw"
                type="text"
                value={form.social_twitter}
                onChange={(e) => setField('social_twitter', e.target.value)}
                placeholder="@yourhandle"
                className="input"
              />
            </Field>
          </div>
        </Section>

        <Section
          title={
            <>
              Civic / protest <Flame className="inline h-4 w-4 text-flame-400" />
            </>
          }
        >
          <label className="flex items-center gap-3 text-sm text-white/80">
            <input
              type="checkbox"
              checked={form.is_civic}
              onChange={(e) => setField('is_civic', e.target.checked)}
              className="h-4 w-4 rounded border-white/15 bg-white/[0.04]"
            />
            This is a civic gathering / protest
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Event type" htmlFor="f-etype">
              <input
                id="f-etype"
                type="text"
                value={form.event_type}
                onChange={(e) => setField('event_type', e.target.value)}
                placeholder="protest / march / vigil"
                className="input"
              />
            </Field>
            <Field label="Featured movement slug" htmlFor="f-movement">
              <input
                id="f-movement"
                type="text"
                value={form.featured_movement_slug}
                onChange={(e) => setField('featured_movement_slug', e.target.value)}
                placeholder="albanian-revolution"
                className="input font-mono"
              />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Organizer contact (email / phone)" htmlFor="f-contact">
              <input
                id="f-contact"
                type="text"
                value={form.organizer_contact}
                onChange={(e) => setField('organizer_contact', e.target.value)}
                className="input"
              />
            </Field>
            <Field label="Expected attendees" htmlFor="f-attendees">
              <input
                id="f-attendees"
                type="number"
                min={0}
                max={5_000_000}
                value={form.expected_attendees}
                onChange={(e) => setField('expected_attendees', e.target.value)}
                className="input font-mono"
              />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Telegram link" htmlFor="f-tg">
              <input
                id="f-tg"
                type="url"
                value={form.telegram_link}
                onChange={(e) => setField('telegram_link', e.target.value)}
                placeholder="https://t.me/..."
                className="input"
              />
            </Field>
            <Field label="WhatsApp link" htmlFor="f-wa">
              <input
                id="f-wa"
                type="url"
                value={form.whatsapp_link}
                onChange={(e) => setField('whatsapp_link', e.target.value)}
                placeholder="https://chat.whatsapp.com/..."
                className="input"
              />
            </Field>
          </div>

          <Field label="Safety notes" htmlFor="f-safety">
            <textarea
              id="f-safety"
              value={form.safety_notes}
              onChange={(e) => setField('safety_notes', e.target.value)}
              rows={3}
              className="input resize-y"
            />
          </Field>
        </Section>

        <div className="sticky bottom-3 z-10 -mx-2 flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-full bg-flame-500 px-6 py-3 text-sm font-semibold text-white shadow-[0_8px_30px_rgba(238,28,37,0.35)] transition hover:bg-flame-400 disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            {saving ? 'Saving...' : 'Save changes'}
          </button>
        </div>
      </form>

      <style jsx>{`
        :global(.input) {
          width: 100%;
          border-radius: 1rem;
          border: 1px solid rgba(255, 255, 255, 0.1);
          background: rgba(255, 255, 255, 0.04);
          color: white;
          padding: 0.625rem 0.875rem;
          font-size: 0.875rem;
          outline: none;
          transition: border-color 0.15s;
        }
        :global(.input:focus) {
          border-color: rgba(255, 255, 255, 0.25);
        }
      `}</style>
    </div>
  )
}

function Section({
  title,
  children,
}: {
  title: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
      <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-white/55">
        {title}
      </h2>
      <div className="mt-4 space-y-4">{children}</div>
    </section>
  )
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string
  htmlFor: string
  children: React.ReactNode
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1.5 block text-xs font-medium text-white/65">
        {label}
      </label>
      {children}
    </div>
  )
}

const EDIT_WEEKDAYS = [
  { iso: 1, short: 'Mon' },
  { iso: 2, short: 'Tue' },
  { iso: 3, short: 'Wed' },
  { iso: 4, short: 'Thu' },
  { iso: 5, short: 'Fri' },
  { iso: 6, short: 'Sat' },
  { iso: 7, short: 'Sun' },
]

function RecurrenceEditor({
  form,
  setField,
}: {
  form: FormState
  setField: <K extends keyof FormState>(key: K, value: FormState[K]) => void
}) {
  const toggleDay = (iso: number) => {
    const set = new Set(form.recurrence_dow)
    if (set.has(iso)) set.delete(iso)
    else set.add(iso)
    setField(
      'recurrence_dow',
      Array.from(set).sort((a, b) => a - b),
    )
  }

  return (
    <div className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.02] p-4">
      <div className="text-xs font-semibold uppercase tracking-[0.16em] text-white/55">
        Repeats?
      </div>

      <div className="inline-flex rounded-full border border-white/10 bg-white/[0.04] p-1">
        {(['none', 'daily', 'weekly'] as const).map((opt) => (
          <button
            key={opt}
            type="button"
            onClick={() => {
              setField('recurrence', opt)
              if (opt === 'none') {
                setField('recurrence_until', '')
                setField('recurrence_dow', [])
              } else if (opt === 'daily') {
                setField('recurrence_dow', [])
              }
            }}
            className={[
              'rounded-full px-4 py-1.5 text-sm font-semibold transition',
              form.recurrence === opt
                ? 'bg-white text-black'
                : 'text-white/65 hover:text-white',
            ].join(' ')}
          >
            {opt === 'none' ? 'One-off' : opt === 'daily' ? 'Daily' : 'Weekly'}
          </button>
        ))}
      </div>

      {form.recurrence === 'weekly' && (
        <div>
          <p className="mb-1.5 text-xs text-white/55">Run weekdays</p>
          <div className="flex flex-wrap gap-1.5">
            {EDIT_WEEKDAYS.map((d) => {
              const active = form.recurrence_dow.includes(d.iso)
              return (
                <button
                  key={d.iso}
                  type="button"
                  onClick={() => toggleDay(d.iso)}
                  className={[
                    'rounded-full border px-3 py-1 text-xs font-semibold transition',
                    active
                      ? 'border-flame-500/40 bg-flame-500/15 text-flame-100'
                      : 'border-white/10 bg-white/[0.04] text-white/65 hover:text-white',
                  ].join(' ')}
                >
                  {d.short}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {form.recurrence !== 'none' && (
        <Field label="Repeat until (optional)" htmlFor="f-rec-until">
          <input
            id="f-rec-until"
            type="date"
            value={form.recurrence_until}
            onChange={(e) => setField('recurrence_until', e.target.value)}
            className="input"
          />
        </Field>
      )}
    </div>
  )
}

function formToResolved(form: FormState): ResolvedAddress | null {
  const latNum = parseFloat(form.lat)
  const lngNum = parseFloat(form.lng)
  if (Number.isNaN(latNum) || Number.isNaN(lngNum)) return null
  return {
    slug: form.location_slug || 'unknown',
    city: null,
    country: form.country || null,
    countryCode: null,
    region: form.region || null,
    address: form.address || null,
    road: null,
    houseNumber: null,
    postcode: null,
    displayName: [form.address, form.location_slug, form.country]
      .filter(Boolean)
      .join(', '),
    lat: latNum,
    lng: lngNum,
    placeId: form.location_slug || `${latNum},${lngNum}`,
    type: null,
  }
}

function LocationEditor({
  form,
  setField,
}: {
  form: FormState
  setField: <K extends keyof FormState>(key: K, value: FormState[K]) => void
}) {
  const [query, setQuery] = useState<string>(
    () => form.address || form.location_slug || '',
  )
  const [resolved, setResolved] = useState<ResolvedAddress | null>(() =>
    formToResolved(form),
  )
  const [advancedOpen, setAdvancedOpen] = useState(false)

  // Keep the resolved view in sync if the raw lat/lng/slug are edited via
  // the Advanced override panel.
  useEffect(() => {
    setResolved((prev) => {
      const next = formToResolved(form)
      if (!next) return null
      if (
        prev &&
        prev.lat === next.lat &&
        prev.lng === next.lng &&
        prev.slug === next.slug
      ) {
        return prev
      }
      return next
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.lat, form.lng, form.location_slug, form.country, form.region, form.address])

  const handleResolve = (next: ResolvedAddress | null) => {
    setResolved(next)
    if (!next) {
      setField('location_slug', '')
      setField('country', '')
      setField('region', '')
      setField('address', '')
      setField('lat', '')
      setField('lng', '')
      return
    }
    setField('location_slug', next.slug || form.location_slug)
    setField('country', next.country ?? form.country)
    setField('region', next.region ?? '')
    setField('address', next.address || next.displayName)
    setField('lat', String(next.lat))
    setField('lng', String(next.lng))
  }

  return (
    <div className="space-y-5">
      {/* Physical / Online toggle */}
      <div className="inline-flex rounded-full border border-white/10 bg-white/[0.04] p-1">
        <button
          type="button"
          onClick={() => setField('is_online', false)}
          className={[
            'inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition',
            !form.is_online ? 'bg-white text-black' : 'text-white/65 hover:text-white',
          ].join(' ')}
        >
          <MapPin className="h-3.5 w-3.5" />
          Physical place
        </button>
        <button
          type="button"
          onClick={() => setField('is_online', true)}
          className={[
            'inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition',
            form.is_online ? 'bg-white text-black' : 'text-white/65 hover:text-white',
          ].join(' ')}
        >
          <Globe2 className="h-3.5 w-3.5" />
          Online
        </button>
      </div>

      {form.is_online ? (
        <div className="space-y-3">
          <label
            htmlFor="f-online-url"
            className="block text-xs font-semibold uppercase tracking-[0.16em] text-white/55"
          >
            Online URL
          </label>
          <div className="relative">
            <LinkIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
            <input
              id="f-online-url"
              type="url"
              value={form.online_url}
              onChange={(e) => setField('online_url', e.target.value)}
              placeholder="https://zoom.us/j/..."
              className="input pl-10"
            />
          </div>

          {/* Even online events get a tagged city for discovery (optional). */}
          <div className="space-y-2 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/55">
              Tag a city (optional)
            </p>
            <p className="text-xs text-white/45">
              Helps people find the event when they browse a city. Skip if it&apos;s
              truly worldwide.
            </p>
            <LocationAutocomplete
              id="f-online-city"
              value={query}
              onChange={setQuery}
              onResolve={handleResolve}
              resolved={resolved}
              placeholder="Search a city..."
              showMap={false}
            />
          </div>
        </div>
      ) : (
        <div>
          <label
            htmlFor="f-where-search"
            className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.16em] text-white/55"
          >
            Address / place
          </label>
          <LocationAutocomplete
            id="f-where-search"
            value={query}
            onChange={setQuery}
            onResolve={handleResolve}
            resolved={resolved}
            placeholder='Search any address (e.g. "Brandenburg Gate, Berlin")'
            mapHeightClass="h-64"
          />
          <p className="mt-2 text-xs text-white/45">
            Drag the pin or click the map to fine-tune the exact spot.
          </p>
        </div>
      )}

      {/* Advanced manual override — useful when autocomplete misses. */}
      <div className="rounded-2xl border border-white/10 bg-white/[0.02]">
        <button
          type="button"
          onClick={() => setAdvancedOpen((v) => !v)}
          className="flex w-full items-center justify-between px-4 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-white/55 transition hover:text-white"
        >
          Advanced — manual override
          <ChevronDown
            className={[
              'h-4 w-4 transition-transform',
              advancedOpen ? 'rotate-180' : '',
            ].join(' ')}
          />
        </button>
        {advancedOpen && (
          <div className="space-y-4 border-t border-white/10 px-4 py-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="City slug" htmlFor="f-loc-slug">
                <input
                  id="f-loc-slug"
                  type="text"
                  value={form.location_slug}
                  onChange={(e) => setField('location_slug', e.target.value)}
                  placeholder="berlin"
                  className="input font-mono"
                />
              </Field>
              <Field label="Country" htmlFor="f-country">
                <input
                  id="f-country"
                  type="text"
                  value={form.country}
                  onChange={(e) => setField('country', e.target.value)}
                  className="input"
                />
              </Field>
            </div>
            <Field label="Street address" htmlFor="f-address">
              <input
                id="f-address"
                type="text"
                value={form.address}
                onChange={(e) => setField('address', e.target.value)}
                placeholder="Rruga Murat Toptani 4, Tirana"
                className="input"
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Region" htmlFor="f-region">
                <input
                  id="f-region"
                  type="text"
                  value={form.region}
                  onChange={(e) => setField('region', e.target.value)}
                  className="input"
                />
              </Field>
              <Field label="Latitude" htmlFor="f-lat">
                <input
                  id="f-lat"
                  type="number"
                  step="any"
                  value={form.lat}
                  onChange={(e) => setField('lat', e.target.value)}
                  className="input font-mono"
                />
              </Field>
              <Field label="Longitude" htmlFor="f-lng">
                <input
                  id="f-lng"
                  type="number"
                  step="any"
                  value={form.lng}
                  onChange={(e) => setField('lng', e.target.value)}
                  className="input font-mono"
                />
              </Field>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function BannerEditor({
  bannerUrl,
  onChange,
}: {
  bannerUrl: string
  onChange: (url: string) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const { upload, uploading, error: uploadError } = useImageUpload('event-covers')
  const [localPreview, setLocalPreview] = useState<string | null>(null)
  const [urlOverrideOpen, setUrlOverrideOpen] = useState(false)

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
      onChange(result.url)
    }
    URL.revokeObjectURL(objectUrl)
    setLocalPreview(null)
    if (inputRef.current) inputRef.current.value = ''
  }

  function handleClear() {
    onChange('')
    if (inputRef.current) inputRef.current.value = ''
  }

  const previewUrl = localPreview || bannerUrl

  return (
    <div className="space-y-3">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/55">
          Cover image
        </p>
        <p className="mt-1 text-xs text-white/45">
          16:9 recommended — JPG, PNG, WebP, or AVIF, up to 8&nbsp;MB.
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
          className="flex w-full flex-col items-center justify-center gap-2 rounded-3xl border border-dashed border-white/15 bg-white/[0.02] p-10 text-center transition hover:border-flame-500/40 hover:bg-flame-500/[0.04] disabled:cursor-not-allowed disabled:opacity-50"
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

      {/* URL-only override — useful for pasting external images. */}
      <div className="rounded-2xl border border-white/10 bg-white/[0.02]">
        <button
          type="button"
          onClick={() => setUrlOverrideOpen((v) => !v)}
          className="flex w-full items-center justify-between px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.16em] text-white/55 transition hover:text-white"
        >
          Paste URL instead
          <ChevronDown
            className={[
              'h-4 w-4 transition-transform',
              urlOverrideOpen ? 'rotate-180' : '',
            ].join(' ')}
          />
        </button>
        {urlOverrideOpen && (
          <div className="border-t border-white/10 px-4 py-3">
            <input
              id="f-banner"
              type="url"
              value={bannerUrl}
              onChange={(e) => onChange(e.target.value)}
              placeholder="https://..."
              className="input"
            />
          </div>
        )}
      </div>
    </div>
  )
}
