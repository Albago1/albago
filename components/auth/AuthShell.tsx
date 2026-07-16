'use client'

import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import LanguageSwitcher from '@/components/layout/LanguageSwitcher'

/**
 * Shared frame for every auth page (sign-up, sign-in, forgot, reset):
 * back link + language switcher on top, then the glass card with the
 * AlbaGo wordmark, a display headline, and the page body. Keeps all four
 * pages visually identical — one place to evolve the look.
 */
export default function AuthShell({
  backHref,
  backLabel,
  title,
  subtitle,
  children,
  below,
}: {
  backHref: string
  backLabel: string
  title: string
  subtitle?: string
  children: React.ReactNode
  /** Rendered under the card (legal line, switch-page link). */
  below?: React.ReactNode
}) {
  return (
    <main className="min-h-screen bg-ink-950 px-4 py-10 text-white sm:py-16">
      <div className="mx-auto w-full max-w-md">
        <div className="mb-8 flex items-center justify-between">
          <Link
            href={backHref}
            className="inline-flex items-center gap-1.5 text-sm text-white/55 transition hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            {backLabel}
          </Link>
          <LanguageSwitcher />
        </div>

        <div className="rounded-[32px] border border-white/10 bg-white/[0.03] p-6 shadow-[0_30px_80px_-30px_rgba(0,0,0,0.6)] sm:p-8">
          <div className="text-center">
            <p className="font-display text-2xl font-normal text-white/85">
              AlbaGo
            </p>
            <h1 className="mt-6 font-display text-4xl font-normal tracking-tight text-white">
              {title}
            </h1>
            {subtitle && (
              <p className="mt-2 text-sm leading-6 text-white/55">{subtitle}</p>
            )}
          </div>
          {children}
        </div>

        {below}
      </div>
    </main>
  )
}
