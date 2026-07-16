'use client'

import { Check, Circle } from 'lucide-react'
import { passwordChecks } from '@/lib/authErrors'
import { useLanguage } from '@/lib/i18n/LanguageProvider'

/**
 * Live password requirements under the new-password fields (sign-up and
 * reset). One shared standard — 8+ characters, a letter, a number — shown
 * up front instead of surprising the user with a server rejection.
 */
export default function PasswordChecklist({ password }: { password: string }) {
  const { t } = useLanguage()
  const checks = passwordChecks(password)
  const rules: { key: string; ok: boolean }[] = [
    { key: 'auth_pw_rule_length', ok: checks.length },
    { key: 'auth_pw_rule_letter', ok: checks.letter },
    { key: 'auth_pw_rule_number', ok: checks.number },
  ]

  return (
    <ul className="mt-2 space-y-1" aria-live="polite">
      {rules.map(({ key, ok }) => (
        <li
          key={key}
          className={`flex items-center gap-2 text-xs transition-colors ${
            ok ? 'text-emerald-300/90' : 'text-white/40'
          }`}
        >
          {ok ? (
            <Check className="h-3.5 w-3.5 shrink-0" />
          ) : (
            <Circle className="h-2 w-2 shrink-0 fill-current opacity-40" />
          )}
          {t(key)}
        </li>
      ))}
    </ul>
  )
}
