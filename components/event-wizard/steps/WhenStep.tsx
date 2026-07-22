'use client'

import { useMemo, useState } from 'react'
import { CalendarDays, Clock, Globe, MoonStar, Plus, Repeat, X } from 'lucide-react'
import { isOvernight } from '@/lib/recurrence'
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

// Comprehensive worldwide IANA timezones grouped by region. The detected
// browser zone is always added on top of this list, so even an obscure
// city still appears as a choice.
const TIMEZONE_GROUPS: Array<{ region: string; zones: string[] }> = [
  {
    region: 'Europe',
    zones: [
      'Europe/Tirane',
      'Europe/Amsterdam',
      'Europe/Athens',
      'Europe/Belgrade',
      'Europe/Berlin',
      'Europe/Brussels',
      'Europe/Bucharest',
      'Europe/Budapest',
      'Europe/Copenhagen',
      'Europe/Dublin',
      'Europe/Helsinki',
      'Europe/Istanbul',
      'Europe/Kyiv',
      'Europe/Lisbon',
      'Europe/London',
      'Europe/Luxembourg',
      'Europe/Madrid',
      'Europe/Moscow',
      'Europe/Oslo',
      'Europe/Paris',
      'Europe/Prague',
      'Europe/Rome',
      'Europe/Sofia',
      'Europe/Stockholm',
      'Europe/Vienna',
      'Europe/Warsaw',
      'Europe/Zurich',
    ],
  },
  {
    region: 'Americas',
    zones: [
      'America/New_York',
      'America/Chicago',
      'America/Denver',
      'America/Los_Angeles',
      'America/Anchorage',
      'America/Phoenix',
      'America/Toronto',
      'America/Vancouver',
      'America/Mexico_City',
      'America/Bogota',
      'America/Lima',
      'America/Caracas',
      'America/Santiago',
      'America/Buenos_Aires',
      'America/Sao_Paulo',
      'America/Halifax',
      'America/St_Johns',
      'Pacific/Honolulu',
    ],
  },
  {
    region: 'Asia & Middle East',
    zones: [
      'Asia/Dubai',
      'Asia/Tehran',
      'Asia/Jerusalem',
      'Asia/Riyadh',
      'Asia/Karachi',
      'Asia/Kolkata',
      'Asia/Dhaka',
      'Asia/Bangkok',
      'Asia/Jakarta',
      'Asia/Singapore',
      'Asia/Kuala_Lumpur',
      'Asia/Manila',
      'Asia/Hong_Kong',
      'Asia/Shanghai',
      'Asia/Taipei',
      'Asia/Seoul',
      'Asia/Tokyo',
    ],
  },
  {
    region: 'Africa',
    zones: [
      'Africa/Cairo',
      'Africa/Johannesburg',
      'Africa/Lagos',
      'Africa/Nairobi',
      'Africa/Casablanca',
      'Africa/Algiers',
      'Africa/Addis_Ababa',
      'Africa/Accra',
    ],
  },
  {
    region: 'Australia & Pacific',
    zones: [
      'Australia/Perth',
      'Australia/Adelaide',
      'Australia/Brisbane',
      'Australia/Melbourne',
      'Australia/Sydney',
      'Australia/Hobart',
      'Australia/Darwin',
      'Pacific/Auckland',
      'Pacific/Fiji',
      'Pacific/Guam',
    ],
  },
  {
    region: 'UTC',
    zones: ['UTC'],
  },
]

const ALL_KNOWN_ZONES = new Set<string>(TIMEZONE_GROUPS.flatMap((g) => g.zones))

function todayIso(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** "Sat, 26 Jul" for the day after the given ISO date; null if unparsable. */
function nextDayLabel(dateIso: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateIso)) return null
  const [y, m, d] = dateIso.split('-').map(Number)
  return new Date(y, m - 1, d + 1).toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })
}

