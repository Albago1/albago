'use client'

import { Beer, Drum, Trophy, Palette, UtensilsCrossed, Sparkles } from 'lucide-react'
import type { EventDraft } from '@/types/eventDraft'

type Props = {
  draft: EventDraft
  patch: (patch: Partial<EventDraft>) => void
}

type CategoryOption = {
  value: string
  label: string
  description: string
  icon: React.ComponentType<{ className?: string }>
}

const CATEGORIES: CategoryOption[] = [
  {
    value: 'nightlife',
    label: 'Nightlife',
    description: 'Clubs, late-night events, DJ sets.',
    icon: Beer,
  },
  {
    value: 'music',
    label: 'Music',
    description: 'Concerts, live gigs, festivals.',
    icon: Drum,
  },
  {
    value: 'sports',
    label: 'Sports',
    description: 'Matches, tournaments, viewings.',
    icon: Trophy,
  },
  {
    value: 'culture',
    label: 'Culture',
    description: 'Exhibitions, theatre, film, talks.',
    icon: Palette,
  },
  {
    value: 'food',
    label: 'Food & Drink',
    description: 'Tastings, pop-ups, food fairs.',
    icon: UtensilsCrossed,
  },
  {
    value: 'general',
    label: 'Other',
    description: 'Anything else worth discovering.',
    icon: Sparkles,
  },
]

export default function CategoryStep({ draft, patch }: Props) {
  return (
    <div>
      <h2 className="text-xl font-semibold text-white">Pick a category</h2>
      <p className="mt-1 text-sm text-white/55">
        Helps people find your event when they filter.
      </p>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {CATEGORIES.map((category) => {
          const isActive = draft.category === category.value
          const Icon = category.icon
          return (
            <button
              key={category.value}
              type="button"
              onClick={() => patch({ category: category.value })}
              aria-pressed={isActive}
              className={[
                'flex items-start gap-3 rounded-3xl border p-4 text-left transition',
                isActive
                  ? 'border-flame-500/40 bg-flame-500/[0.06]'
                  : 'border-white/10 bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.05]',
              ].join(' ')}
            >
              <span
                className={[
                  'flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border',
                  isActive
                    ? 'border-flame-500/40 bg-flame-500/15 text-flame-200'
                    : 'border-white/10 bg-white/[0.04] text-white/75',
                ].join(' ')}
              >
                <Icon className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <p
                  className={[
                    'text-sm font-semibold',
                    isActive ? 'text-flame-100' : 'text-white',
                  ].join(' ')}
                >
                  {category.label}
                </p>
                <p className="mt-0.5 text-xs leading-5 text-white/55">
                  {category.description}
                </p>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
