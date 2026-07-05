import {
  Martini,
  Megaphone,
  Music,
  Palette,
  Sparkles,
  Trophy,
  UtensilsCrossed,
  type LucideIcon,
} from 'lucide-react'

export const CATEGORIES = [
  'all',
  'nightlife',
  'music',
  'sports',
  'culture',
  'food',
  'civic',
] as const

export const CATEGORY_ICONS: Record<string, LucideIcon> = {
  all: Sparkles,
  nightlife: Martini,
  music: Music,
  sports: Trophy,
  culture: Palette,
  food: UtensilsCrossed,
  civic: Megaphone,
}

export function getCategoryTone(category?: string) {
  if (!category) return 'bg-white/10 text-white/80'

  const value = category.toLowerCase()

  if (value === 'nightlife') return 'bg-fuchsia-500/20 text-fuchsia-300'
  if (value === 'music') return 'bg-violet-500/20 text-violet-300'
  if (value === 'sports') return 'bg-emerald-500/20 text-emerald-300'
  if (value === 'culture') return 'bg-sky-500/20 text-sky-300'
  if (value === 'food') return 'bg-amber-500/20 text-amber-300'
  if (value === 'civic') return 'bg-flame-500/20 text-flame-300'

  return 'bg-white/10 text-white/80'
}
