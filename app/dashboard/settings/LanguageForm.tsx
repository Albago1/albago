'use client'

import { Check } from 'lucide-react'
import { useLanguage } from '@/lib/i18n/LanguageProvider'
import { languages, type Language } from '@/lib/i18n/config'

// Endonyms — each language shown in its own script, the way the best
// platforms present a language menu.
const LABELS: Record<Language, { name: string; flag: string }> = {
  en: { name: 'English', flag: '🇬🇧' },
  de: { name: 'Deutsch', flag: '🇩🇪' },
  es: { name: 'Español', flag: '🇪🇸' },
  sq: { name: 'Shqip', flag: '🇦🇱' },
}

export default function LanguageForm() {
  const { t, language, setLanguage } = useLanguage()

  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
      <h3 className="text-sm font-semibold text-white">
        {t('settings_language_title')}
      </h3>
      <p className="mt-1 text-sm text-white/55">{t('settings_language_sub')}</p>

      <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        {languages.map((code) => {
          const active = code === language
          return (
            <button
              key={code}
              type="button"
              onClick={() => setLanguage(code)}
              aria-pressed={active}
              className={[
                'relative flex items-center gap-2 rounded-2xl border px-3.5 py-3 text-sm font-medium transition active:scale-95',
                active
                  ? 'border-flame-400/60 bg-flame-500/15 text-white'
                  : 'border-white/12 bg-white/[0.04] text-white/70 hover:border-white/25 hover:text-white',
              ].join(' ')}
            >
              <span className="text-base leading-none">{LABELS[code].flag}</span>
              <span className="min-w-0 truncate">{LABELS[code].name}</span>
              {active && (
                <Check className="ml-auto h-4 w-4 flex-shrink-0 text-flame-300" />
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
