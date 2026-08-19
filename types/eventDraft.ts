import { useCallback, useEffect, useReducer, useState } from 'react'

export const MAX_TICKET_TIERS = 5

/** How long a section heading / blurb may be before the DB trims it. Mirrored
 *  in the set_event_media / set_submission_media RPCs so client and server
 *  agree on the caps. */
export const MAX_SECTION_TITLE = 120
export const MAX_SECTION_BODY = 2000

/**
 * One named photo section on an event page (e.g. "The Venue", "Lineup").
 * Rendered as its own band below the main gallery. `urls` are Supabase Storage
 * photo URLs, ordered; a section with no title, no body and no photos is
 * dropped at submit time.
 */
export type MediaSection = {
  title: string
  body: string
  urls: string[]
}

/**
 * Trim sections for persistence: cap the text fields, keep only real photo
 * URLs, and drop any section that carries neither text nor photos. Shared by
 * every submit path so the DB never stores empty or oversized sections.
 */
export function normalizeSections(sections: MediaSection[]): MediaSection[] {
  return sections
    .map((s) => ({
      title: (s.title ?? '').trim().slice(0, MAX_SECTION_TITLE),
      body: (s.body ?? '').trim().slice(0, MAX_SECTION_BODY),
      urls: (s.urls ?? []).filter((u) => typeof u === 'string' && u.length > 0),
    }))
    .filter((s) => s.title || s.body || s.urls.length > 0)
}

/**
 * One free ticket tier configured inside the wizard (Phase 33). Numbers stay
 * strings while in the form (same rule as expected_attendees); parsed at
 * submit. `id` is set only in edit mode, so saving updates the existing tier
 * instead of creating a duplicate.
 */
export type DraftTicketTier = {
  id: string | null
  name: string
  capacity: string
  maxPerOrder: string
}

/**
 * The full event creation draft. Mirrors the columns on `events` /
 * `event_submissions` after the Phase 13 schema migration. Every field has a
 * sensible default so a fresh draft is always valid as an "empty form" state.
 *
 * Strings stay strings (no null) so React form inputs don't bounce between
 * controlled/uncontrolled. We convert empty strings → SQL NULL at submit time.
 */
