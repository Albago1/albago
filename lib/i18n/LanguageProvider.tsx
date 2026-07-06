"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
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

const LanguageContext = createContext<LanguageContextValue | null>(null)

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(defaultLanguage)

  useEffect(() => {
    let saved = window.localStorage.getItem(STORAGE_KEY)
    // "al" was our old code for Albanian before switching to ISO "sq"
    if (saved === "al") {
      saved = "sq"
      window.localStorage.setItem(STORAGE_KEY, saved)
    }
    if (saved && saved in translations) {
      setLanguageState(saved as Language)
    }
  }, [])

  const setLanguage = useCallback((nextLanguage: Language) => {
    setLanguageState(nextLanguage)
    window.localStorage.setItem(STORAGE_KEY, nextLanguage)
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