'use client'

import { useEffect, useState } from 'react'
import { useLanguage } from '@/lib/i18n/LanguageProvider'

/**
 * LENS-3 render helper. Picks the translation for the active language from an
 * event's `title_i18n` / `description_i18n` pack, falling back to the original
 * text whenever a translation is missing, empty, or absent. Pure — exported
 * for reuse and tests.
 */
export function pickLocalized(
  base: string,
  i18n: Record<string, string> | null | undefined,
  language: string,
): string {
  const translated = i18n?.[language]
  if (translated && translated.trim().length > 0) return translated
  return base
}

type Props = {
  base: string
  i18n: Record<string, string> | null | undefined
  className?: string
  /** Render as a plain string inside an existing element (no wrapper). */
  asText?: boolean
}

/**
 * Renders localized event text on an otherwise server-rendered page. The
 * original text is rendered on the server and on the first client paint (so
 * SEO/metadata and no-JS visitors always get the real content and there is no
 * hydration mismatch); after mount it swaps to the viewer's language.
 */
export default function LocalizedEventText({ base, i18n, className, asText }: Props) {
  const { language } = useLanguage()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    // One-shot post-mount flag so SSR/first paint renders the original text
    // (no hydration mismatch, SEO-safe) and we localize only afterward.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true)
  }, [])

  const text = mounted ? pickLocalized(base, i18n, language) : base
  if (asText) return <>{text}</>
  return <span className={className}>{text}</span>
}
