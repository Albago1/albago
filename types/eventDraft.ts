'use client'

import { useCallback, useEffect, useReducer, useState } from 'react'
import {
  defaultEventDraft,
  detectTimezone,
  type EventDraft,
} from './eventDraftBase'

// The draft's shape, defaults and pure helpers live in ./eventDraftBase so
// server code can import them without pulling React in. Re-exported here so
// every existing '@/types/eventDraft' import keeps working unchanged.
export * from './eventDraftBase'

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