export default function WhenStep({ draft, patch }: Props) {
  const today = useMemo(() => todayIso(), [])
  const extraTimezone = useMemo(() => {
    if (!draft.timezone) return null
    return ALL_KNOWN_ZONES.has(draft.timezone) ? null : draft.timezone
  }, [draft.timezone])

  // End time is opt-in: the field only exists once the user asks for it (or a
  // hydrated/edited draft already carries one). Clearing it collapses back.
  const [endOpen, setEndOpen] = useState(false)
  const showEnd = endOpen || draft.end_time !== ''
  const overnight = isOvernight(draft.time, draft.end_time)
  const overnightDay = draft.date ? nextDayLabel(draft.date) : null

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
        <Field label="Start time (optional)" htmlFor="when-time" icon={Clock}>
          <TimeInput
            id="when-time"
            value={draft.time}
            onChange={(v) => patch({ time: v })}
            onClear={() => patch({ time: '' })}
          />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {showEnd ? (
          <Field label="End time" htmlFor="when-end" icon={Clock}>
            <TimeInput
              id="when-end"
              value={draft.end_time}
              onChange={(v) => patch({ end_time: v })}
              onClear={() => {
                patch({ end_time: '' })
                setEndOpen(false)
              }}
            />
          </Field>
        ) : (
          <div className="flex items-end">
            <button
              type="button"
              onClick={() => setEndOpen(true)}
              className="inline-flex w-full items-center justify-center gap-1.5 rounded-2xl border border-dashed border-white/15 bg-white/[0.02] px-4 py-[0.7rem] text-sm font-medium text-white/55 transition hover:border-white/30 hover:bg-white/[0.04] hover:text-white"
            >
              <Plus className="h-4 w-4" />
              Add end time
            </button>
          </div>
        )}
        <Field label="Timezone" htmlFor="when-tz" icon={Globe}>
          <select
            id="when-tz"
            value={draft.timezone}
            onChange={(e) => patch({ timezone: e.target.value })}
            className="input"
          >
            {extraTimezone && (
              <optgroup label="Detected" className="bg-ink-900">
                <option value={extraTimezone} className="bg-ink-900">
                  {extraTimezone}
                </option>
              </optgroup>
            )}
            {TIMEZONE_GROUPS.map((group) => (
              <optgroup key={group.region} label={group.region} className="bg-ink-900">
                {group.zones.map((tz) => (
                  <option key={tz} value={tz} className="bg-ink-900">
                    {tz.replace(/_/g, ' ').replace(/^[^/]+\//, '')}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </Field>
      </div>

      {overnight && (
        <p className="flex items-center gap-1.5 text-xs text-flame-200/90">
          <MoonStar className="h-3.5 w-3.5 flex-shrink-0" />
          {draft.recurrence !== 'none'
            ? `Runs overnight — each date ends at ${draft.end_time} the next morning.`
            : `Ends the next day${overnightDay ? ` — ${overnightDay}` : ''} at ${draft.end_time}.`}
        </p>
      )}

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
        /* Our own clear × sits where the native picker icon would be; the
           whole field opens the picker via showPicker() instead. */
        :global(.time-input::-webkit-calendar-picker-indicator) {
          display: none;
        }
      `}</style>
    </div>
  )
}

/** Time input with a clear × once a value is set. Native pickers have no
 *  reliable "clear" (their Reset restores the last value), so we own it. */
function TimeInput({
  id,
  value,
  onChange,
  onClear,
}: {
  id: string
  value: string
  onChange: (value: string) => void
  onClear: () => void
}) {
  return (
    <div className="relative">
      <input
        id={id}
        type="time"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onClick={(e) => {
          try {
            e.currentTarget.showPicker?.()
          } catch {
            /* unsupported or no gesture — typing still works */
          }
        }}
        className="input time-input pr-10"
      />
      {value !== '' && (
        <button
          type="button"
          aria-label="Clear time"
          onClick={onClear}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1.5 text-white/45 transition hover:bg-white/10 hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>
      )}
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
