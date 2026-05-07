"use client"

import { languageLabels, languages, type Language } from "@/lib/i18n/config"
import { useLanguage } from "@/lib/i18n/LanguageProvider"

export default function LanguageSwitcher() {
  const { language, setLanguage } = useLanguage()

  return (
    <div className="flex items-center gap-1 rounded-full border border-white/10 bg-white/5 p-1 backdrop-blur">
      {languages.map((lang) => {
        const active = language === lang

        return (
          <button
            key={lang}
            type="button"
            onClick={() => setLanguage(lang as Language)}
            aria-pressed={active}
            className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
              active
                ? "bg-white text-black"
                : "text-white/70 hover:bg-white/10 hover:text-white"
            }`}
          >
            {languageLabels[lang]}
          </button>
        )
      })}
    </div>
  )
}