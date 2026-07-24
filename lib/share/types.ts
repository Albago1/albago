export type ShareEventData = {
  title: string
  slug: string
  category: string | null
  city: string
  country: string | null
  address: string | null
  date: string
  /** Last day of a continuous multi-day event (YYYY-MM-DD). When set and later
   *  than `date`, posters render the full date range instead of a single day. */
  endDate?: string | null
  time: string | null
  endTime: string | null
  organizerName: string | null
  isCivic: boolean
  eventUrl: string
  /** Event's own photo (banner-first), graded into the brand backdrop in the
   *  Poster Studio. Absent → Studio falls back to brand art / AI generation. */
  imageUrl?: string | null
}
