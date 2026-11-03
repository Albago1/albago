'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { Download, Landmark, Loader2 } from 'lucide-react'
import { useLanguage } from '@/lib/i18n/LanguageProvider'
import { languageLocales } from '@/lib/i18n/config'
import { formatMoney } from '@/lib/seats/format'
import type { SeatPaymentView } from '@/lib/seats/payment'
import { withPayPalLogo } from './PayPalLogo'

const fill = (text: string, values: Record<string, string | number>) =>
  text.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? ''))

/**
 * "Pay now" on a held reservation: the seller's GiroCode to scan in a banking
 * app (amount + reference prefilled) and/or a PayPal button. The server only
 * sends the QR image — never the seller's name or IBAN as text. Without
 * payment details set up, shows `fallback` (the "we'll email you" note).
 */
export default function SeatPaymentBox({ reservationId, fallback }: { reservationId: string; fallback: ReactNode }) {
  const { t, language } = useLanguage()
  const locale = languageLocales[language]
  const [view, setView] = useState<SeatPaymentView | 'loading' | 'none'>('loading')

  useEffect(() => {
    let gone = false
    fetch(`/api/seats/${reservationId}/pay`, { cache: 'no-store' })
      .then((r) => (r.ok ? (r.json() as Promise<SeatPaymentView>) : null))
      .then((v) => {
        if (!gone) setView(v && (v.qr || v.paypal) ? v : 'none')
      })
      .catch(() => {
        if (!gone) setView('none')
      })
    return () => {
      gone = true
    }
  }, [reservationId])

  if (view === 'loading') {
    return (
      <p className="flex items-center gap-2 text-white/50">
        <Loader2 className="h-4 w-4 animate-spin" /> {t('seat_pay_title')}
      </p>
    )
  }
  if (view === 'none') return <>{fallback}</>

  const amount = formatMoney(view.amount_cents, view.currency, locale)

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-base font-semibold text-white">{t('seat_pay_title')}</p>
        <p className="text-xl font-bold tabular-nums text-white">{amount}</p>
      </div>

      {view.qr && (
        <div className="mt-3 flex flex-col items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:flex-row sm:items-start">
          {/* Plain <img>: a data URL from our own server, no optimisation needed. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={view.qr}
            alt={t('seat_pay_bank')}
            width={176}
            height={176}
            className="h-44 w-44 flex-shrink-0 rounded-xl bg-white p-1.5"
          />
          <div className="min-w-0 text-center sm:text-left">
            <p className="flex items-center justify-center gap-1.5 text-sm font-semibold text-white sm:justify-start">
              <Landmark className="h-4 w-4 text-flame-300" /> {t('seat_pay_bank')}
            </p>
            <p className="mt-1 text-xs leading-relaxed text-white/60">{t('seat_pay_bank_hint')}</p>
            <a
              href={view.qr}
              download={`AlbaGo-${view.reference}.png`}
              className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-white/15 px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-white/[0.06]"
            >
              <Download className="h-3.5 w-3.5" /> {t('seat_pay_save_qr')}
            </a>
            <p className="mt-2 text-[11px] leading-relaxed text-white/45 sm:hidden">{t('seat_pay_phone_tip')}</p>
          </div>
        </div>
      )}

      {view.qr && view.paypal && (
        <p className="my-3 flex items-center gap-3 text-[11px] font-semibold uppercase tracking-wider text-white/35">
          <span className="h-px flex-1 bg-white/10" />
          {t('seat_pay_or')}
          <span className="h-px flex-1 bg-white/10" />
        </p>
      )}

      {view.paypal && (
        <div className={view.qr ? '' : 'mt-3'}>
          <a
            href={view.paypal}
            target="_blank"
            rel="noopener noreferrer"
            className="flex w-full items-center justify-center gap-1.5 rounded-full bg-[#ffc439] px-5 py-3 text-sm font-bold text-[#003087] transition hover:brightness-105"
          >
            {withPayPalLogo(fill(t('seat_pay_paypal'), { amount }), 'h-[18px]')}
          </a>
          <p className="mt-2 text-center text-[11px] leading-relaxed text-white/50">
            {fill(t('seat_pay_paypal_hint'), { ref: view.reference })}
          </p>
        </div>
      )}

      <p className="mt-3 text-xs text-white/50">{t('seat_pay_confirm')}</p>
    </div>
  )
}
