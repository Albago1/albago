'use client'

import { useMemo } from 'react'
import { CalendarDays, Clock, Globe } from 'lucide-react'
import type { EventDraft } from '@/types/eventDraft'

type Props = {
  draft: EventDraft
  patch: (patch: Partial<EventDraft>) => void
}

// Most common IANA timezones for the diaspora cities the platform targets.
// Always-present even if the auto-detected zone falls outside the list.
const POPULAR_TIMEZONES = [
  'Europe/Tirane',
  'Europe/Berlin',
  'Europe/Vienna',
  'Europe/Zurich',
  'Europe/London',
  'Europe/Brussels',
  'Europe/Rome',
  'Europe/Paris',
  'Europe/Madrid',
  'America/New_York',
  'America/Toronto',
  'UTC',
]

function todayIso(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export default function WhenStep({ draft, patch }: Props) {
  const today = useMemo(() => todayIso(), [])
  const timezoneOptions = useMemo(() => {
    const set = new Set<string>(POPULAR_TIMEZONES)
    if (draft.timezone) set.add(draft.timezone)
    return Array.from(set).sort()
  }, [draft.timezone])

  return (
    <div className="space-y-5">
      <h2 className="text-xl font-semibold text-white">When is it happening?</h2>
      <p className="text-sm text-white/55">
        Use the local time of the venue. We&apos;ll show it in each visitor&apos;s
        timezone automatically.
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Date" htmlFor="when-date" required icon={CalendarDays}>
          <input
            id="when-date"
            type="date"
            required
            value={draft.date}
            min={today}
            onChange={(e) => patch({ date: e.target.value })}
            className="input"
          />
        </Field>
        <Field label="Start time" htmlFor="when-time" icon={Clock}>
          <input
            id="when-time"
            type="time"
            value={draft.time}
            onChange={(e) => patch({ time: e.target.value })}
            className="input"
          />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="End time (optional)" htmlFor="when-end" icon={Clock}>
          <input
            id="when-end"
            type="time"
            value={draft.end_time}
            onChange={(e) => patch({ end_time: e.target.value })}
            className="input"
          />
        </Field>
        <Field label="Timezone" htmlFor="when-tz" icon={Globe}>
          <select
            id="when-tz"
            value={draft.timezone}
            onChange={(e) => patch({ timezone: e.target.value })}
            className="input"
          >
            {timezoneOptions.map((tz) => (
              <option key={tz} value={tz} className="bg-ink-900">
                {tz}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <p className="text-xs text-white/40">
        Detected timezone: <span className="font-mono text-white/60">{draft.timezone}</span>.
        Change it if the event is in a different region.
      </p>

      <style jsx>{`
        :global(.input) {
          width: 100%;
          border-radius: 1rem;
          border: 1px solid rgba(255, 255, 255, 0.1);
          background: rgba(255, 255, 255, 0.04);
          color: white;
          padding: 0.7rem 0.9rem;
          font-size: 0.875rem;
          outline: none;
          transition: border-color 0.15s, background 0.15s;
          color-scheme: dark;
        }
        :global(.input:focus) {
          border-color: rgba(255, 255, 255, 0.25);
          background: rgba(255, 255, 255, 0.06);
        }
      `}</style>
    </div>
  )
}

function Field({
  label,
  htmlFor,
  required,
  icon: Icon,
  children,
}: {
  label: string
  htmlFor: string
  required?: boolean
  icon?: React.ComponentType<{ className?: string }>
  children: React.ReactNode
}) {
  return (
    <div>
      <label
        htmlFor={htmlFor}
        className="mb-1.5 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-white/55"
      >
        {Icon && <Icon className="h-3.5 w-3.5 text-white/40" />}
        {label}
        {required && <span className="text-flame-400">*</span>}
      </label>
      {children}
    </div>
  )
}
