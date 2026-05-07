export const languages = ["en", "de", "es", "al"] as const

export type Language = (typeof languages)[number]

export const defaultLanguage: Language = "en"

export const languageLabels: Record<Language, string> = {
  en: "EN",
  de: "DE",
  es: "ES",
  al: "AL",
}