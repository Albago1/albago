'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Mail, MapPin, Phone } from 'lucide-react'
import { createClient } from '@/lib/supabase/browser'

type VolunteerRow = {
  id: string
  created_at: string
  name: string
  email: string
  phone: string | null
  city: string
  country: string | null
  roles: string[]
  availability_note: string | null
  movement_slug: string | null
  status: 'new' | 'contacted' | 'confirmed' | 'declined' | string
}

type StatusKey = 'all' | 'new' | 'contacted' | 'confirmed' | 'declined'

const STATUS_FLOW: VolunteerRow['status'][] = [
  'new',
  'contacted',
  'confirmed',
  'declined',
]

function statusBadgeClass(status: string) {
  if (status === 'new') return 'border-amber-500/20 bg-amber-500/10 text-amber-300'
  if (status === 'contacted') return 'border-sky-500/20 bg-sky-500/10 text-sky-300'
  if (status === 'confirmed') return 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300'
  if (status === 'declined') return 'border-red-500/20 bg-red-500/10 text-red-300'
  return 'border-white/15 bg-white/5 text-white/70'
}

function formatRoleLabel(key: string) {
  return key.replace(/-/g, ' ')
}

export default function VolunteersClient() {
  const supabase = useMemo(() => createClient(), [])

  const [rows, setRows] = useState<VolunteerRow[]>([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState<string | null>(null)
  const [actionId, setActionId] = useState<string | null>(null)
  const [filter, setFilter] = useState<StatusKey>('new')
  const [movementFilter, setMovementFilter] = useState<string | null>(null)

  const fetchRows = useCallback(async () => {
    setLoading(true)
    setMessage(null)
    const { data, error } = await supabase
      .from('volunteer_signups')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(500)

    if (error) {
      console.error('volunteer_signups load error:', error)
      if (error.code === '42501' || error.message.includes('permission denied')) {
        setMessage(
          'Cannot read volunteer_signups. Apply docs/seeds/phase-9.1-admin-volunteer-policies.sql in Supabase, then refresh.'
        )
      } else if (
        error.code === '42P01' ||
        error.message.toLowerCase().includes('relation "volunteer_signups"')
      ) {
        setMessage(
          'volunteer_signups table missing. Apply docs/seeds/phase-9-volunteer-signups.sql first.'
        )
      } else {
        setMessage(`Error loading volunteers: ${error.message}`)
      }
      setLoading(false)
      return
    }

    setRows((data as VolunteerRow[] | null) ?? [])
    setLoading(false)
  }, [supabase])

  useEffect(() => {
    fetchRows()
  }, [fetchRows])

  const movementSlugs = useMemo(() => {
    const set = new Set<string>()
    rows.forEach((r) => {
      if (r.movement_slug) set.add(r.movement_slug)
    })
    return Array.from(set).sort()
  }, [rows])

  const counts = useMemo(
    () => ({
      all: rows.length,
      new: rows.filter((r) => r.status === 'new').length,
      contacted: rows.filter((r) => r.status === 'contacted').length,
      confirmed: rows.filter((r) => r.status === 'confirmed').length,
      declined: rows.filter((r) => r.status === 'declined').length,
    }),
    [rows]
  )

  const visible = useMemo(() => {
    return rows.filter((r) => {
      const statusMatch = filter === 'all' || r.status === filter
      const movementMatch =
        movementFilter == null || r.movement_slug === movementFilter
      return statusMatch && movementMatch
    })
  }, [rows, filter, movementFilter])

  const updateStatus = async (row: VolunteerRow, next: VolunteerRow['status']) => {
    setActionId(row.id)
    setMessage(null)
    const { error } = await supabase
      .from('volunteer_signups')
      .update({ status: next })
      .eq('id', row.id)
    setActionId(null)
    if (error) {
      console.error('volunteer_signups update error:', error)
      if (error.code === '42501' || error.message.includes('permission denied')) {
        setMessage(
          'Update blocked by RLS. Apply docs/seeds/phase-9.1-admin-volunteer-policies.sql in Supabase.'
        )
        return
      }
      setMessage(`Update failed: ${error.message}`)
      return
    }
    // Optimistic local update
    setRows((prev) =>
      prev.map((r) => (r.id === row.id ? { ...r, status: next } : r))
    )
  }

  const tabs: { key: StatusKey; label: string }[] = [
    { key: 'new', label: 'New' },
    { key: 'contacted', label: 'Contacted' },
    { key: 'confirmed', label: 'Confirmed' },
    { key: 'declined', label: 'Declined' },
    { key: 'all', label: 'All' },
  ]

  return (
    <div className="mx-auto max-w-5xl">
      <Link
        href="/admin"
        className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-white/70 transition hover:bg-white/[0.08] hover:text-white"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to admin
      </Link>

      <h1 className="mt-5 text-3xl font-bold">Volunteer signups</h1>
      <p className="mt-2 text-sm text-white/55">
        People who signed up via <code className="rounded bg-white/[0.08] px-1.5 py-0.5">/volunteer</code>.
        Move a signup through{' '}
        <span className="text-white/80">new → contacted → confirmed</span> (or decline).
      </p>

      <div className="mt-6 flex flex-wrap gap-2">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setFilter(tab.key)}
            className={[
              'inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition',
              filter === tab.key
                ? 'border-white/20 bg-white/[0.08] text-white'
                : 'border-white/10 bg-transparent text-white/55 hover:bg-white/[0.04] hover:text-white/80',
            ].join(' ')}
          >
            {tab.label}
            <span
              className={[
                'rounded-full px-2 py-0.5 text-xs',
                filter === tab.key ? 'bg-white/15' : 'bg-white/[0.06]',
              ].join(' ')}
            >
              {counts[tab.key]}
            </span>
          </button>
        ))}
      </div>

      {movementSlugs.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setMovementFilter(null)}
            className={[
              'rounded-full px-3 py-1.5 text-xs font-medium transition',
              movementFilter === null
                ? 'bg-white/10 text-white ring-1 ring-white/25'
                : 'bg-white/[0.04] text-white/65 ring-1 ring-white/10 hover:bg-white/[0.08] hover:text-white',
            ].join(' ')}
          >
            All movements
          </button>
          {movementSlugs.map((slug) => (
            <button
              key={slug}
              type="button"
              onClick={() =>
                setMovementFilter(movementFilter === slug ? null : slug)
              }
              className={[
                'rounded-full px-3 py-1.5 text-xs font-medium transition',
                movementFilter === slug
                  ? 'bg-flame-500/15 text-flame-100 ring-1 ring-flame-500/40'
                  : 'bg-white/[0.04] text-white/65 ring-1 ring-white/10 hover:bg-white/[0.08] hover:text-white',
              ].join(' ')}
            >
              {slug}
            </button>
          ))}
        </div>
      )}

      {message && (
        <div className="mt-5 rounded-2xl border border-yellow-500/20 bg-yellow-500/10 p-4 text-yellow-100">
          {message}
        </div>
      )}

      {loading && (
        <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-white/70">
          Loading volunteers...
        </div>
      )}

      {!loading && visible.length === 0 && (
        <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-white/70">
          No {filter === 'all' ? '' : filter} signups
          {movementFilter ? ` for ${movementFilter}` : ''}.
        </div>
      )}

      <div className="mt-5 space-y-4">
        {visible.map((row) => {
          const isWorking = actionId === row.id

          return (
            <article
              key={row.id}
              className="rounded-3xl border border-white/10 bg-white/[0.03] p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold text-white">{row.name}</h2>
                  <p className="mt-1 inline-flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-white/55">
                    <span className="inline-flex items-center gap-1.5">
                      <MapPin className="h-3 w-3" />
                      {row.city}
                      {row.country ? `, ${row.country}` : ''}
                    </span>
                    <a
                      href={`mailto:${row.email}`}
                      className="inline-flex items-center gap-1.5 text-flame-300 hover:underline"
                    >
                      <Mail className="h-3 w-3" />
                      {row.email}
                    </a>
                    {row.phone && (
                      <a
                        href={`tel:${row.phone}`}
                        className="inline-flex items-center gap-1.5 text-white/70 hover:underline"
                      >
                        <Phone className="h-3 w-3" />
                        {row.phone}
                      </a>
                    )}
                    {row.movement_slug && (
                      <span className="inline-flex items-center rounded-full border border-flame-500/30 bg-flame-500/[0.08] px-2 py-0.5 text-flame-300">
                        {row.movement_slug}
                      </span>
                    )}
                  </p>
                </div>

                <span
                  className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide ${statusBadgeClass(row.status)}`}
                >
                  {row.status}
                </span>
              </div>

              <div className="mt-3 flex flex-wrap gap-1.5">
                {row.roles.map((role) => (
                  <span
                    key={role}
                    className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-0.5 text-xs capitalize text-white/75"
                  >
                    {formatRoleLabel(role)}
                  </span>
                ))}
              </div>

              {row.availability_note && (
                <p className="mt-3 whitespace-pre-line text-sm leading-6 text-white/65">
                  {row.availability_note}
                </p>
              )}

              <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
                <span className="text-white/40">Set status:</span>
                {STATUS_FLOW.map((next) => {
                  const isCurrent = row.status === next
                  return (
                    <button
                      key={next}
                      type="button"
                      disabled={isCurrent || isWorking}
                      onClick={() => updateStatus(row, next)}
                      className={[
                        'rounded-full border px-3 py-1 capitalize transition',
                        isCurrent
                          ? 'cursor-default border-white/20 bg-white/[0.08] text-white/85'
                          : 'border-white/10 bg-white/[0.04] text-white/65 hover:bg-white/[0.08] hover:text-white',
                        isWorking && !isCurrent ? 'opacity-40' : '',
                      ].join(' ')}
                    >
                      {next}
                    </button>
                  )
                })}
                <span className="ml-auto text-white/35">
                  {new Date(row.created_at).toLocaleString()}
                </span>
              </div>
            </article>
          )
        })}
      </div>
    </div>
  )
}
