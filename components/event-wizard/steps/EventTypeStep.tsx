'use client'

import { Calendar, Flame, Globe2 } from 'lucide-react'
import type { EventDraft } from '@/types/eventDraft'

type Props = {
  draft: EventDraft
  patch: (patch: Partial<EventDraft>) => void
}

type TypeOption = {
  key: 'event' | 'protest' | 'online'
  label: string
  description: string
  icon: React.ComponentType<{ className?: string }>
  apply: (draft: EventDraft) => Partial<EventDraft>
  detect: (draft: EventDraft) => boolean
}

const OPTIONS: TypeOption[] = [
  {
    key: 'event',
    label: 'Event',
    description: 'Concert, nightlife, sports match, cultural night, food festival.',
    icon: Calendar,
    apply: () => ({ event_type: 'event', is_civic: false, is_online: false }),
    detect: (d) => d.event_type === 'event' && !d.is_online,
  },
  {
    key: 'protest',
    label: 'Protest / Movement',
    description:
      'Peaceful civic gathering. Includes safety guidance and coordination links.',
    icon: Flame,
    apply: () => ({
      event_type: 'protest',
      is_civic: true,
      category: 'civic',
      is_online: false,
    }),
    detect: (d) => d.event_type === 'protest',
  },
  {
    key: 'online',
    label: 'Online event',
    description: 'Stream, webinar, virtual meetup — no physical location required.',
    icon: Globe2,
    apply: () => ({ event_type: 'event', is_online: true, is_civic: false }),
    detect: (d) => d.is_online,
  },
]

export default function EventTypeStep({ draft, patch }: Props) {
  const activeKey =
    OPTIONS.find((option) => option.detect(draft))?.key ?? 'event'

  return (
    <div>
      <h2 className="text-xl font-semibold text-white">What are you creating?</h2>
      <p className="mt-1 text-sm text-white/55">
        This decides the form fields and how the event is discovered.
      </p>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        {OPTIONS.map((option) => {
          const isActive = option.key === activeKey
          const Icon = option.icon
          return (
            <button
              key={option.key}
              type="button"
              onClick={() => patch(option.apply(draft))}
              aria-pressed={isActive}
              className={[
                'group flex flex-col items-start gap-3 rounded-3xl border p-5 text-left transition',
                isActive
                  ? 'border-flame-500/40 bg-flame-500/[0.06] shadow-[0_8px_30px_rgba(238,28,37,0.18)]'
                  : 'border-white/10 bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.05]',
              ].join(' ')}
            >
              <span
                className={[
                  'flex h-10 w-10 items-center justify-center rounded-2xl border',
                  isActive
                    ? 'border-flame-500/40 bg-flame-500/15 text-flame-200'
                    : 'border-white/10 bg-white/[0.04] text-white/75',
                ].join(' ')}
              >
                <Icon className="h-5 w-5" />
              </span>
              <div>
                <p
                  className={[
                    'text-base font-semibold',
                    isActive ? 'text-flame-100' : 'text-white',
                  ].join(' ')}
                >
                  {option.label}
                </p>
                <p className="mt-1 text-xs leading-5 text-white/55">
                  {option.description}
                </p>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