export type EventDraft = {
  // Step 1 — Type
  /** 'event' | 'protest'. Default 'event'. */
  event_type: 'event' | 'protest'
  /** Civic protests use this. Always true when event_type='protest'. */
  is_civic: boolean
  /** Online flag is orthogonal to event_type. */
  is_online: boolean

  // Step 2 — Category
  /** 'nightlife' | 'music' | 'sports' | 'culture' | 'food' | 'civic' | '' */
  category: string

  // Step 3 — Basics
  title: string
  description: string
  tags: string[]
  /** ISO 639-1 code: 'en', 'sq', 'de', 'es', 'it', 'fr'. Default 'en'. */
  language: string
  /** LENS-3 auto-translations, keyed by language code (en/sq/de/es). Present
   *  only for events created via the Lens scanner; null otherwise. Rendered
   *  with the base title/description as fallback. */
  title_i18n: Record<string, string> | null
  description_i18n: Record<string, string> | null

  // Step 4 — Date & time
  /** ISO date: 'YYYY-MM-DD'. */
  date: string
  /** Last day of a continuous multi-day event (festival). ISO date, must be
   *  after `date`. Empty for single-day events; only meaningful with
   *  recurrence 'none'. */
  end_date: string
  /** 'HH:MM' display string. */
  time: string
  /** 'HH:MM' end time. Optional. `end_time <= time` means the event runs
   *  overnight into the day after `end_date || date`. */
  end_time: string
  /** IANA TZ, e.g. 'Europe/Tirane'. Auto-detected at init. */
  timezone: string

  // Step 5 — Location
  /** Slug of the resolved city. */
  location_slug: string
  country: string
  region: string
  city: string
  /** Formatted street address from the geocoder. */
  address: string
  /** Optional landmark / place-name hint for people who navigate by known
   *  places rather than exact addresses ("te sheshi Skënderbej, para fontanës"). */
  address_hint: string
  /** Display name of the venue (free-text). Optional — useful for community
   *  submissions that don't link to a `places` row. */
  venue_name: string
  lat: number | null
  lng: number | null
  /** For online events. */
  online_url: string

  // Step 6 — Media
  /** Photo URLs (Supabase Storage). First one is treated as the cover.
   *  Unlimited — the UI no longer caps the count. */
  gallery_urls: string[]
  /** When false, the cover (gallery_urls[0]) is NOT repeated inside the public
   *  photo gallery deck — it only appears in the hero. Default true keeps the
   *  legacy behaviour where the cover shows in both places. */
  cover_in_gallery: boolean
  /** Optional named photo sections shown below the main gallery on the public
   *  page — each with its own heading, blurb and photos (e.g. "The Venue",
   *  "Lineup"). Separate from `gallery_urls`; empty array = no sections. */
  content_sections: MediaSection[]

  // Step 7 — Organizer
  organizer_name: string
  organizer_contact: string // email
  organizer_phone: string
  organizer_website: string
  organizer_socials: {
    instagram?: string
    facebook?: string
    tiktok?: string
    twitter?: string
  }

  // Misc / civic
  price: string
  featured_movement_slug: string
  telegram_link: string
  whatsapp_link: string
  safety_notes: string
  expected_attendees: string // string in form, parse on submit

  // Tickets (Phase 33) — organizer/admin modes only. null = not offering
  // tickets (the default); an array (even of one) = free tiers to create on
  // the event at submit time. Community submissions never carry tiers: their
  // events row only exists after admin approval and the submitter isn't the
  // event's organizer.
  ticket_tiers: DraftTicketTier[] | null

  /**
   * How this event is ticketed — the explicit answer to "where do people buy?"
   *
   *   'none'     → nothing to buy; the event page shows no ticket CTA.
   *   'external' → sold on someone else's site; `ticket_url` is the CTA.
   *   'albago'   → claimed here as AlbaGo tickets; `ticket_tiers` drives it.
   *
   * Held explicitly rather than inferred, so "external, URL not typed yet" is
   * a real state the wizard can validate instead of silently reading as 'none'.
   */
  ticket_mode: 'none' | 'external' | 'albago'
  /** Where to buy, when ticket_mode is 'external'. Must be http(s). */
  ticket_url: string
  /** Who sells them — shown as "via {provider}" on the event page. Optional. */
  ticket_provider: string

  // Recurrence (Phase 15)
  /** 'none' | 'daily' | 'weekly'. Default 'none' for one-off events. */
  recurrence: 'none' | 'daily' | 'weekly'
  /** ISO date when the series ends. Empty string = open-ended. */
  recurrence_until: string
  /** ISO weekday numbers, 1=Mon..7=Sun. Used when recurrence='weekly'. */
  recurrence_days_of_week: number[]
  /** ISO dates the series should skip (cancellations). */
  recurrence_exceptions: string[]
}

function detectTimezone(): string {
  if (typeof Intl !== 'undefined') {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Tirane'
    } catch {
      /* fall through */
    }
  }
  return 'Europe/Tirane'
}

export const defaultEventDraft: EventDraft = {
  event_type: 'event',
  is_civic: false,
  is_online: false,

  category: '',

  title: '',
  description: '',
  tags: [],
  language: 'en',
  title_i18n: null,
  description_i18n: null,

  date: '',
  end_date: '',
  time: '',
  end_time: '',
  timezone: 'Europe/Tirane',

  location_slug: '',
  country: '',
  region: '',
  city: '',
  address: '',
  address_hint: '',
  venue_name: '',
  lat: null,
  lng: null,
  online_url: '',

  gallery_urls: [],
  cover_in_gallery: true,
  content_sections: [],

  organizer_name: '',
  organizer_contact: '',
  organizer_phone: '',
  organizer_website: '',
  organizer_socials: {},

  price: '',
  featured_movement_slug: '',
  telegram_link: '',
  whatsapp_link: '',
  safety_notes: '',
  expected_attendees: '',

  ticket_tiers: null,
  ticket_mode: 'none',
  ticket_url: '',
  ticket_provider: '',

  recurrence: 'none',
  recurrence_until: '',
  recurrence_days_of_week: [],
  recurrence_exceptions: [],
}

