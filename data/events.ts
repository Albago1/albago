import { Event } from '@/types/event'

export const events: Event[] = [
  {
    id: '1',
    title: 'Friday DJ Night',
    date: '2026-04-03',
    time: '22:00',
    placeId: '1',
    description: 'House and commercial hits all night.',
    price: '€10',
    highlight: true,
  },
  {
    id: '2',
    title: 'Cocktail Evening',
    date: '2026-04-04',
    time: '20:00',
    placeId: '1',
    description: 'Relaxed evening with signature cocktails.',
    price: 'Free',
    highlight: true,
  },
  {
    id: '3',
    title: 'Championship Match',
    date: '2026-04-05',
    time: '19:00',
    placeId: '2',
    description: 'Major sports event at the stadium.',
    price: '€15',
    highlight: true,
  },

  {
  id: '4',
  title: 'Friday DJ Night',
  date: '2026-04-03',
  time: '22:00',
  placeId: '1',
  description: 'House and commercial hits all night.',
  category: 'DJ',
  price: 'Free',
  highlight: true,
},
]