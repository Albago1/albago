export interface Organizer {
  id: string
  display_name: string
  slug: string
  bio: string | null
  contact_email: string
  website_url: string | null
  verified: boolean
  created_at: string
  updated_at: string
}

export interface OnboardingResponse {
  organizer_id: string
  event_types: string[]
  attendee_age_ranges: string[]
  expected_attendance_size: string | null
  expected_yearly_revenue: string | null
  events_per_year: string | null
  created_at: string
}

export const EVENT_TYPE_OPTIONS = [
  'Nightlife',
  'Music',
  'Food & Drink',
  'Sports',
  'Culture',
  'Tech',
  'Workshops',
  'Family',
  'Other',
] as const

export const AGE_RANGE_OPTIONS = [
  '18–24',
  '25–34',
  '35–44',
  '45+',
] as const

export const ATTENDANCE_SIZE_OPTIONS = [
  '<50',
  '50–200',
  '200–500',
  '500–2,000',
  '2,000+',
] as const

export const YEARLY_REVENUE_OPTIONS = [
  '<€1k',
  '€1k–10k',
  '€10k–50k',
  '€50k–200k',
  '€200k+',
] as const

export const EVENTS_PER_YEAR_OPTIONS = [
  '1–5',
  '5–20',
  '20–50',
  '50+',
] as const

export interface CreateOrganizerInput {
  displayName: string
  contactEmail: string
  websiteUrl: string
  eventTypes: string[]
  attendeeAgeRanges: string[]
  expectedAttendanceSize: string
  expectedYearlyRevenue: string
  eventsPerYear: string
}
