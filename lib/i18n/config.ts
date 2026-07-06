export const languages = ["en", "de", "es", "sq"] as const

export type Language = (typeof languages)[number]

export const defaultLanguage: Language = "en"

export const languageLabels: Record<Language, string> = {
  en: "EN",
  de: "DE",
  es: "ES",
  sq: "SQ",
}

// BCP 47 locales for date formatting per UI language.
export const languageLocales: Record<Language, string> = {
  en: "en-GB",
  de: "de-DE",
  es: "es-ES",
  sq: "sq-AL",
}
