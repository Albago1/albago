'use client'

import {
  CalendarDays,
  CheckCircle2,
  Edit3,
  Flame,
  Globe2,
  ImageIcon,
  MapPin,
  Tag,
  User2,
} from 'lucide-react'
import type { EventDraft } from '@/types/eventDraft'

type Props = {
  draft: EventDraft
  onJumpTo: (stepKey: string) => void
}

const CATEGORY_LABEL: Record<string, string> = {
  nightlife: 'Nightlife',
  music: 'Music',
  sports: 'Sports',
  culture: 'Culture',
  food: 'Food & drink',
  civic: 'Civic gathering',
}

const LANG_LABEL: Record<string, string> = {
  en: 'English',
  sq: 'Shqip',
  de: 'Deutsch',
  es: 'Español',
  it: 'Italiano',
  fr: 'Français',
}

function formatDate(d: string): string {
  if (!d) return '—'
  try {
    const [y, m, day] = d.split('-').map(Number)
    const dt = new Date(y, (m ?? 1) - 1, day ?? 1)
    return dt.toLocaleDateString(undefined, {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
  } catch {
    return d
  }
}

function formatTimeRange(start: string, end: string): string {
  if (!start) return '—'
  if (end) return `${start} → ${end}`
  return start
}

export default function ReviewStep({ draft, onJumpTo }: Props) {
  const isCivic = draft.event_type === 'protest' || draft.is_civic
  const categoryLabel = isCivic
    ? 'Civic gathering'
    : draft.category
      ? CATEGORY_LABEL[draft.category] || draft.category
      : '—'
  const langLabel = LANG_LABEL[draft.language] || draft.language

  const previewUrl = draft.banner_url

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold text-white">Review and submit</h2>
        <p className="mt-1 text-sm text-white/55">
          One last look — click any section to edit it. When you submit, this
          {draft.event_type === 'protest' ? ' civic gathering' : ' event'} goes
          to the moderation queue.
        </p>
      </div>

      {/* Hero summary */}
      <div className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03]">
        {previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={previewUrl}
            alt="Cover"
            className="aspect-[16/9] w-full object-cover"
          />
        ) : (
          <div className="flex aspect-[16/9] w-full items-center justify-center bg-gradient-to-br from-flame-500/30 via-ink-900 to-ink-950">
            <ImageIcon className="h-10 w-10 text-white/30" />
          </div>
        )}
        <div className="p-5">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={[
                'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] ring-1',
                isCivic
                  ? 'bg-flame-500/15 text-flame-200 ring-flame-500/30'
                  : 'bg-white/10 text-white/75 ring-white/15',
              ].join(' ')}
            >
              {isCivic && <Flame className="h-3 w-3" />}
              {categoryLabel}
            </span>
            {draft.is_online && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-200 ring-1 ring-emerald-500/30">
                <Globe2 className="h-3 w-3" />
                Online
              </span>
            )}
            {draft.tags.slice(0, 4).map((t) => (
              <span
                key={t}
                className="inline-flex items-center rounded-full bg-white/[0.04] px-2 py-0.5 text-[11px] text-white/65 ring-1 ring-white/10"
              >
                {t}
              </span>
            ))}
            {draft.tags.length > 4 && (
              <span className="text-[11px] text-white/40">
                +{draft.tags.length - 4} more
              </span>
            )}
          </div>
          <h3 className="mt-3 text-2xl font-bold text-white">
            {draft.title || <span className="text-white/40">Untitled event</span>}
          </h3>
          {draft.description && (
            <p className="mt-2 line-clamp-3 text-sm text-white/65">
              {draft.description}
            </p>
          )}
        </div>
      </div>

      {/* Section: When */}
      <Section
        title="When"
        icon={<CalendarDays className="h-3.5 w-3.5" />}
        onEdit={() => onJumpTo('when')}
      >
        <Row label="Date" value={formatDate(draft.date)} />
        <Row label="Time" value={formatTimeRange(draft.time, draft.end_time)} />
        <Row label="Timezone" value={draft.timezone || '—'} />
      </Section>

      {/* Section: Where */}
      <Section
        title="Where"
        icon={<MapPin className="h-3.5 w-3.5" />}
        onEdit={() => onJumpTo('where')}
      >
        {draft.is_online ? (
          <>
            <Row label="Format" value="Online" />
            <Row
              label="URL"
              value={
                draft.online_url ? (
                  <a
                    href={draft.online_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="break-all text-emerald-300 hover:underline"
                  >
                    {draft.online_url}
                  </a>
                ) : (
                  '—'
                )
              }
            />
            {draft.city && <Row label="Tagged city" value={draft.city} />}
          </>
        ) : (
          <>
            {draft.venue_name && (
              <Row label="Venue" value={draft.venue_name} />
            )}
            <Row label="Address" value={draft.address || '—'} />
            <Row
              label="City"
              value={
                [draft.city, draft.country].filter(Boolean).join(', ') || '—'
              }
            />
            {draft.lat != null && draft.lng != null && (
              <Row
                label="Coordinates"
                value={
                  <span className="font-mono text-xs text-white/60">
                    {draft.lat.toFixed(5)}, {draft.lng.toFixed(5)}
                  </span>
                }
              />
            )}
          </>
        )}
      </Section>

      {/* Section: Basics extras */}
      <Section
        title="Basics"
        icon={<Tag className="h-3.5 w-3.5" />}
        onEdit={() => onJumpTo('basics')}
      >
        <Row label="Language" value={langLabel} />
        <Row
          label="Tags"
          value={
            draft.tags.length === 0 ? (
              '—'
            ) : (
              <span className="flex flex-wrap gap-1">
                {draft.tags.map((t) => (
                  <span
                    key={t}
                    className="rounded-full bg-flame-500/[0.08] px-2 py-0.5 text-[11px] text-flame-100 ring-1 ring-flame-500/30"
                  >
                    {t}
                  </span>
                ))}
              </span>
            )
          }
        />
      </Section>

      {/* Section: Media */}
      <Section
        title="Media"
        icon={<ImageIcon className="h-3.5 w-3.5" />}
        onEdit={() => onJumpTo('media')}
      >
        <Row
          label="Cover image"
          value={
            draft.banner_url ? (
              <span className="inline-flex items-center gap-1.5 text-emerald-200">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Uploaded
              </span>
            ) : (
              <span className="text-white/50">No cover (fallback gradient)</span>
            )
          }
        />
      </Section>

      {/* Section: Organizer */}
      <Section
        title="Organizer"
        icon={<User2 className="h-3.5 w-3.5" />}
        onEdit={() => onJumpTo('organizer')}
      >
        <Row label="Name" value={draft.organizer_name || '—'} />
        <Row label="Contact email" value={draft.organizer_contact || '—'} />
        {draft.organizer_phone && (
          <Row label="Phone" value={draft.organizer_phone} />
        )}
        {draft.organizer_website && (
          <Row
            label="Website"
            value={
              <a
                href={draft.organizer_website}
                target="_blank"
                rel="noopener noreferrer"
                className="break-all text-emerald-300 hover:underline"
              >
                {draft.organizer_website}
              </a>
            }
          />
        )}
        {Object.entries(draft.organizer_socials)
          .filter(([, v]) => v && String(v).trim())
          .map(([k, v]) => (
            <Row key={k} label={capitalize(k)} value={v as string} />
          ))}
      </Section>

      {/* Civic-only block — only show if event_type=protest */}
      {isCivic && (
        <Section
          title="Civic details"
          icon={<Flame className="h-3.5 w-3.5" />}
          onEdit={() => onJumpTo('type')}
        >
          {draft.featured_movement_slug && (
            <Row label="Movement" value={draft.featured_movement_slug} />
          )}
          {draft.expected_attendees && (
            <Row
              label="Expected attendees"
              value={Number(draft.expected_attendees).toLocaleString()}
            />
          )}
          {draft.telegram_link && (
            <Row label="Telegram" value={draft.telegram_link} />
          )}
          {draft.whatsapp_link && (
            <Row label="WhatsApp" value={draft.whatsapp_link} />
          )}
          {draft.safety_notes && (
            <Row label="Safety notes" value={draft.safety_notes} />
          )}
        </Section>
      )}
    </div>
  )
}

function Section({
  title,
  icon,
  onEdit,
  children,
}: {
  title: string
  icon: React.ReactNode
  onEdit: () => void
  children: React.ReactNode
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-white/65">
          <span className="text-flame-300">{icon}</span>
          {title}
        </h3>
        <button
          type="button"
          onClick={onEdit}
          className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] font-semibold text-white/65 transition hover:bg-white/[0.08] hover:text-white"
        >
          <Edit3 className="h-3 w-3" />
          Edit
        </button>
      </div>
      <dl className="space-y-2 text-sm">{children}</dl>
    </div>
  )
}

function Row({
  label,
  value,
}: {
  label: string
  value: React.ReactNode
}) {
  return (
    <div className="flex flex-wrap items-start gap-x-3 gap-y-1 border-t border-white/[0.06] pt-2 first:border-t-0 first:pt-0">
      <dt className="min-w-[110px] text-xs uppercase tracking-[0.12em] text-white/45">
        {label}
      </dt>
      <dd className="flex-1 text-white/85">{value}</dd>
    </div>
  )
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}
