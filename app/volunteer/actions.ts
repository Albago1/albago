'use server'

import { createClient } from '@/lib/supabase/server'
import {
  VOLUNTEER_ROLE_KEYS,
  type VolunteerResult,
  type VolunteerSubmission,
} from './volunteer-shared'

const ROLE_KEY_SET = new Set<string>(VOLUNTEER_ROLE_KEYS)
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export async function submitVolunteerSignup(
  input: VolunteerSubmission,
): Promise<VolunteerResult> {
  const name = (input.name ?? '').trim()
  if (name.length < 2 || name.length > 80) {
    return { ok: false, error: 'Please enter your name (2–80 characters).' }
  }

  const email = (input.email ?? '').trim().toLowerCase()
  if (!EMAIL_RE.test(email)) {
    return { ok: false, error: 'Please enter a valid email address.' }
  }

  const city = (input.city ?? '').trim()
  if (city.length < 1 || city.length > 80) {
    return { ok: false, error: 'Please enter your city.' }
  }

  const phone = input.phone ? input.phone.trim().slice(0, 40) : null
  const country = input.country ? input.country.trim().slice(0, 80) : null
  const availabilityNote = input.availabilityNote
    ? input.availabilityNote.trim().slice(0, 600)
    : null
  const movementSlug = input.movementSlug
    ? input.movementSlug.trim().slice(0, 80)
    : null

  const roles = Array.isArray(input.roles) ? input.roles : []
  if (roles.length === 0) {
    return { ok: false, error: 'Pick at least one role you can help with.' }
  }
  if (roles.length > VOLUNTEER_ROLE_KEYS.length) {
    return { ok: false, error: 'Too many roles selected.' }
  }
  for (const r of roles) {
    if (!ROLE_KEY_SET.has(r)) {
      return { ok: false, error: `Unknown role: ${r}` }
    }
  }

  const supabase = await createClient()
  const { error } = await supabase.from('volunteer_signups').insert({
    name,
    email,
    phone,
    city,
    country,
    roles,
    availability_note: availabilityNote,
    movement_slug: movementSlug,
  })

  if (error) {
    // Table missing (Phase 9 migration not applied yet). Postgres "undefined
    // table" is 42P01; PostgREST surfaces a "PGRST205" code or 404. Either way,
    // we want to tell the user to apply the migration — not leak a SQL string.
    const code = (error as { code?: string }).code ?? ''
    const message = (error as { message?: string }).message ?? ''
    const tableMissing =
      code === '42P01' ||
      code === 'PGRST205' ||
      message.toLowerCase().includes('relation "volunteer_signups"')
    if (tableMissing) {
      return {
        ok: false,
        error:
          'Volunteer signups are not enabled yet. Apply docs/seeds/phase-9-volunteer-signups.sql in Supabase, then try again.',
        needsMigration: true,
      }
    }
    return {
      ok: false,
      error:
        'Something went wrong saving your signup. Please try again in a moment.',
    }
  }

  return { ok: true }
}
