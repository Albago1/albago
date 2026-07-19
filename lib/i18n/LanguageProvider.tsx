"use client"

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react"
import { defaultLanguage, type Language } from "./config"
import { translations } from "./translations"

type LanguageContextValue = {
  language: Language
  setLanguage: (language: Language) => void
  t: (key: string) => string
}

const STORAGE_KEY = "albago_language"

// localStorage is the source of truth; useSyncExternalStore mirrors it so
// the saved language applies right after hydration without a mount effect.
const listeners = new Set<() => void>()

// Session-only fallback so switching still works when localStorage is
// unavailable (private mode / storage disabled).
let memoryLanguage: Language | null = null

function subscribe(callback: () => void) {
  listeners.add(callback)
  return () => {
    listeners.delete(callback)
  }
}

function readStoredLanguage(): Language {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY)
    // "al" was our old code for Albanian before switching to ISO "sq".
    // Normalized on read; the write-back happens on the next setLanguage.
    const normalized = saved === "al" ? "sq" : saved
    if (normalized && normalized in translations) {
      return normalized as Language
    }
  } catch {
    /* private mode / storage disabled — fall through to memory */
  }
  return memoryLanguage ?? defaultLanguage
}

function serverLanguage(): Language {
  return defaultLanguage
}

const LanguageContext = createContext<LanguageContextValue | null>(null)

export function LanguageProvider({ children }: { children: ReactNode }) {
  const language = useSyncExternalStore(
    subscribe,
    readStoredLanguage,
    serverLanguage,
  )

  const setLanguage = useCallback((nextLanguage: Language) => {
    memoryLanguage = nextLanguage
    try {
      window.localStorage.setItem(STORAGE_KEY, nextLanguage)
    } catch {
      /* private mode — memoryLanguage covers the session */
    }
    listeners.forEach((notify) => notify())
  }, [])

  const t = useCallback(
    (key: string) => {
      return translations[language][key] ?? translations[defaultLanguage][key] ?? key
    },
    [language]
  )

  const value = useMemo(
    () => ({
      language,
      setLanguage,
      t,
    }),
    [language, setLanguage, t]
  )

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
}

export function useLanguage() {
  const context = useContext(LanguageContext)

  if (!context) {
    throw new Error("useLanguage must be used inside LanguageProvider")
  }

  return context
}