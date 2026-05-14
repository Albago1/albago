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
}