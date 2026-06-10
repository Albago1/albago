export const VOLUNTEER_ROLE_KEYS = [
  'organizer',
  'designer',
  'video-editor',
  'translator',
  'marshal',
  'social',
  'driver',
  'legal-observer',
] as const

export type VolunteerRoleKey = (typeof VOLUNTEER_ROLE_KEYS)[number]

export type VolunteerSubmission = {
  name: string
  email: string
  phone?: string
  city: string
  country?: string
  roles: string[]
  availabilityNote?: string
  movementSlug?: string
}

export type VolunteerResult =
  | { ok: true }
  | { ok: false; error: string; needsMigration?: boolean }
