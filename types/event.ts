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