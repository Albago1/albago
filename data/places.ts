import { Place } from '@/types/place'

export const places: Place[] = [
  {
    id: '1',
    name: 'Radio Bar',
    category: 'nightlife',
    lng: 19.8187,
    lat: 41.3275,
    description: 'Cocktails, music, and a lively atmosphere.',
    options: ['DJ', 'cocktails', 'late night'],
    imageUrl: 'https://images.unsplash.com/photo-1514933651103-005eec06c04b?q=80&w=1200&auto=format&fit=crop',
  },
  {
    id: '2',
    name: 'Air Albania Stadium',
    category: 'sports',
    lng: 19.8269,
    lat: 41.3186,
    description: 'Major venue for sports and large events.',
    options: ['stadium', 'events', 'outdoor'],
    imageUrl: 'https://images.unsplash.com/photo-1547347298-4074fc3086f0?q=80&w=1200&auto=format&fit=crop',
  },
]