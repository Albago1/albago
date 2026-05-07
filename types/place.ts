export type Place = {
  id: string
  name: string
  category: string
  lat: number
  lng: number
  description: string
  options: string[]
  imageUrl?: string
  city?: string
  address?: string
  verified?: boolean
  websiteUrl?: string
  phone?: string
  status?: string
}