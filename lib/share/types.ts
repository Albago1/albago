export type ShareEventData = {
  title: string
  slug: string
  category: string | null
  city: string
  country: string | null
  address: string | null
  date: string
  time: string | null
  endTime: string | null
  organizerName: string | null
  isCivic: boolean
  eventUrl: string
  /** Event's own photo (banner-first), graded into the brand backdrop in the
   *  Poster Studio. Absent → Studio falls back to brand art / AI generation. */
  imageUrl?: string | null
}
