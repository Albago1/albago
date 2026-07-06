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

// Branded gradients per category — used for photo-less event cards, the
// homepage category showcase tiles, and venue placeholders.
export const CATEGORY_GRADIENTS: Record<string, string> = {
  nightlife: 'from-fuchsia-600/40 via-ink-900 to-ink-950',
  music: 'from-violet-600/40 via-ink-900 to-ink-950',
  sports: 'from-emerald-600/40 via-ink-900 to-ink-950',
  culture: 'from-sky-600/40 via-ink-900 to-ink-950',
  food: 'from-amber-600/40 via-ink-900 to-ink-950',
  civic: 'from-flame-600/40 via-ink-900 to-ink-950',
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