// ---------------------------------------------------------------------------
// Reducer
// ---------------------------------------------------------------------------

export type DraftAction =
  | { type: 'patch'; patch: Partial<EventDraft> }
  | { type: 'reset' }
  | { type: 'hydrate'; draft: EventDraft }
  // Specialized actions for tags so callers don't reach into state directly
  | { type: 'addTag'; tag: string }
  | { type: 'removeTag'; tag: string }

export function draftReducer(state: EventDraft, action: DraftAction): EventDraft {
  switch (action.type) {
    case 'patch':
      return { ...state, ...action.patch }
    case 'reset':
      return { ...defaultEventDraft, timezone: detectTimezone() }
    case 'hydrate':
      return action.draft
    case 'addTag': {
      const tag = action.tag.trim().toLowerCase()
      if (!tag) return state
      if (state.tags.includes(tag)) return state
      return { ...state, tags: [...state.tags, tag] }
    }
    case 'removeTag':
      return { ...state, tags: state.tags.filter((t) => t !== action.tag) }
    default:
      return state
  }
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'albago:event-draft:v1'

function loadFromStorage(): EventDraft | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<EventDraft> & { banner_url?: string }
    // Merge with defaults so newer fields work for old saved drafts.
    const merged = { ...defaultEventDraft, ...parsed }
    // Migrate legacy drafts that still hold a single banner_url string.
    if (
      parsed.banner_url &&
      (!merged.gallery_urls || merged.gallery_urls.length === 0)
    ) {
      merged.gallery_urls = [parsed.banner_url]
    }
    return merged
  } catch {
    return null
  }
}

function saveToStorage(draft: EventDraft) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(draft))
  } catch {
    /* quota or disabled — ignore */
  }
}

function clearStorage() {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(STORAGE_KEY)
  } catch {
    /* ignore */
  }
}

export type UseEventDraftReturn = {
  draft: EventDraft
  patch: (patch: Partial<EventDraft>) => void
  addTag: (tag: string) => void
  removeTag: (tag: string) => void
  reset: () => void
  clearPersisted: () => void
  hydrated: boolean
  /** When the draft was last autosaved to this device (null until the first
   *  persist after hydration). Drives the wizard's autosave indicator. */
  lastSavedAt: Date | null
}

/**
 * Manages a persistent event creation draft. Loads from localStorage on
 * mount, persists on every change, and exposes typed patch helpers.
 */
export function useEventDraft(): UseEventDraftReturn {
  const [draft, dispatch] = useReducer(draftReducer, defaultEventDraft, (init) => ({
    ...init,
    timezone: detectTimezone(),
  }))
  const [hydrated, setHydrated] = useState(false)
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null)

  // Load persisted draft once.
  useEffect(() => {
    const stored = loadFromStorage()
    if (stored) dispatch({ type: 'hydrate', draft: stored })
    // One-shot post-mount sync from localStorage; consumers wait on `hydrated`.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHydrated(true)
  }, [])

  // Persist on change (skip the initial mount until hydration finishes).
  useEffect(() => {
    if (!hydrated) return
    saveToStorage(draft)
    // Timestamp for the autosave indicator; follows the persist it describes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLastSavedAt(new Date())
  }, [draft, hydrated])

  const patch = useCallback((p: Partial<EventDraft>) => {
    dispatch({ type: 'patch', patch: p })
  }, [])

  const addTag = useCallback((tag: string) => {
    dispatch({ type: 'addTag', tag })
  }, [])

  const removeTag = useCallback((tag: string) => {
    dispatch({ type: 'removeTag', tag })
  }, [])

  const reset = useCallback(() => {
    dispatch({ type: 'reset' })
    clearStorage()
  }, [])

  const clearPersisted = useCallback(() => clearStorage(), [])

  return {
    draft,
    patch,
    addTag,
    removeTag,
    reset,
    clearPersisted,
    hydrated,
    lastSavedAt,
  }
}
