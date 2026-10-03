export type Event = {
  id: string
  slug: string
  title: string
  date: string
  time: string
  placeId: string | null
  description: string
  category: string
  price?: string
  highlight?: boolean
  organizerContact?: string | null
}

export type EventStatus =
  | 'draft'
  | 'pending_review'
  | 'published'
  | 'rejected'
  | 'cancelled'
  | 'completed'

export type EventOrigin =
  | 'admin_seeded'
  | 'organizer_dashboard'
  | 'community_submission'
  | 'imported'

export type OrganizerEvent = {
  id: string
  slug: string
  title: string
  category: string
  description: string
  date: string
  time: string | null
  end_time: string | null
  price: string | null
  highlight: boolean
  status: EventStatus
  location_slug: string
  country: string
  region: string | null
  place_id: string | null
  organizer_id: string
  origin: EventOrigin
  banner_url: string | null
  published_at: string | null
  admin_note: string | null
  created_at: string
  updated_at: string
  recurrence: string | null
  recurrence_until: string | null
  recurrence_days_of_week: number[] | null
  recurrence_exceptions: string[] | null
  address: string | null
  // Present in the DB row (fetched via select('*')) — declared for the
  // organizer dashboard's pre-publish preview.
  address_hint?: string | null
  gallery_urls?: string[] | null
  tags?: string[] | null
  is_online?: boolean | null
  online_url?: string | null
  organizer_name?: string | null
}
