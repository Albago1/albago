import type { AuthError } from '@supabase/supabase-js'

/**
 * Map a Supabase auth error to a human i18n key. Users never see raw
 * technical messages ("Invalid login credentials") — every failure gets a
 * friendly, translated explanation. Prefer the structured error code
 * (supabase-js ≥2.38); fall back to message sniffing for safety.
 */
export function authErrorKey(error: AuthError): string {
  switch (error.code) {
    case 'invalid_credentials':
      return 'auth_err_invalid_credentials'
    case 'email_not_confirmed':
      return 'auth_err_email_not_confirmed'
    case 'user_already_exists':
    case 'email_exists':
      return 'auth_err_email_exists'
    case 'weak_password':
      return 'auth_err_weak_password'
    case 'same_password':
      return 'auth_err_same_password'
    case 'over_email_send_rate_limit':
    case 'over_request_rate_limit':
    case 'over_sms_send_rate_limit':
      return 'auth_err_rate_limited'
    case 'validation_failed':
      return 'auth_err_invalid_email'
  }

  const msg = (error.message || '').toLowerCase()
  if (msg.includes('invalid login credentials')) return 'auth_err_invalid_credentials'
  if (msg.includes('not confirmed')) return 'auth_err_email_not_confirmed'
  if (msg.includes('already registered')) return 'auth_err_email_exists'
  if (msg.includes('rate limit')) return 'auth_err_rate_limited'
  if (msg.includes('password')) return 'auth_err_weak_password'
  return 'auth_err_generic'
}

/** The password standard shown AND enforced across sign-up and reset —
 *  one rule set everywhere (the old pages disagreed: 8 chars vs 6). */
export type PasswordChecks = {
  length: boolean
  letter: boolean
  number: boolean
}

export function passwordChecks(password: string): PasswordChecks {
  return {
    length: password.length >= 8,
    letter: /[a-zA-Z]/.test(password),
    number: /\d/.test(password),
  }
}

export function passwordOk(password: string): boolean {
  const checks = passwordChecks(password)
  return checks.length && checks.letter && checks.number
}
