export type EventStatus = 'draft' | 'pending_review' | 'published' | 'rejected' | 'cancelled' | 'completed'
export type SubmissionStatus = 'pending' | 'approved' | 'rejected'
export type UserRole = 'user' | 'organizer' | 'admin'

export type BackendPlace = {
  id: string
  name: string
  slug: string
  category: string
  description: string
  city: string
  address: string
  lat: number
  lng: number
  image_url: string | null
  options: string[]
  verified: boolean
  created_at: string
  updated_at: string
}

export type BackendEvent = {
  id: string
  title: string
  slug: string
  place_id: string
  category: string
  description: string
  date: string
  time: string
  price: string | null
  highlight: boolean
  status: EventStatus
  created_at: string
  updated_at: string
}

export type BackendEventSubmission = {
  id: string
  title: string
  venue_name: string
  place_id: string | null
  category: string
  description: string
  date: string
  time: string
  price: string | null
  contact_email: string
  submitted_by_user_id: string | null
  status: SubmissionStatus
  admin_note: string | null
  created_at: string
  updated_at: string
}

export type BackendUser = {
  id: string
  email: string
  full_name: string | null
  role: UserRole
  created_at: string
}