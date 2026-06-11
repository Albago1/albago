'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  AlertTriangle,
  ArrowLeft,
  BadgeCheck,
  Building2,
  Mail,
  MailCheck,
  Search,
  Shield,
  ShieldOff,
  Trash2,
  Users as UsersIcon,
  X,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/browser'

type UserRow = {
  id: string
  email: string
  created_at: string
  email_confirmed_at: string | null
  last_sign_in_at: string | null
  role: 'admin' | 'user'
  is_organizer: boolean
  organizer_verified: boolean
}

type Filter = 'all' | 'admins' | 'organizers' | 'unconfirmed'

function timeAgo(iso: string | null): string {
  if (!iso) return '—'
  const ms = Date.now() - new Date(iso).getTime()
  const m = Math.floor(ms / 60_000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  if (d < 30) return `${d}d ago`
  const mo = Math.floor(d / 30)
  if (mo < 12) return `${mo}mo ago`
  return `${Math.floor(mo / 12)}y ago`
}

export default function UsersClient({
  currentUserId,
}: {
  currentUserId: string
}) {
  const supabase = useMemo(() => createClient(), [])
  const [users, setUsers] = useState<UserRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<Filter>('all')
  const [search, setSearch] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<UserRow | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const { data, error: rpcError } = await supabase.rpc('admin_list_users')
    setLoading(false)
    if (rpcError) {
      console.error('admin_list_users:', rpcError)
      if (rpcError.code === '42501' || /not_admin/i.test(rpcError.message)) {
        setError('Not authorized. Re-check your admin role on the profiles table.')
        return
      }
      if (/admin_list_users/i.test(rpcError.message) && /does not exist/i.test(rpcError.message)) {
        setError(
          'admin_list_users RPC missing. Apply docs/seeds/phase-14-admin-users.sql in Supabase Studio.',
        )
        return
      }
      setError(rpcError.message)
      return
    }
    setUsers((data ?? []) as UserRow[])
  }, [supabase])

  useEffect(() => {
    void load()
  }, [load])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return users.filter((u) => {
      if (filter === 'admins' && u.role !== 'admin') return false
      if (filter === 'organizers' && !u.is_organizer) return false
      if (filter === 'unconfirmed' && u.email_confirmed_at) return false
      if (q && !u.email.toLowerCase().includes(q)) return false
      return true
    })
  }, [users, filter, search])

  const stats = useMemo(
    () => ({
      total: users.length,
      admins: users.filter((u) => u.role === 'admin').length,
      organizers: users.filter((u) => u.is_organizer).length,
      unconfirmed: users.filter((u) => !u.email_confirmed_at).length,
    }),
    [users],
  )

  const flashToast = (msg: string) => {
    setToast(msg)
    window.setTimeout(() => setToast(null), 2500)
  }

  const confirmEmail = async (u: UserRow) => {
    if (u.email_confirmed_at) return
    setBusyId(u.id)
    const { error: rpcError } = await supabase.rpc('admin_confirm_user_email', {
      target_user: u.id,
    })
    setBusyId(null)
    if (rpcError) {
      console.error('admin_confirm_user_email:', rpcError)
      flashToast(`Failed: ${rpcError.message}`)
      return
    }
    setUsers((prev) =>
      prev.map((row) =>
        row.id === u.id
          ? { ...row, email_confirmed_at: new Date().toISOString() }
          : row,
      ),
    )
    flashToast(`Confirmed ${u.email}.`)
  }

  const setRole = async (u: UserRow, next: 'admin' | 'user') => {
    if (u.id === currentUserId && next === 'user') {
      if (
        !window.confirm(
          'You are about to demote your own account. You will lose admin access. Continue?',
        )
      ) {
        return
      }
    }
    setBusyId(u.id)
    const { error: rpcError } = await supabase.rpc('admin_set_user_role', {
      target_user: u.id,
      new_role: next,
    })
    setBusyId(null)
    if (rpcError) {
      console.error('admin_set_user_role:', rpcError)
      flashToast(`Failed: ${rpcError.message}`)
      return
    }
    setUsers((prev) =>
      prev.map((row) => (row.id === u.id ? { ...row, role: next } : row)),
    )
    flashToast(`${u.email} is now ${next}.`)
  }

  const grantOrganizer = async (u: UserRow) => {
    const defaultName = u.email.split('@')[0]
    const displayName = window.prompt(
      `Make "${u.email}" an organizer.\n\nDisplay name shown to attendees:`,
      defaultName,
    )
    if (displayName === null) return
    const trimmed = displayName.trim()
    if (!trimmed) {
      flashToast('Display name is required.')
      return
    }
    setBusyId(u.id)
    const { error: rpcError } = await supabase.rpc('admin_grant_organizer', {
      target_user: u.id,
      display_name: trimmed,
    })
    setBusyId(null)
    if (rpcError) {
      console.error('admin_grant_organizer:', rpcError)
      if (/already_organizer/i.test(rpcError.message)) {
        flashToast('Already an organizer.')
        return
      }
      if (
        /admin_grant_organizer/i.test(rpcError.message) &&
        /does not exist/i.test(rpcError.message)
      ) {
        flashToast('admin_grant_organizer RPC missing — re-apply phase-14 SQL.')
        return
      }
      flashToast(`Failed: ${rpcError.message}`)
      return
    }
    setUsers((prev) =>
      prev.map((row) =>
        row.id === u.id
          ? { ...row, is_organizer: true, organizer_verified: false }
          : row,
      ),
    )
    flashToast(`${u.email} is now an organizer.`)
  }

  const revokeOrganizer = async (u: UserRow) => {
    if (
      !window.confirm(
        `Strip organizer status from ${u.email}? Their published events stay live but lose the organizer link.`,
      )
    ) {
      return
    }
    setBusyId(u.id)
    const { error: rpcError } = await supabase.rpc('admin_revoke_organizer', {
      target_user: u.id,
    })
    setBusyId(null)
    if (rpcError) {
      console.error('admin_revoke_organizer:', rpcError)
      flashToast(`Failed: ${rpcError.message}`)
      return
    }
    setUsers((prev) =>
      prev.map((row) =>
        row.id === u.id
          ? { ...row, is_organizer: false, organizer_verified: false }
          : row,
      ),
    )
    flashToast(`${u.email} is no longer an organizer.`)
  }

  const setOrganizerVerified = async (u: UserRow, next: boolean) => {
    setBusyId(u.id)
    const { error: rpcError } = await supabase.rpc(
      'admin_set_organizer_verified',
      {
        target_user: u.id,
        verified_value: next,
      },
    )
    setBusyId(null)
    if (rpcError) {
      console.error('admin_set_organizer_verified:', rpcError)
      flashToast(`Failed: ${rpcError.message}`)
      return
    }
    setUsers((prev) =>
      prev.map((row) =>
        row.id === u.id ? { ...row, organizer_verified: next } : row,
      ),
    )
    flashToast(
      next
        ? `${u.email} is now a verified organizer.`
        : `${u.email} is no longer verified.`,
    )
  }

  const deleteUser = async (u: UserRow, alsoDeleteEvents: boolean) => {
    setBusyId(u.id)
    const { error: rpcError } = await supabase.rpc('admin_delete_user', {
      target_user: u.id,
      also_delete_events: alsoDeleteEvents,
    })
    setBusyId(null)
    if (rpcError) {
      console.error('admin_delete_user:', rpcError)
      if (/cannot_delete_self/i.test(rpcError.message)) {
        flashToast('You cannot delete your own account.')
        return
      }
      if (
        /admin_delete_user/i.test(rpcError.message) &&
        /does not exist/i.test(rpcError.message)
      ) {
        flashToast('admin_delete_user RPC missing — re-apply phase-14 SQL.')
        return
      }
      flashToast(`Delete failed: ${rpcError.message}`)
      return
    }
    setUsers((prev) => prev.filter((row) => row.id !== u.id))
    setDeleteTarget(null)
    flashToast(`Deleted ${u.email}.`)
  }

  return (
    <div className="mx-auto max-w-6xl">
      <Link
        href="/admin"
        className="mb-3 inline-flex items-center gap-2 text-sm text-white/55 transition hover:text-white"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to admin
      </Link>

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Users</h1>
          <p className="mt-1 text-sm text-white/55">
            Every account on AlbaGo. Confirm emails for grandfathered users and
            promote trusted accounts to admin.
          </p>
        </div>

        <div className="flex flex-wrap gap-2 text-xs">
          <Stat label="Total" value={stats.total} icon={<UsersIcon className="h-3.5 w-3.5" />} />
          <Stat label="Admins" value={stats.admins} icon={<Shield className="h-3.5 w-3.5" />} />
          <Stat
            label="Organizers"
            value={stats.organizers}
            icon={<Building2 className="h-3.5 w-3.5" />}
          />
          <Stat
            label="Unconfirmed"
            value={stats.unconfirmed}
            icon={<Mail className="h-3.5 w-3.5" />}
            tone="warn"
          />
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-2">
        <FilterChip active={filter === 'all'} onClick={() => setFilter('all')}>
          All
        </FilterChip>
        <FilterChip
          active={filter === 'admins'}
          onClick={() => setFilter('admins')}
        >
          Admins
        </FilterChip>
        <FilterChip
          active={filter === 'organizers'}
          onClick={() => setFilter('organizers')}
        >
          Organizers
        </FilterChip>
        <FilterChip
          active={filter === 'unconfirmed'}
          onClick={() => setFilter('unconfirmed')}
        >
          Unconfirmed
        </FilterChip>

        <div className="relative ml-auto w-full sm:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search email..."
            className="h-10 w-full rounded-full border border-white/10 bg-white/[0.04] pl-9 pr-3 text-sm outline-none placeholder:text-white/35 focus:border-white/25"
          />
        </div>
      </div>

      {error && (
        <div className="mt-5 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-100">
          {error}
        </div>
      )}

      {loading ? (
        <div className="mt-8 text-sm text-white/55">Loading users…</div>
      ) : filtered.length === 0 ? (
        <div className="mt-8 rounded-3xl border border-white/10 bg-white/[0.02] p-10 text-center text-sm text-white/55">
          No users match this filter.
        </div>
      ) : (
        <div className="mt-6 overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03]">
          <table className="w-full text-sm">
            <thead className="bg-white/[0.04] text-left text-[11px] font-semibold uppercase tracking-[0.16em] text-white/55">
              <tr>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Joined</th>
                <th className="px-4 py-3">Last seen</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((u) => {
                const isSelf = u.id === currentUserId
                const confirmed = !!u.email_confirmed_at
                const busy = busyId === u.id
                return (
                  <tr
                    key={u.id}
                    className="border-t border-white/[0.06] transition hover:bg-white/[0.02]"
                  >
                    <td className="px-4 py-3">
                      <div className="font-mono text-xs text-white/90">
                        {u.email}
                      </div>
                      {isSelf && (
                        <div className="mt-0.5 text-[10px] text-flame-400">
                          you
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {confirmed ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-200 ring-1 ring-emerald-500/30">
                          <BadgeCheck className="h-3 w-3" />
                          Confirmed
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2.5 py-1 text-[11px] font-semibold text-amber-200 ring-1 ring-amber-500/30">
                          <Mail className="h-3 w-3" />
                          Unconfirmed
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {u.role === 'admin' ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-flame-500/10 px-2.5 py-1 text-[11px] font-semibold text-flame-200 ring-1 ring-flame-500/30">
                            <Shield className="h-3 w-3" />
                            Admin
                          </span>
                        ) : !u.is_organizer ? (
                          <span className="text-xs text-white/55">User</span>
                        ) : null}
                        {u.is_organizer && (
                          <span
                            className={[
                              'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1',
                              u.organizer_verified
                                ? 'bg-emerald-500/10 text-emerald-200 ring-emerald-500/30'
                                : 'bg-white/[0.06] text-white/85 ring-white/15',
                            ].join(' ')}
                            title={
                              u.organizer_verified
                                ? 'Verified organizer'
                                : 'Organizer — not yet verified'
                            }
                          >
                            <Building2 className="h-3 w-3" />
                            {u.organizer_verified ? 'Verified org' : 'Organizer'}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-white/55">
                      {timeAgo(u.created_at)}
                    </td>
                    <td className="px-4 py-3 text-xs text-white/55">
                      {timeAgo(u.last_sign_in_at)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap justify-end gap-1.5">
                        {!confirmed && (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => confirmEmail(u)}
                            className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-[11px] font-semibold text-emerald-100 transition hover:bg-emerald-500/20 disabled:opacity-50"
                            title="Mark email as confirmed"
                          >
                            <MailCheck className="h-3 w-3" />
                            Confirm
                          </button>
                        )}
                        {u.role === 'user' ? (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => setRole(u, 'admin')}
                            className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.06] px-3 py-1 text-[11px] font-semibold text-white/85 transition hover:bg-flame-500/20 hover:text-flame-100 disabled:opacity-50"
                            title="Promote to admin"
                          >
                            <Shield className="h-3 w-3" />
                            Make admin
                          </button>
                        ) : (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => setRole(u, 'user')}
                            className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] font-semibold text-white/65 transition hover:bg-red-500/10 hover:text-red-200 disabled:opacity-50"
                            title="Demote to user"
                          >
                            <ShieldOff className="h-3 w-3" />
                            Demote
                          </button>
                        )}
                        {!u.is_organizer ? (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => grantOrganizer(u)}
                            className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.06] px-3 py-1 text-[11px] font-semibold text-white/85 transition hover:bg-sky-500/20 hover:text-sky-100 disabled:opacity-50"
                            title="Grant organizer status"
                          >
                            <Building2 className="h-3 w-3" />
                            Make organizer
                          </button>
                        ) : (
                          <>
                            {u.organizer_verified ? (
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => setOrganizerVerified(u, false)}
                                className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/[0.06] px-3 py-1 text-[11px] font-semibold text-emerald-200 transition hover:bg-amber-500/15 hover:text-amber-100 hover:border-amber-500/30 disabled:opacity-50"
                                title="Remove verified badge"
                              >
                                <BadgeCheck className="h-3 w-3" />
                                Unverify
                              </button>
                            ) : (
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => setOrganizerVerified(u, true)}
                                className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/[0.06] px-3 py-1 text-[11px] font-semibold text-emerald-200 transition hover:bg-emerald-500/20 disabled:opacity-50"
                                title="Grant verified badge"
                              >
                                <BadgeCheck className="h-3 w-3" />
                                Verify
                              </button>
                            )}
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => revokeOrganizer(u)}
                              className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] font-semibold text-white/65 transition hover:bg-red-500/10 hover:text-red-200 disabled:opacity-50"
                              title="Strip organizer status"
                            >
                              <Building2 className="h-3 w-3" />
                              Strip org
                            </button>
                          </>
                        )}
                        {!isSelf && (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => setDeleteTarget(u)}
                            className="inline-flex items-center gap-1 rounded-full border border-red-500/30 bg-red-500/[0.06] px-3 py-1 text-[11px] font-semibold text-red-200 transition hover:bg-red-500/20 disabled:opacity-50"
                            title="Permanently delete this user"
                          >
                            <Trash2 className="h-3 w-3" />
                            Delete
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {deleteTarget && (
        <DeleteUserDialog
          user={deleteTarget}
          busy={busyId === deleteTarget.id}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={(alsoDeleteEvents) =>
            deleteUser(deleteTarget, alsoDeleteEvents)
          }
        />
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full border border-white/10 bg-ink-900/95 px-4 py-2 text-xs font-semibold text-white shadow-[0_8px_30px_rgba(0,0,0,0.4)] backdrop-blur">
          {toast}
        </div>
      )}
    </div>
  )
}

