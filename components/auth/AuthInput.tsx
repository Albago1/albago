'use client'

import { useState } from 'react'
import { Eye, EyeOff, type LucideIcon } from 'lucide-react'
import { useLanguage } from '@/lib/i18n/LanguageProvider'

const INPUT_CLASS =
  'h-12 w-full rounded-2xl border border-white/10 bg-white/[0.04] pl-11 text-sm outline-none transition placeholder:text-white/30 focus:border-flame-500/40 focus:ring-2 focus:ring-flame-500/20'

/** Labeled icon input — the one field style every auth page shares. */
export function AuthInput({
  label,
  icon: Icon,
  labelEnd,
  ...inputProps
}: {
  label: string
  icon: LucideIcon
  /** Optional element on the label row's right side (e.g. "Forgot?"). */
  labelEnd?: React.ReactNode
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-[0.14em] text-white/55">
          {label}
        </span>
        {labelEnd}
      </div>
      <div className="relative">
        <Icon
          className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35"
          aria-hidden="true"
        />
        <input {...inputProps} className={`${INPUT_CLASS} pr-4`} />
      </div>
    </label>
  )
}

/** Password field with its own visibility toggle (translated aria labels). */
export function AuthPasswordInput({
  label,
  icon: Icon,
  labelEnd,
  ...inputProps
}: {
  label: string
  icon: LucideIcon
  labelEnd?: React.ReactNode
} & React.InputHTMLAttributes<HTMLInputElement>) {
  const { t } = useLanguage()
  const [visible, setVisible] = useState(false)

  return (
    <label className="block">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-[0.14em] text-white/55">
          {label}
        </span>
        {labelEnd}
      </div>
      <div className="relative">
        <Icon
          className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35"
          aria-hidden="true"
        />
        <input
          {...inputProps}
          type={visible ? 'text' : 'password'}
          className={`${INPUT_CLASS} pr-12`}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          tabIndex={-1}
          aria-label={visible ? t('auth_hide_password') : t('auth_show_password')}
          className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-white/40 transition hover:text-white/80"
        >
          {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    </label>
  )
}
