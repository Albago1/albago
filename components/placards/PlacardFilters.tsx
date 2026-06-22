'use client'

import { PLACARD_FILTER_ORDER } from '@/lib/placards'
import type { PlacardSort } from '@/lib/placards'

type Props = {
  filterKey: string
  onFilterChange: (key: string) => void
  sort: PlacardSort
  onSortChange: (sort: PlacardSort) => void
  countsByFilter: Record<string, number>
}

export default function PlacardFilters({
  filterKey,
  onFilterChange,
  sort,
  onSortChange,
  countsByFilter,
}: Props) {
  return (
    <div className="flex flex-col gap-4">
      <div className="-mx-1 flex flex-wrap items-center gap-2">
        {PLACARD_FILTER_ORDER.map((f) => {
          const active = f.key === filterKey
          const count = countsByFilter[f.key] ?? 0
          return (
            <button
              key={f.key}
              type="button"
              onClick={() => onFilterChange(f.key)}
              className={[
                'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition',
                active
                  ? 'border-flame-500/55 bg-flame-500/15 text-flame-100'
                  : 'border-white/10 bg-white/[0.04] text-white/70 hover:border-white/20 hover:text-white',
              ].join(' ')}
            >
              <span>{f.label}</span>
              <span
                className={[
                  'rounded-full px-1.5 py-0 text-[10px] font-bold',
                  active ? 'bg-flame-500/25 text-flame-100' : 'bg-white/[0.06] text-white/55',
                ].join(' ')}
              >
                {count}
              </span>
            </button>
          )
        })}
      </div>

      <div className="flex items-center gap-2 text-xs text-white/55">
        <span className="font-semibold uppercase tracking-[0.22em]">Rendit:</span>
        <button
          type="button"
          onClick={() => onSortChange('newest')}
          className={[
            'rounded-full border px-2.5 py-1 font-semibold transition',
            sort === 'newest'
              ? 'border-white/30 bg-white/10 text-white'
              : 'border-white/10 bg-transparent text-white/55 hover:text-white',
          ].join(' ')}
        >
          Më të rejat
        </button>
        <button
          type="button"
          onClick={() => onSortChange('shortest')}
          className={[
            'rounded-full border px-2.5 py-1 font-semibold transition',
            sort === 'shortest'
              ? 'border-white/30 bg-white/10 text-white'
              : 'border-white/10 bg-transparent text-white/55 hover:text-white',
          ].join(' ')}
        >
          Më të shkurtrat
        </button>
      </div>
    </div>
  )
}