function Stat({
  label,
  value,
  icon,
  tone,
}: {
  label: string
  value: number
  icon: React.ReactNode
  tone?: 'warn'
}) {
  const toneCls =
    tone === 'warn'
      ? 'border-amber-500/30 bg-amber-500/[0.06] text-amber-100'
      : 'border-white/10 bg-white/[0.04] text-white/85'
  return (
    <div
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 ${toneCls}`}
    >
      {icon}
      <span className="font-mono text-sm">{value}</span>
      <span className="text-[10px] uppercase tracking-[0.14em] opacity-70">
        {label}
      </span>
    </div>
  )
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'rounded-full border px-3 py-1.5 text-xs font-semibold transition',
        active
          ? 'border-flame-500/40 bg-flame-500/15 text-flame-100'
          : 'border-white/10 bg-white/[0.04] text-white/65 hover:text-white',
      ].join(' ')}
    >
      {children}
    </button>
  )
}

function DeleteUserDialog({
  user,
  busy,
  onCancel,
  onConfirm,
}: {
  user: UserRow
  busy: boolean
  onCancel: () => void
  onConfirm: (alsoDeleteEvents: boolean) => void
}) {
  const [typed, setTyped] = useState('')
  const [alsoDeleteEvents, setAlsoDeleteEvents] = useState(false)
  const matches = typed.trim().toLowerCase() === user.email.trim().toLowerCase()

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink-950/75 p-4 backdrop-blur"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-md rounded-3xl border border-red-500/30 bg-ink-900 p-6 shadow-[0_24px_80px_rgba(0,0,0,0.6)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-red-500/15 ring-1 ring-red-500/30">
              <AlertTriangle className="h-5 w-5 text-red-300" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Delete user</h2>
              <p className="mt-0.5 text-xs text-white/55">
                This cannot be undone.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="rounded-full p-1.5 text-white/55 transition hover:bg-white/[0.06] hover:text-white disabled:opacity-50"
            title="Cancel"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-5 rounded-2xl border border-red-500/20 bg-red-500/[0.06] p-4 text-xs text-red-100">
          <p className="font-semibold text-red-100">
            Deleting <span className="font-mono">{user.email}</span> will also
            remove:
          </p>
          <ul className="mt-2 list-disc space-y-0.5 pl-5 text-red-100/90">
            <li>their profile + admin role (if any)</li>
            <li>saved events</li>
            <li>event submissions they filed</li>
            <li>organizer profile + verification</li>
            <li>volunteer signups</li>
          </ul>
          <p className="mt-2 text-red-100/70">
            Published events they authored stay live with no organizer link —
            tick the box below to remove those too.
          </p>
        </div>

        <label className="mt-4 flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3 text-sm text-white/85 hover:bg-white/[0.06]">
          <input
            type="checkbox"
            checked={alsoDeleteEvents}
            onChange={(e) => setAlsoDeleteEvents(e.target.checked)}
            disabled={busy}
            className="mt-0.5 h-4 w-4 rounded border-white/15 bg-white/[0.04]"
          />
          <div>
            <p className="font-semibold">
              Also delete this user&apos;s published events
            </p>
            <p className="mt-0.5 text-xs text-white/55">
              Removes every event where they are the organizer. Civic /
              community submissions they only filed (not authored) are not
              affected.
            </p>
          </div>
        </label>

        <div className="mt-5">
          <label
            htmlFor="delete-email-confirm"
            className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.16em] text-white/55"
          >
            Type the email to confirm
          </label>
          <input
            id="delete-email-confirm"
            type="email"
            autoComplete="off"
            autoFocus
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            placeholder={user.email}
            disabled={busy}
            className="h-11 w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 font-mono text-sm text-white outline-none transition focus:border-red-500/40"
          />
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-semibold text-white/75 transition hover:bg-white/[0.08] hover:text-white disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onConfirm(alsoDeleteEvents)}
            disabled={busy || !matches}
            className="inline-flex items-center gap-1.5 rounded-full bg-red-500 px-5 py-2 text-sm font-semibold text-white shadow-[0_8px_30px_rgba(239,68,68,0.35)] transition hover:bg-red-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Trash2 className="h-3.5 w-3.5" />
            {busy ? 'Deleting…' : 'Delete user'}
          </button>
        </div>
      </div>
    </div>
  )
}
