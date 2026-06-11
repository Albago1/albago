'use client'

import { useMemo } from 'react'
import { CalendarDays, Clock, Globe, Repeat } from 'lucide-react'
import type { EventDraft } from '@/types/eventDraft'

const WEEKDAYS = [
  { iso: 1, short: 'Mon' },
  { iso: 2, short: 'Tue' },
  { iso: 3, short: 'Wed' },
  { iso: 4, short: 'Thu' },
  { iso: 5, short: 'Fri' },
  { iso: 6, short: 'Sat' },
  { iso: 7, short: 'Sun' },
]

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

      {/* Recurrence (Phase 15) */}
      <div className="space-y-4 rounded-3xl border border-white/10 bg-white/[0.02] p-4">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-white/55">
          <Repeat className="h-3.5 w-3.5 text-white/40" />
          Repeats?
        </div>

        <div className="inline-flex rounded-full border border-white/10 bg-white/[0.04] p-1">
          {(['none', 'daily', 'weekly'] as const).map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => {
                const next: Partial<EventDraft> = { recurrence: opt }
                if (opt === 'none') {
                  next.recurrence_until = ''
                  next.recurrence_days_of_week = []
                } else if (opt === 'daily') {
                  next.recurrence_days_of_week = []
                }
                patch(next)
              }}
              className={[
                'inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold transition',
                draft.recurrence === opt
                  ? 'bg-white text-black'
                  : 'text-white/65 hover:text-white',
              ].join(' ')}
            >
              {opt === 'none' ? 'One-off' : opt === 'daily' ? 'Daily' : 'Weekly'}
            </button>
          ))}
        </div>

        {draft.recurrence === 'weekly' && (
          <div>
            <p className="mb-2 text-xs text-white/55">
              Pick the weekdays the event runs.
            </p>
            <div className="flex flex-wrap gap-1.5">
              {WEEKDAYS.map((d) => {
                const active = draft.recurrence_days_of_week.includes(d.iso)
                return (
                  <button
                    key={d.iso}
                    type="button"
                    onClick={() => {
                      const set = new Set(draft.recurrence_days_of_week)
                      if (active) set.delete(d.iso)
                      else set.add(d.iso)
                      patch({
                        recurrence_days_of_week: Array.from(set).sort(
                          (a, b) => a - b,
                        ),
                      })
                    }}
                    className={[
                      'rounded-full border px-3 py-1.5 text-xs font-semibold transition',
                      active
                        ? 'border-flame-500/40 bg-flame-500/15 text-flame-100'
                        : 'border-white/10 bg-white/[0.04] text-white/65 hover:text-white',
                    ].join(' ')}
                  >
                    {d.short}
                  </button>
                )
              })}
            </div>
            {draft.recurrence_days_of_week.length === 0 && (
              <p className="mt-2 text-xs text-amber-200/80">
                Pick at least one weekday or the series won&apos;t run.
              </p>
            )}
          </div>
        )}

        {draft.recurrence !== 'none' && (
          <div>
            <label
              htmlFor="when-until"
              className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.16em] text-white/55"
            >
              Repeat until (optional)
            </label>
            <input
              id="when-until"
              type="date"
              value={draft.recurrence_until}
              min={draft.date || today}
              onChange={(e) => patch({ recurrence_until: e.target.value })}
              className="input"
            />
            <p className="mt-1 text-xs text-white/45">
              Leave empty for open-ended (until you archive the event).
            </p>
          </div>
        )}
      </div>

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
