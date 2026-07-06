'use client'

import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Check, ChevronDown, Globe } from 'lucide-react'
import { languages, type Language } from '@/lib/i18n/config'
import { useLanguage } from '@/lib/i18n/LanguageProvider'

// Native names, no flags — flags conflate country with language and don't
// render as emoji on Windows desktops. This is the Airbnb/Stripe pattern.
const LANGUAGE_META: Record<Language, { native: string; code: string }> = {
  en: { native: 'English', code: 'EN' },
  de: { native: 'Deutsch', code: 'DE' },
  es: { native: 'Español', code: 'ES' },
  al: { native: 'Shqip', code: 'AL' },
}

export default function LanguageSwitcher({
  align = 'right',
}: {
  align?: 'left' | 'right'
}) {
  const { language, setLanguage } = useLanguage()
  const [open, setOpen] = useState(false)
  const wrapperRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [])

  const current = LANGUAGE_META[language]

  return (
    <div ref={wrapperRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-label="Change language"
        className={[
          'inline-flex h-10 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold transition',
          open
            ? 'border-white/25 bg-white/[0.08] text-white'
            : 'border-white/10 bg-white/[0.04] text-white/80 hover:bg-white/[0.08] hover:text-white',
        ].join(' ')}
      >
        <Globe className="h-4 w-4 opacity-70" />
        {current.code}
        <ChevronDown
          className={`h-3 w-3 opacity-60 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.98 }}
            transition={{ duration: 0.16, ease: 'easeOut' }}
            className={[
              'absolute top-[calc(100%+0.5rem)] z-50 w-44 overflow-hidden rounded-2xl border border-white/10 bg-ink-900 p-1.5 shadow-2xl',
              align === 'right' ? 'right-0' : 'left-0',
            ].join(' ')}
          >
            {languages.map((lang) => {
              const meta = LANGUAGE_META[lang]
              const active = language === lang
              return (
                <button
                  key={lang}
                  type="button"
                  onClick={() => {
                    setLanguage(lang as Language)
                    setOpen(false)
                  }}
                  className={[
                    'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition hover:bg-white/[0.06]',
                    active ? 'bg-white/[0.05] text-white' : 'text-white/75',
                  ].join(' ')}
                >
                  <span className="flex-1 font-medium">{meta.native}</span>
                  {active ? (
                    <Check className="h-4 w-4 shrink-0 text-flame-400" />
                  ) : (
                    <span className="text-[10px] font-semibold text-white/35">
                      {meta.code}
                    </span>
                  )}
                </button>
              )
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
